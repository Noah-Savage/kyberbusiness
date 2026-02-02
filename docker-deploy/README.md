# KyberBusiness - Docker Deployment

A professional invoicing, quoting, and expense tracking application.

## Quick Start

1. **Generate secure keys:**
   ```bash
   # Generate JWT secret
   openssl rand -hex 32
   
   # Generate encryption key (requires Python with cryptography)
   python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

2. **Create your .env file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your generated keys
   ```

3. **Ensure data directory exists:**
   ```bash
   mkdir -p /mnt/user/appdata/kyberbusiness/data/mongodb
   mkdir -p /mnt/user/appdata/kyberbusiness/data/uploads
   ```

4. **Build and run:**
   ```bash
   docker compose up -d --build
   ```

5. **Access the application:**
   - Open http://your-server-ip:11131 in your browser

## First Time Setup

1. Register an account at `/register`
2. **Admin Access:** Register with an `@thestarforge.org` email to get admin privileges
3. Go to Settings to configure:
   - **Branding:** Upload logo, set company name and colors
   - **SMTP:** Configure email sending
   - **PayPal:** Add PayPal credentials for invoice payments

## Features

- **Quotes & Invoices:** Create, edit, and track quotes/invoices
- **Expense Tracking:** Categories, vendors, receipt uploads (10MB max)
- **Reports:** Revenue, expenses, and profit/loss dashboards
- **Multi-user:** Admin, Accountant, and Viewer roles
- **Branding:** Custom logo, colors, and company info
- **PayPal Integration:** Accept payments directly on invoices
- **Email Templates:** 5 pre-built themes for invoice emails
- **PWA Support:** Install as an app on mobile devices

## Data Storage

All data is stored in `/mnt/user/appdata/kyberbusiness/data/`:
- `mongodb/` - Database files
- `uploads/` - Receipt images and company logo

## Updating

```bash
docker compose down
docker compose pull
docker compose up -d --build
```

## Backup

Backup the entire `/mnt/user/appdata/kyberbusiness/data/` directory.

## Ports

- **11131:** Web interface (frontend + API)
- Internal: MongoDB (27017), Backend API (8001)

## Troubleshooting

**View logs:**
```bash
docker compose logs -f
docker compose logs backend
docker compose logs frontend
```

**Restart services:**
```bash
docker compose restart
```

**Reset everything:**
```bash
docker compose down -v
rm -rf /mnt/user/appdata/kyberbusiness/data/*
docker compose up -d --build
```
