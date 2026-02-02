# KyberBusiness - Product Requirements Document

## Original Problem Statement
Building KyberBusiness - an alternative to tools like InvoiceNinja for quoting, invoicing, and tracking expenses. Includes reports for revenue, expenses, etc with adjustable timeframes. Support for SMTP setup, customizable email templates (5 pre-built themes), PayPal integration for receiving payments. Expense tracker with categories, vendors, and receipt upload (10MB images). Material U theme with cyan/magenta coloring, crystal financial logo. Docker deployment on Unraid with PWA support.

## User Personas
1. **Small Business Owner** - Creates invoices, tracks expenses, monitors profitability
2. **Freelancer** - Generates quotes and invoices for clients
3. **Accountant** - Manages financial records, categorizes expenses
4. **Viewer** - Read-only access to financial data

## Core Requirements (Static)
- [x] User authentication with JWT
- [x] Email verification for new accounts
- [x] Auto-admin for @thestarforge.org email domains
- [x] Role-based access (Admin, Accountant, Viewer)
- [x] Quote creation and management
- [x] Invoice creation with PayPal payment integration
- [x] Expense tracking with categories and vendors
- [x] Receipt upload (10MB limit)
- [x] SMTP configuration (encrypted storage)
- [x] PayPal credentials (encrypted storage)
- [x] 5 email templates (Professional, Modern, Minimal, Bold, Classic)
- [x] Reports: Revenue, Expenses, Profit/Loss
- [x] PWA manifest for Chrome Android

## What's Been Implemented

### Jan 2026 - MVP Launch
- Complete authentication system with JWT
- Role-based access control (Admin/Accountant/Viewer)
- Auto-admin detection for @thestarforge.org emails
- Quote CRUD operations with convert-to-invoice feature
- Invoice CRUD with public payment page
- Expense tracking with categories and vendors
- Receipt image upload (10MB limit)
- Dashboard with Recharts (Revenue vs Expenses, Category breakdown)
- Settings page with SMTP and PayPal configuration (encrypted)
- 5 email templates pre-loaded
- Admin panel for user management
- Material U theme with cyan/magenta coloring
- Responsive design for desktop and mobile
- PWA manifest configured

## Prioritized Backlog

### P0 - Critical
- Email verification emails (requires SMTP configuration)
- PayPal webhook verification for payments

### P1 - Important  
- Quote/Invoice PDF export
- Email sending with templates
- Receipt OCR for expense data extraction
- Multi-currency support

### P2 - Nice to Have
- Dashboard notifications
- Recurring invoices
- Client portal
- Bank account integration

## Technology Stack
- **Frontend**: React 18, Tailwind CSS, Recharts, Shadcn/UI
- **Backend**: FastAPI, MongoDB
- **Auth**: JWT with bcrypt password hashing
- **Encryption**: Fernet (cryptography library)
- **Payments**: PayPal JS SDK (client-side)

## Environment Variables Required
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `JWT_SECRET` - Secret for JWT tokens
- `ENCRYPTION_KEY` - Fernet key for credential encryption

## Next Tasks
1. Configure SMTP to enable email verification
2. Add PayPal credentials to enable invoice payments
3. Implement PDF export for invoices/quotes
4. Add email sending functionality with templates
