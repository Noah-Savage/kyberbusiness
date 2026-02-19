# KyberBusiness PRD

## Original Problem Statement
Clone the GitHub repo (https://github.com/Noah-Savage/kyberbusiness) and:
1. Fix the issue with uploading logos - upload succeeds but logo doesn't display correctly in invoices or webUI
2. Add ability to send invoice emails with payment link to clients
3. Compile a zip folder for Unraid Docker deployment

## Architecture
- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Deployment**: Docker Compose (3 containers: frontend, backend, mongodb)

## User Personas
- **Admin**: Full access, configure settings (SMTP, PayPal, branding)
- **Accountant**: Create/edit quotes, invoices, expenses
- **Viewer**: Read-only access to data

## Core Requirements (Static)
- Invoice/Quote management with PDF generation
- Expense tracking with receipt uploads
- Multi-user role-based access
- PayPal payment integration
- Custom branding (logo, colors, company info)
- Email templates for invoice delivery

## What's Been Implemented (Feb 2, 2026)

### Bug Fixes
1. **Logo Display Fix**
   - Root cause: Logo URL stored as `/api/uploads/{filename}`, but frontend used `API_URL + logo_url` creating double `/api/api/...` path
   - Fix: Changed logo URL storage to `/uploads/{filename}` without `/api` prefix
   - Added public endpoint `/api/public/uploads/{filename}` for unauthenticated access to logos on public invoice pages

2. **Send Invoice Feature**
   - Added `POST /api/invoices/{invoice_id}/send` endpoint
   - Sends email to client with payment link using configured email template
   - Auto-updates invoice status from "draft" to "sent"
   - Added "Send Invoice" button on invoice view page

### Docker Deployment Package
- Created `/app/kyberbusiness-docker-deploy.zip` with all files needed for `docker compose up`
- Includes `.env.example`, README.md with setup instructions
- Maintains original folder paths from docker-deploy directory

## Files Modified
- `/app/backend/server.py` - Logo URL fixes, public uploads endpoint, send invoice API
- `/app/frontend/src/pages/InvoicesPages.js` - Send Invoice button
- `/app/docker-deploy/backend/server.py` - Synced with main backend
- `/app/docker-deploy/frontend/src/pages/*.js` - Synced frontend files

## Testing Status
- Backend: 94.7% tests passed
- Frontend: 90% tests passed
- Logo upload and display: Working
- Send Invoice: Working (requires SMTP configuration)

## Backlog / Future Features
- P1: Quote sending via email
- P2: Invoice reminders for overdue payments
- P2: Multi-currency support
- P3: Client portal with invoice history

## Next Action Items
- Deploy to Unraid using the zip package
- Configure SMTP settings for email functionality
- Configure PayPal credentials for payment processing
