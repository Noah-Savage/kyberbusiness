import requests
import sys
import json
from datetime import datetime

class KyberBusinessTester:
    def __init__(self, base_url="https://kyber-fixes.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.quote_id = None
        self.invoice_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        if self.token:
            request_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            request_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=request_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=request_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=request_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.content:
                    try:
                        return success, response.json()
                    except:
                        return success, response.text
                return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test login and get token"""
        # Register first with admin email (assuming fresh system)
        success, response = self.run_test(
            "Register Admin User",
            "POST",
            "auth/register",
            200,
            data={
                "email": "admin@thestarforge.org", 
                "password": "TestPass123!", 
                "name": "Test Admin"
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        else:
            # Try login instead
            success, response = self.run_test(
                "Login Admin User",
                "POST", 
                "auth/login",
                200,
                data={"email": "admin@thestarforge.org", "password": "TestPass123!"}
            )
            if success and 'access_token' in response:
                self.token = response['access_token']
                print(f"   Token obtained: {self.token[:20]}...")
                return True
        return False

    def test_pdf_templates(self):
        """Test GET /api/pdf-templates - should return 4 templates"""
        success, response = self.run_test(
            "Get PDF Templates",
            "GET",
            "pdf-templates",
            200
        )
        
        if success and isinstance(response, list):
            if len(response) == 4:
                template_names = [t['name'] for t in response]
                expected_names = ['Professional', 'Modern', 'Classic', 'Minimal']
                if all(name in template_names for name in expected_names):
                    print(f"   ✅ Found all 4 expected templates: {template_names}")
                    return True
                else:
                    print(f"   ❌ Missing expected templates. Found: {template_names}")
            else:
                print(f"   ❌ Expected 4 templates, found {len(response)}")
        
        return False

    def test_create_quote(self):
        """Create a test quote for PDF testing"""
        success, response = self.run_test(
            "Create Test Quote",
            "POST",
            "quotes",
            200,
            data={
                "client_name": "Test Client",
                "client_email": "client@test.com",
                "client_address": "123 Test St",
                "items": [{"description": "Test Service", "quantity": 1, "price": 100.0}],
                "notes": "Test quote for PDF generation",
                "status": "draft"
            }
        )
        
        if success and 'id' in response:
            self.quote_id = response['id']
            print(f"   Quote ID: {self.quote_id}")
            return True
        return False

    def test_create_invoice(self):
        """Create a test invoice for PDF testing"""
        success, response = self.run_test(
            "Create Test Invoice",
            "POST",
            "invoices",
            200,
            data={
                "client_name": "Test Client",
                "client_email": "client@test.com", 
                "client_address": "123 Test St",
                "items": [{"description": "Test Service", "quantity": 1, "price": 100.0}],
                "notes": "Test invoice for PDF generation",
                "status": "draft"
            }
        )
        
        if success and 'id' in response:
            self.invoice_id = response['id']
            print(f"   Invoice ID: {self.invoice_id}")
            return True
        return False

    def test_quote_pdf_with_template(self, template):
        """Test quote PDF generation with template parameter"""
        if not self.quote_id:
            print("   ❌ No quote ID available")
            return False
            
        success, response = self.run_test(
            f"Get Quote PDF ({template} template)",
            "GET",
            f"quotes/{self.quote_id}/pdf?template={template}",
            200
        )
        
        return success

    def test_invoice_pdf_with_template(self, template):
        """Test invoice PDF generation with template parameter"""
        if not self.invoice_id:
            print("   ❌ No invoice ID available") 
            return False
            
        success, response = self.run_test(
            f"Get Invoice PDF ({template} template)",
            "GET",
            f"invoices/{self.invoice_id}/pdf?template={template}",
            200
        )
        
        return success

    def test_quote_send_email_error(self):
        """Test quote email sending - should return 400 if SMTP not configured"""
        if not self.quote_id:
            print("   ❌ No quote ID available")
            return False
            
        success, response = self.run_test(
            "Send Quote Email (expect SMTP error)",
            "POST",
            f"quotes/{self.quote_id}/send-email",
            400,  # Expecting 400 because SMTP not configured
            data={"template": "professional"}
        )
        
        return success

    def test_invoice_send_email_error(self):
        """Test invoice email sending - should return 400 if SMTP not configured"""
        if not self.invoice_id:
            print("   ❌ No invoice ID available")
            return False
            
        success, response = self.run_test(
            "Send Invoice Email (expect SMTP error)", 
            "POST",
            f"invoices/{self.invoice_id}/send",
            400,  # Expecting 400 because SMTP not configured
            data={"frontend_url": "https://test.com", "template": "professional"}
        )
        
        return success

def main():
    print("🚀 Starting KyberBusiness Backend API Tests\n")
    print("="*50)
    
    tester = KyberBusinessTester()
    
    # Test authentication first
    print("\n📋 AUTHENTICATION TESTS")
    print("-"*30)
    if not tester.test_login():
        print("❌ Authentication failed, stopping tests")
        return 1

    # Test PDF templates endpoint
    print("\n📋 PDF TEMPLATES TESTS") 
    print("-"*30)
    tester.test_pdf_templates()

    # Create test data
    print("\n📋 TEST DATA CREATION")
    print("-"*30)
    tester.test_create_quote()
    tester.test_create_invoice()

    # Test PDF generation with templates
    print("\n📋 PDF GENERATION TESTS")
    print("-"*30)
    templates = ["modern", "classic"]
    for template in templates:
        if tester.quote_id:
            tester.test_quote_pdf_with_template(template)
        if tester.invoice_id:
            tester.test_invoice_pdf_with_template(template)

    # Test email sending error handling
    print("\n📋 EMAIL ERROR HANDLING TESTS")
    print("-"*30)
    tester.test_quote_send_email_error()
    tester.test_invoice_send_email_error()

    # Print results
    print("\n" + "="*50)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())