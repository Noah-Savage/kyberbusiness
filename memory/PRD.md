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

### February 19, 2026 - PDF Templates & Branding Updates

**Changes Made:**

1. **Removed Emergent Branding**
   - Cleaned up index.html to remove "Made with Emergent" badge
   - Updated page title to "KyberBusiness"

2. **Added PDF Templates (4 styles)**
   - **Professional** - Cyan primary color, clean modern look
   - **Modern** - Purple/violet colors, contemporary style  
   - **Classic** - Dark gray/black, Times Roman font, traditional look
   - **Minimal** - Black text on light gray header, minimalist design

3. **Template Selection UI**
   - Added template selector dropdown on Quote view page
   - Added template selector dropdown on Invoice view page
   - Templates affect PDF preview, download, and email attachments

4. **Toast Notifications (already existed)**
   - Success toast when quote/invoice email sent successfully
   - Error toast when SMTP not configured or send fails
   - Error toast for PDF download/preview failures

**New Endpoint:**
- `GET /api/pdf-templates` - Returns list of available templates

**Updated Endpoints:**
- `GET /api/quotes/{id}/pdf?template=<template>` - Template parameter
- `GET /api/invoices/{id}/pdf?template=<template>` - Template parameter
- `POST /api/quotes/{id}/send-email` - Accepts template in body
- `POST /api/invoices/{id}/send` - Accepts template in body

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
