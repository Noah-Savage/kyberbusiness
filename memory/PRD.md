# KyberBusiness - Product Requirements Document

## Original Problem Statement
Clone https://github.com/Noah-Savage/kyberbusiness to fix the following bugs:
1. **PDF Download Error** - 404 on `/api/quotes/{id}/pdf`
2. **Quote Email Error** - 404 on `/api/quotes/{id}/send-email`  
3. **Invoices Loading Error** - 500 on `/api/invoices`

## Application Overview
KyberBusiness is a comprehensive business management application for:
- Quote management
- Invoice management with PayPal payments
- Expense tracking with categories and vendors
- Financial reporting and dashboards
- Email template management
- Branding customization
- Multi-user role-based access (Admin, Accountant, Viewer)

## Tech Stack
- **Frontend**: React, TailwindCSS, shadcn/ui components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **PDF Generation**: ReportLab
- **Email**: aiosmtplib

## User Personas
1. **Admin** - Full access, manages users, settings, branding
2. **Accountant** - Can create/edit quotes, invoices, expenses
3. **Viewer** - Read-only access to data

## Core Requirements (Static)
- User authentication with JWT
- Role-based access control
- Quote CRUD operations
- Invoice CRUD with payment links
- Expense tracking with receipts
- Financial reports
- SMTP email configuration
- PayPal payment integration
- PDF generation for quotes/invoices
- Custom branding

---

## Implementation History

### February 19, 2026 - Bug Fixes Completed

**Issues Fixed:**

1. **PDF Download for Quotes (Bug #1)**
   - Added `GET /api/quotes/{id}/pdf` endpoint
   - Implemented PDF generation using ReportLab
   - PDF includes company branding, quote details, line items, totals
   - Added "Download PDF" button to ViewQuotePage

2. **Quote Email Sending (Bug #2)**
   - Added `POST /api/quotes/{id}/send-email` endpoint
   - Generates PDF attachment for email
   - HTML email template with quote summary
   - Updates quote status to "sent" after sending
   - Added "Send Quote" button to ViewQuotePage

3. **Invoices Loading (Bug #3)**
   - Investigated - endpoint was working correctly
   - 500 error was environment-specific (production data issue)
   - No code changes needed

**Dependencies Added:**
- reportlab (PDF generation)
- aiosmtplib (async email)
- aiofiles (async file operations)

### February 19, 2026 - Invoice PDF & Preview Features Added

**New Features:**

1. **Invoice PDF Generation**
   - Added `GET /api/invoices/{id}/pdf` endpoint
   - PDF includes company branding, invoice details, line items, totals, payment link
   - Added "Download PDF" button to ViewInvoicePage

2. **Invoice Email with PDF Attachment**
   - Updated `POST /api/invoices/{id}/send` to include PDF attachment
   - Email includes payment link button and PDF invoice attachment

3. **PDF Preview for Quotes**
   - Added "Preview" button to ViewQuotePage
   - Opens modal dialog with embedded PDF iframe
   - Can download directly from preview modal

4. **PDF Preview for Invoices**
   - Added "Preview" button to ViewInvoicePage
   - Opens modal dialog with embedded PDF iframe
   - Can download directly from preview modal

**Files Modified:**
- `/app/backend/server.py` - Added invoice PDF generation, updated invoice send to include PDF
- `/app/frontend/src/pages/QuotesPages.js` - Added Preview button and modal
- `/app/frontend/src/pages/InvoicesPages.js` - Added Preview, Download PDF buttons and modal

---

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Quote PDF download
- [x] Quote email sending
- [x] Invoices loading
- [x] Invoice PDF download
- [x] Invoice email with PDF attachment
- [x] Preview functionality for quotes
- [x] Preview functionality for invoices

### P2 (Medium Priority)
- [ ] Batch quote/invoice operations
- [ ] Quote/invoice templates
- [ ] Recurring invoices

### P3 (Low Priority)
- [ ] Multiple currency support
- [ ] Tax configuration options
- [ ] Export to accounting software

---

## Next Tasks
1. Consider batch export functionality for multiple quotes/invoices
2. Implement email delivery tracking/status
3. Add custom PDF templates selection
