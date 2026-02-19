#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class KyberBusinessAPITester:
    def __init__(self, base_url="https://kyber-fixes.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.viewer_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   Description: {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "name": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "name": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test(
            "Health Check",
            "GET",
            "health",
            200,
            description="Basic health check to verify API is running"
        )

    def test_user_registration_admin(self):
        """Test user registration with @thestarforge.org email (should get admin role)"""
        admin_email = f"admin-{uuid.uuid4().hex[:8]}@thestarforge.org"
        success, response = self.run_test(
            "Admin User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Admin User",
                "email": admin_email,
                "password": "AdminPass123!"
            },
            description="Register user with @thestarforge.org email - should get admin role"
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            user_role = response.get('user', {}).get('role')
            if user_role == 'admin':
                print(f"✅ Admin role correctly assigned to {admin_email}")
                return True, response
            else:
                print(f"❌ Expected admin role, got {user_role}")
                return False, response
        return success, response

    def test_user_registration_viewer(self):
        """Test user registration with regular email (should get viewer role)"""
        viewer_email = f"viewer-{uuid.uuid4().hex[:8]}@example.com"
        success, response = self.run_test(
            "Viewer User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Viewer User",
                "email": viewer_email,
                "password": "ViewerPass123!"
            },
            description="Register user with regular email - should get viewer role"
        )
        
        if success and 'access_token' in response:
            self.viewer_token = response['access_token']
            user_role = response.get('user', {}).get('role')
            if user_role == 'viewer':
                print(f"✅ Viewer role correctly assigned to {viewer_email}")
                return True, response
            else:
                print(f"❌ Expected viewer role, got {user_role}")
                return False, response
        return success, response

    def test_login_functionality(self):
        """Test login with invalid credentials"""
        return self.run_test(
            "Login with Invalid Credentials",
            "POST",
            "auth/login",
            401,
            data={
                "email": "nonexistent@example.com",
                "password": "wrongpassword"
            },
            description="Login should fail with invalid credentials"
        )

    def test_protected_endpoint_without_auth(self):
        """Test accessing protected endpoint without authentication"""
        return self.run_test(
            "Protected Endpoint Without Auth",
            "GET",
            "auth/me",
            401,
            description="Should require authentication"
        )

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        if not self.admin_token:
            print("❌ No admin token available for admin endpoint testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test admin user list
        success, response = self.run_test(
            "Admin - List Users",
            "GET",
            "admin/users",
            200,
            headers=headers,
            description="Admin should be able to list all users"
        )
        
        return success, response

    def test_viewer_admin_access(self):
        """Test that viewer cannot access admin endpoints"""
        if not self.viewer_token:
            print("❌ No viewer token available for access control testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.viewer_token}'}
        
        return self.run_test(
            "Viewer Access to Admin Endpoint",
            "GET",
            "admin/users",
            403,
            headers=headers,
            description="Viewer should be denied access to admin endpoints"
        )

    def test_quotes_crud(self):
        """Test quotes CRUD operations"""
        if not self.admin_token:
            print("❌ No admin token available for quotes testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Create quote
        quote_data = {
            "client_name": "Test Client",
            "client_email": "client@example.com",
            "client_address": "123 Test St",
            "items": [
                {"description": "Test Service", "quantity": 1, "price": 100.00}
            ],
            "notes": "Test quote",
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Quote",
            "POST",
            "quotes",
            200,
            data=quote_data,
            headers=headers,
            description="Admin should be able to create quotes"
        )
        
        if success and 'id' in response:
            quote_id = response['id']
            
            # Get quote
            self.run_test(
                "Get Quote",
                "GET",
                f"quotes/{quote_id}",
                200,
                headers=headers,
                description="Should be able to retrieve created quote"
            )
            
            # List quotes
            self.run_test(
                "List Quotes",
                "GET",
                "quotes",
                200,
                headers=headers,
                description="Should be able to list all quotes"
            )
        
        return success, response

    def test_invoices_crud(self):
        """Test invoices CRUD operations (Bug Fix #3)"""
        if not self.admin_token:
            print("❌ No admin token available for invoices testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # First test GET /api/invoices directly (this was reported as returning 500)
        success, response = self.run_test(
            "List Invoices (Bug Fix Test)",
            "GET",
            "invoices",
            200,
            headers=headers,
            description="Test /api/invoices endpoint that was returning 500 errors"
        )
        
        if not success:
            print("❌ Critical issue: /api/invoices endpoint still returning errors")
            return False, {}
        
        print("✅ /api/invoices endpoint working correctly now")
        
        # Create invoice
        invoice_data = {
            "client_name": "Test Client",
            "client_email": "client@example.com", 
            "client_address": "123 Test St",
            "items": [
                {"description": "Test Service", "quantity": 2, "price": 50.00}
            ],
            "notes": "Test invoice",
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Invoice",
            "POST",
            "invoices",
            200,
            data=invoice_data,
            headers=headers,
            description="Admin should be able to create invoices"
        )
        
        if success and 'id' in response:
            invoice_id = response['id']
            
            # Get invoice
            self.run_test(
                "Get Invoice",
                "GET",
                f"invoices/{invoice_id}",
                200,
                headers=headers,
                description="Should be able to retrieve created invoice"
            )
            
            # List invoices again to make sure it still works after creating one
            self.run_test(
                "List Invoices Again",
                "GET",
                "invoices",
                200,
                headers=headers,
                description="Should still be able to list all invoices after creation"
            )
        
        return success, response

    def test_categories_and_vendors(self):
        """Test categories and vendors management"""
        if not self.admin_token:
            print("❌ No admin token available for categories/vendors testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Create category
        category_data = {
            "name": "Test Category",
            "color": "#06b6d4"
        }
        
        success, response = self.run_test(
            "Create Category",
            "POST",
            "categories",
            200,
            data=category_data,
            headers=headers,
            description="Admin should be able to create expense categories"
        )
        
        category_id = None
        if success and 'id' in response:
            category_id = response['id']
        
        # Create vendor
        vendor_data = {
            "name": "Test Vendor",
            "email": "vendor@example.com",
            "phone": "123-456-7890"
        }
        
        success, response = self.run_test(
            "Create Vendor",
            "POST",
            "vendors",
            200,
            data=vendor_data,
            headers=headers,
            description="Admin should be able to create vendors"
        )
        
        # List categories
        self.run_test(
            "List Categories",
            "GET",
            "categories",
            200,
            headers=headers,
            description="Should be able to list categories"
        )
        
        # List vendors
        self.run_test(
            "List Vendors",
            "GET",
            "vendors",
            200,
            headers=headers,
            description="Should be able to list vendors"
        )
        
        return success, response

    def test_expenses_crud(self):
        """Test expenses CRUD operations"""
        if not self.admin_token:
            print("❌ No admin token available for expenses testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # First create a category for the expense
        category_data = {
            "name": "Office Supplies",
            "color": "#10b981"
        }
        
        success, response = self.run_test(
            "Create Category for Expense",
            "POST",
            "categories",
            200,
            data=category_data,
            headers=headers,
            description="Create category needed for expense"
        )
        
        if not success or 'id' not in response:
            print("❌ Cannot test expenses without category")
            return False, {}
        
        category_id = response['id']
        
        # Create expense
        expense_data = {
            "description": "Test Office Supplies",
            "amount": 25.50,
            "category_id": category_id,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Test expense"
        }
        
        success, response = self.run_test(
            "Create Expense",
            "POST",
            "expenses",
            200,
            data=expense_data,
            headers=headers,
            description="Admin should be able to create expenses"
        )
        
        if success and 'id' in response:
            expense_id = response['id']
            
            # Get expense
            self.run_test(
                "Get Expense",
                "GET",
                f"expenses/{expense_id}",
                200,
                headers=headers,
                description="Should be able to retrieve created expense"
            )
            
            # List expenses
            self.run_test(
                "List Expenses",
                "GET",
                "expenses",
                200,
                headers=headers,
                description="Should be able to list all expenses"
            )
        
        return success, response

    def test_reports_endpoints(self):
        """Test reports endpoints"""
        if not self.admin_token:
            print("❌ No admin token available for reports testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test dashboard data
        success, response = self.run_test(
            "Dashboard Reports",
            "GET",
            "reports/dashboard",
            200,
            headers=headers,
            description="Should be able to get dashboard data"
        )
        
        # Test summary reports
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        self.run_test(
            "Summary Reports",
            "GET",
            f"reports/summary?start_date={start_date}&end_date={end_date}",
            200,
            headers=headers,
            description="Should be able to get summary reports"
        )
        
        return success, response

    def test_settings_endpoints(self):
        """Test settings endpoints (admin only)"""
        if not self.admin_token:
            print("❌ No admin token available for settings testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test SMTP settings (GET)
        success, response = self.run_test(
            "Get SMTP Settings",
            "GET",
            "settings/smtp",
            200,
            headers=headers,
            description="Admin should be able to get SMTP settings"
        )
        
        # Test PayPal settings (GET)
        self.run_test(
            "Get PayPal Settings",
            "GET",
            "settings/paypal",
            200,
            headers=headers,
            description="Admin should be able to get PayPal settings"
        )
        
        return success, response

    def test_branding_endpoints(self):
        """Test branding settings endpoints"""
        if not self.admin_token:
            print("❌ No admin token available for branding testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test get branding settings (should work for any authenticated user)
        success, response = self.run_test(
            "Get Branding Settings",
            "GET",
            "settings/branding",
            200,
            headers=headers,
            description="Should be able to get branding settings"
        )
        
        # Test update branding settings (admin only)
        branding_data = {
            "company_name": "Test Company",
            "primary_color": "#ff0000",
            "secondary_color": "#00ff00", 
            "accent_color": "#0000ff",
            "tagline": "Test Tagline",
            "address": "123 Test Street, Test City",
            "phone": "+1-555-123-4567",
            "email": "test@testcompany.com",
            "website": "https://testcompany.com"
        }
        
        success, response = self.run_test(
            "Update Branding Settings",
            "POST",
            "settings/branding",
            200,
            data=branding_data,
            headers=headers,
            description="Admin should be able to update branding settings"
        )
        
        # Test public branding endpoint (no auth required)
        success, response = self.run_test(
            "Get Public Branding",
            "GET",
            "public/branding",
            200,
            description="Public branding endpoint should work without authentication"
        )
        
        if success:
            # Verify the branding data was updated
            if response.get('company_name') == 'Test Company':
                print("✅ Branding data correctly updated and retrieved")
            else:
                print(f"❌ Branding data not updated correctly. Got: {response.get('company_name')}")
        
        return success, response

    def test_branding_viewer_access(self):
        """Test that viewer can read but not update branding settings"""
        if not self.viewer_token:
            print("❌ No viewer token available for branding access testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.viewer_token}'}
        
        # Viewer should be able to read branding settings
        success, response = self.run_test(
            "Viewer Get Branding Settings",
            "GET",
            "settings/branding",
            200,
            headers=headers,
            description="Viewer should be able to read branding settings"
        )
        
        # Viewer should NOT be able to update branding settings
        branding_data = {
            "company_name": "Unauthorized Update",
            "primary_color": "#ff0000"
        }
        
        self.run_test(
            "Viewer Update Branding Settings",
            "POST",
            "settings/branding",
            403,
            data=branding_data,
            headers=headers,
            description="Viewer should be denied access to update branding settings"
        )
        
        return success, response

    def test_logo_upload_functionality(self):
        """Test logo upload and retrieval functionality"""
        if not self.admin_token:
            print("❌ No admin token available for logo upload testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test logo upload endpoint exists (we'll test with a small dummy file)
        # First, let's test the branding settings endpoint to see current logo
        success, response = self.run_test(
            "Get Branding Settings Before Logo Upload",
            "GET",
            "settings/branding",
            200,
            headers=headers,
            description="Check current branding settings before logo upload"
        )
        
        if success:
            current_logo = response.get('logo_url')
            print(f"   Current logo URL: {current_logo}")
        
        # Test public branding endpoint (used by public invoice pages)
        success, response = self.run_test(
            "Get Public Branding Settings",
            "GET",
            "public/branding",
            200,
            description="Public branding endpoint should work without authentication"
        )
        
        if success:
            public_logo = response.get('logo_url')
            print(f"   Public logo URL: {public_logo}")
            
            # Check if logo URL is properly formatted for public access
            if public_logo and public_logo.startswith('/public/uploads/'):
                print("✅ Logo URL correctly formatted for public access")
            elif public_logo:
                print(f"❌ Logo URL not properly formatted for public access: {public_logo}")
        
        return success, response

    def test_send_invoice_functionality(self):
        """Test send invoice functionality"""
        if not self.admin_token:
            print("❌ No admin token available for send invoice testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # First create an invoice to send
        invoice_data = {
            "client_name": "Test Client for Email",
            "client_email": "test-client@example.com",
            "client_address": "123 Test St",
            "items": [
                {"description": "Test Service for Email", "quantity": 1, "price": 100.00}
            ],
            "notes": "Test invoice for email sending",
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Invoice for Send Test",
            "POST",
            "invoices",
            200,
            data=invoice_data,
            headers=headers,
            description="Create invoice to test send functionality"
        )
        
        if not success or 'id' not in response:
            print("❌ Cannot test send invoice without creating invoice first")
            return False, {}
        
        invoice_id = response['id']
        print(f"   Created invoice ID: {invoice_id}")
        
        # Test send invoice endpoint
        send_data = {
            "frontend_url": "https://invoice-payment-5.preview.emergentagent.com"
        }
        
        success, response = self.run_test(
            "Send Invoice Email",
            "POST",
            f"invoices/{invoice_id}/send",
            200,
            data=send_data,
            headers=headers,
            description="Should be able to send invoice email to client"
        )
        
        if success:
            payment_link = response.get('payment_link')
            if payment_link:
                print(f"✅ Payment link generated: {payment_link}")
            else:
                print("❌ No payment link returned in response")
        
        return success, response

    def test_public_invoice_access(self):
        """Test public invoice access functionality"""
        if not self.admin_token:
            print("❌ No admin token available for public invoice testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Create an invoice for public access testing
        invoice_data = {
            "client_name": "Public Test Client",
            "client_email": "public-test@example.com",
            "items": [
                {"description": "Public Test Service", "quantity": 1, "price": 50.00}
            ],
            "status": "sent"
        }
        
        success, response = self.run_test(
            "Create Invoice for Public Access Test",
            "POST",
            "invoices",
            200,
            data=invoice_data,
            headers=headers,
            description="Create invoice to test public access"
        )
        
        if not success or 'id' not in response:
            print("❌ Cannot test public invoice access without creating invoice first")
            return False, {}
        
        invoice_id = response['id']
        print(f"   Created public invoice ID: {invoice_id}")
        
        # Test public invoice access (no authentication required)
        success, response = self.run_test(
            "Access Public Invoice",
            "GET",
            f"public/invoices/{invoice_id}",
            200,
            description="Should be able to access invoice publicly without authentication"
        )
        
        if success:
            # Check if invoice data is properly returned
            if response.get('invoice_number') and response.get('client_name'):
                print("✅ Public invoice data correctly returned")
            else:
                print("❌ Public invoice data incomplete")
                
            # Check if PayPal client ID is included (if configured)
            paypal_client_id = response.get('paypal_client_id')
            if paypal_client_id:
                print(f"✅ PayPal client ID included for payments: {paypal_client_id[:10]}...")
            else:
                print("ℹ️  No PayPal client ID (PayPal not configured)")
        
        return success, response

    def test_public_logo_serving(self):
        """Test public logo serving endpoint"""
        # Test public logo endpoint (should only allow company logo files)
        success, response = self.run_test(
            "Access Public Logo Endpoint - Invalid File",
            "GET",
            "public/uploads/invalid_file.jpg",
            403,
            description="Should deny access to non-logo files"
        )
        
        # Test with company logo filename (even if file doesn't exist, should get 404 not 403)
        success, response = self.run_test(
            "Access Public Logo Endpoint - Valid Logo Name",
            "GET",
            "public/uploads/company_logo.png",
            404,  # File not found is expected if no logo uploaded
            description="Should allow access to company logo files (404 if not exists)"
        )
        
        return success, response

    def test_quote_pdf_download(self):
        """Test quote PDF download functionality (Bug Fix #1)"""
        if not self.admin_token:
            print("❌ No admin token available for quote PDF testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # First create a quote to download PDF from
        quote_data = {
            "client_name": "PDF Test Client",
            "client_email": "pdf-test@example.com",
            "client_address": "123 PDF St",
            "items": [
                {"description": "PDF Test Service", "quantity": 1, "price": 150.00}
            ],
            "notes": "Test quote for PDF download",
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Quote for PDF Test",
            "POST",
            "quotes",
            200,
            data=quote_data,
            headers=headers,
            description="Create quote to test PDF download"
        )
        
        if not success or 'id' not in response:
            print("❌ Cannot test PDF download without creating quote first")
            return False, {}
        
        quote_id = response['id']
        print(f"   Created quote ID: {quote_id}")
        
        # Test PDF download endpoint - should return PDF file
        url = f"{self.base_url}/api/quotes/{quote_id}/pdf"
        try:
            import requests
            response = requests.get(url, headers=headers, timeout=30)
            
            self.tests_run += 1
            print(f"\n🔍 Testing Quote PDF Download...")
            print(f"   Description: Should return PDF file for quote {quote_id}")
            
            if response.status_code == 200:
                # Check if response is actually a PDF
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    self.tests_passed += 1
                    print(f"✅ Passed - Status: {response.status_code}, Content-Type: {content_type}")
                    print(f"   PDF size: {len(response.content)} bytes")
                    return True, {"content_length": len(response.content)}
                else:
                    print(f"❌ Failed - Expected PDF content-type, got {content_type}")
                    self.failed_tests.append({
                        "name": "Quote PDF Download",
                        "expected": "application/pdf",
                        "actual": content_type,
                        "endpoint": f"quotes/{quote_id}/pdf"
                    })
                    return False, {}
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "name": "Quote PDF Download",
                    "expected": 200,
                    "actual": response.status_code,
                    "endpoint": f"quotes/{quote_id}/pdf"
                })
                return False, {}
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.tests_run += 1
            self.failed_tests.append({
                "name": "Quote PDF Download",
                "error": str(e),
                "endpoint": f"quotes/{quote_id}/pdf"
            })
            return False, {}

    def test_quote_send_email(self):
        """Test quote send email functionality (Bug Fix #2)"""
        if not self.admin_token:
            print("❌ No admin token available for quote email testing")
            return False, {}

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # First create a quote to send email
        quote_data = {
            "client_name": "Email Test Client",
            "client_email": "email-test@example.com",
            "client_address": "123 Email St",
            "items": [
                {"description": "Email Test Service", "quantity": 1, "price": 200.00}
            ],
            "notes": "Test quote for email sending",
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Quote for Email Test",
            "POST", 
            "quotes",
            200,
            data=quote_data,
            headers=headers,
            description="Create quote to test email sending"
        )
        
        if not success or 'id' not in response:
            print("❌ Cannot test send email without creating quote first")
            return False, {}
        
        quote_id = response['id']
        print(f"   Created quote ID: {quote_id}")
        
        # Test send email endpoint - should return proper response
        # (400 if SMTP not configured, 200 if configured)
        send_data = {"frontend_url": self.base_url}
        
        success, response = self.run_test(
            "Send Quote Email",
            "POST",
            f"quotes/{quote_id}/send-email",
            [200, 400],  # Both are acceptable responses
            data=send_data,
            headers=headers,
            description="Should return proper response (400 if SMTP not configured, 200 if configured)"
        )
        
        return success, response

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, description=""):
        """Run a single API test - updated to handle list of expected status codes"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   Description: {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            # Handle both single status code and list of status codes
            if isinstance(expected_status, list):
                success = response.status_code in expected_status
                expected_display = f"one of {expected_status}"
            else:
                success = response.status_code == expected_status
                expected_display = str(expected_status)

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_display}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "name": name,
                    "expected": expected_display,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "name": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting KyberBusiness API Tests")
        print("=" * 50)
        
        # Basic connectivity
        self.test_health_check()
        
        # Authentication and authorization
        self.test_user_registration_admin()
        self.test_user_registration_viewer()
        self.test_login_functionality()
        self.test_protected_endpoint_without_auth()
        
        # Role-based access control
        self.test_admin_endpoints()
        self.test_viewer_admin_access()
        
        # CRUD operations
        self.test_quotes_crud()
        self.test_invoices_crud()
        self.test_categories_and_vendors()
        self.test_expenses_crud()
        
        # Reports and settings
        self.test_reports_endpoints()
        self.test_settings_endpoints()
        
        # Branding functionality
        self.test_branding_endpoints()
        self.test_branding_viewer_access()
        
        # Logo upload and send invoice functionality (new tests)
        self.test_logo_upload_functionality()
        self.test_send_invoice_functionality()
        self.test_public_invoice_access()
        self.test_public_logo_serving()
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests ({len(self.failed_tests)}):")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                print(f"  - {test['name']}: {error_msg}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = KyberBusinessAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())