from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from cryptography.fernet import Fernet
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import base64
import secrets
import aiofiles
from bson import ObjectId
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Encryption key for storing sensitive credentials
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# Create the main app
app = FastAPI(title="KyberBusiness API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserRole:
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    VIEWER = "viewer"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    email_verified: bool
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class QuoteCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    client_address: Optional[str] = ""
    items: List[Dict[str, Any]]
    notes: Optional[str] = ""
    valid_until: Optional[str] = None
    status: str = "draft"

class QuoteResponse(BaseModel):
    id: str
    quote_number: str
    client_name: str
    client_email: str
    client_address: str
    items: List[Dict[str, Any]]
    subtotal: float
    tax: float
    total: float
    notes: str
    valid_until: Optional[str]
    status: str
    created_at: str
    created_by: str

class InvoiceCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    client_address: Optional[str] = ""
    items: List[Dict[str, Any]]
    notes: Optional[str] = ""
    due_date: Optional[str] = None
    status: str = "draft"

class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    client_name: str
    client_email: str
    client_address: str
    items: List[Dict[str, Any]]
    subtotal: float
    tax: float
    total: float
    notes: str
    due_date: Optional[str]
    status: str
    payment_link: Optional[str]
    created_at: str
    created_by: str

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category_id: str
    vendor_id: Optional[str] = None
    date: str
    notes: Optional[str] = ""

class ExpenseResponse(BaseModel):
    id: str
    description: str
    amount: float
    category_id: str
    category_name: str
    vendor_id: Optional[str]
    vendor_name: Optional[str]
    date: str
    notes: str
    receipt_url: Optional[str]
    created_at: str
    created_by: str

class CategoryCreate(BaseModel):
    name: str
    color: str = "#06b6d4"

class CategoryResponse(BaseModel):
    id: str
    name: str
    color: str

class VendorCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""

class VendorResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    address: str

class SMTPSettings(BaseModel):
    host: str
    port: int
    username: str
    password: str
    from_email: str
    from_name: str
    use_tls: bool = True

class PayPalSettings(BaseModel):
    client_id: str
    client_secret: str
    sandbox: bool = True

class EmailTemplateCreate(BaseModel):
    name: str
    theme: str  # professional, modern, minimal, bold, classic
    subject: str
    body_html: str

class BrandingSettings(BaseModel):
    company_name: str
    primary_color: str = "#06b6d4"
    secondary_color: str = "#d946ef"
    accent_color: str = "#10b981"
    tagline: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""

class EmailTemplateResponse(BaseModel):
    id: str
    name: str
    theme: str
    subject: str
    body_html: str
    is_default: bool

class ReportRequest(BaseModel):
    start_date: str
    end_date: str

class RoleUpdate(BaseModel):
    role: str

# ==================== HELPER FUNCTIONS ====================

def encrypt_data(data: str) -> str:
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    return cipher_suite.decrypt(encrypted_data.encode()).decode()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        if not credentials or not credentials.credentials:
            raise HTTPException(status_code=401, detail="Missing authentication token")
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_accountant_or_admin(user: dict = Depends(get_current_user)):
    if user.get("role") not in [UserRole.ADMIN, UserRole.ACCOUNTANT]:
        raise HTTPException(status_code=403, detail="Accountant or Admin access required")
    return user

def generate_number(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

def calculate_totals(items: List[Dict[str, Any]]) -> tuple:
    subtotal = sum(item.get("quantity", 1) * item.get("price", 0) for item in items)
    tax = subtotal * 0.1  # 10% tax
    total = subtotal + tax
    return subtotal, tax, total

async def send_email(to_email: str, subject: str, body_html: str):
    settings = await db.settings.find_one({"type": "smtp"}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="SMTP not configured")
    
    try:
        smtp_config = settings.get("data", {})
        message = MIMEMultipart("alternative")
        message["From"] = f"{smtp_config.get('from_name', 'KyberBusiness')} <{smtp_config.get('from_email')}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(body_html, "html"))
        
        await aiosmtplib.send(
            message,
            hostname=smtp_config.get("host"),
            port=smtp_config.get("port"),
            username=smtp_config.get("username"),
            password=decrypt_data(smtp_config.get("password")),
            use_tls=smtp_config.get("use_tls", True)
        )
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate, background_tasks: BackgroundTasks):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Determine role based on email domain
    is_admin = data.email.endswith("@thestarforge.org")
    role = UserRole.ADMIN if is_admin else UserRole.VIEWER
    
    user_id = str(uuid.uuid4())
    verification_token = secrets.token_urlsafe(32)
    
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password": hash_password(data.password),
        "role": role,
        "email_verified": False,
        "verification_token": verification_token,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Queue verification email
    # background_tasks.add_task(send_verification_email, data.email, verification_token)
    
    token = create_token(user_id, data.email, role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=data.email,
            name=data.name,
            role=role,
            email_verified=False,
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            email_verified=user.get("email_verified", False),
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/verify-email")
async def verify_email(token: str = Query(...)):
    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"email_verified": True}, "$unset": {"verification_token": ""}}
    )
    
    return {"message": "Email verified successfully"}

@api_router.post("/auth/resend-verification")
async def resend_verification(background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    verification_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"verification_token": verification_token}}
    )
    
    # background_tasks.add_task(send_verification_email, user["email"], verification_token)
    return {"message": "Verification email sent"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        email_verified=user.get("email_verified", False),
        created_at=user["created_at"]
    )

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/users", response_model=List[UserResponse])
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0, "verification_token": 0}).to_list(1000)
    return [UserResponse(
        id=u["id"],
        email=u["email"],
        name=u["name"],
        role=u["role"],
        email_verified=u.get("email_verified", False),
        created_at=u["created_at"]
    ) for u in users]

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, data: RoleUpdate, admin: dict = Depends(require_admin)):
    if data.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": data.role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated successfully"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# ==================== QUOTES ROUTES ====================

@api_router.post("/quotes", response_model=QuoteResponse)
async def create_quote(data: QuoteCreate, user: dict = Depends(require_accountant_or_admin)):
    subtotal, tax, total = calculate_totals(data.items)
    quote_id = str(uuid.uuid4())
    
    quote_doc = {
        "id": quote_id,
        "quote_number": generate_number("QT"),
        "client_name": data.client_name,
        "client_email": data.client_email,
        "client_address": data.client_address or "",
        "items": data.items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "notes": data.notes or "",
        "valid_until": data.valid_until,
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.quotes.insert_one(quote_doc)
    
    return QuoteResponse(**{k: v for k, v in quote_doc.items() if k != "_id"})

@api_router.get("/quotes", response_model=List[QuoteResponse])
async def list_quotes(user: dict = Depends(get_current_user)):
    quotes = await db.quotes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [QuoteResponse(**q) for q in quotes]

@api_router.get("/quotes/{quote_id}", response_model=QuoteResponse)
async def get_quote(quote_id: str, user: dict = Depends(get_current_user)):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return QuoteResponse(**quote)

@api_router.put("/quotes/{quote_id}", response_model=QuoteResponse)
async def update_quote(quote_id: str, data: QuoteCreate, user: dict = Depends(require_accountant_or_admin)):
    subtotal, tax, total = calculate_totals(data.items)
    
    update_doc = {
        "client_name": data.client_name,
        "client_email": data.client_email,
        "client_address": data.client_address or "",
        "items": data.items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "notes": data.notes or "",
        "valid_until": data.valid_until,
        "status": data.status
    }
    
    result = await db.quotes.update_one({"id": quote_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    return QuoteResponse(**quote)

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user: dict = Depends(require_accountant_or_admin)):
    result = await db.quotes.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"message": "Quote deleted successfully"}

@api_router.post("/quotes/{quote_id}/convert-to-invoice", response_model=InvoiceResponse)
async def convert_quote_to_invoice(quote_id: str, user: dict = Depends(require_accountant_or_admin)):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    invoice_id = str(uuid.uuid4())
    invoice_doc = {
        "id": invoice_id,
        "invoice_number": generate_number("INV"),
        "client_name": quote["client_name"],
        "client_email": quote["client_email"],
        "client_address": quote["client_address"],
        "items": quote["items"],
        "subtotal": quote["subtotal"],
        "tax": quote["tax"],
        "total": quote["total"],
        "notes": quote["notes"],
        "due_date": None,
        "status": "draft",
        "payment_link": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.invoices.insert_one(invoice_doc)
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "converted"}})
    
    return InvoiceResponse(**{k: v for k, v in invoice_doc.items() if k != "_id"})

# PDF Template definitions
PDF_TEMPLATES = {
    "professional": {
        "name": "Professional",
        "primary_color": "#06b6d4",
        "secondary_color": "#0891b2",
        "header_bg": "#06b6d4",
        "font": "Helvetica"
    },
    "modern": {
        "name": "Modern",
        "primary_color": "#8b5cf6",
        "secondary_color": "#7c3aed",
        "header_bg": "#8b5cf6",
        "font": "Helvetica"
    },
    "classic": {
        "name": "Classic",
        "primary_color": "#1f2937",
        "secondary_color": "#374151",
        "header_bg": "#1f2937",
        "font": "Times-Roman"
    },
    "minimal": {
        "name": "Minimal",
        "primary_color": "#000000",
        "secondary_color": "#6b7280",
        "header_bg": "#f3f4f6",
        "font": "Helvetica"
    }
}

# Helper function to generate PDF for quotes
def generate_quote_pdf(quote: dict, branding: dict = None, template: str = "professional") -> BytesIO:
    """Generate a PDF for a quote with template support"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    # Get template settings
    tmpl = PDF_TEMPLATES.get(template, PDF_TEMPLATES["professional"])
    primary_color = colors.HexColor(branding.get("primary_color", tmpl["primary_color"])) if branding else colors.HexColor(tmpl["primary_color"])
    header_bg = colors.HexColor(tmpl["header_bg"])
    text_color = colors.white if template != "minimal" else colors.HexColor("#1f2937")
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Company name / title
    company_name = branding.get("company_name", "KyberBusiness") if branding else "KyberBusiness"
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=primary_color, fontName=tmpl["font"])
    elements.append(Paragraph(company_name, title_style))
    
    # Quote header
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=18, spaceAfter=12, fontName=tmpl["font"])
    elements.append(Paragraph(f"QUOTE: {quote['quote_number']}", header_style))
    elements.append(Spacer(1, 12))
    
    # Client info
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontName=tmpl["font"])
    elements.append(Paragraph(f"<b>Client:</b> {quote['client_name']}", normal_style))
    elements.append(Paragraph(f"<b>Email:</b> {quote['client_email']}", normal_style))
    if quote.get('client_address'):
        elements.append(Paragraph(f"<b>Address:</b> {quote['client_address']}", normal_style))
    elements.append(Paragraph(f"<b>Date:</b> {quote['created_at'][:10]}", normal_style))
    if quote.get('valid_until'):
        elements.append(Paragraph(f"<b>Valid Until:</b> {quote['valid_until']}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Items table
    table_data = [['Description', 'Qty', 'Price', 'Total']]
    for item in quote['items']:
        qty = item.get('quantity', 1)
        price = item.get('price', 0)
        total = qty * price
        table_data.append([
            item.get('description', ''),
            str(qty),
            f"${price:.2f}",
            f"${total:.2f}"
        ])
    
    # Add totals
    table_data.append(['', '', 'Subtotal:', f"${quote['subtotal']:.2f}"])
    table_data.append(['', '', 'Tax (10%):', f"${quote['tax']:.2f}"])
    table_data.append(['', '', 'Total:', f"${quote['total']:.2f}"])
    
    table = Table(table_data, colWidths=[3.5*inch, 0.75*inch, 1*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), text_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), f'{tmpl["font"]}-Bold' if tmpl["font"] == "Helvetica" else tmpl["font"]),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -4), colors.white),
        ('GRID', (0, 0), (-1, -4), 1, colors.lightgrey),
        ('FONTNAME', (2, -3), (2, -1), f'{tmpl["font"]}-Bold' if tmpl["font"] == "Helvetica" else tmpl["font"]),
        ('FONTNAME', (3, -1), (3, -1), f'{tmpl["font"]}-Bold' if tmpl["font"] == "Helvetica" else tmpl["font"]),
        ('TEXTCOLOR', (3, -1), (3, -1), primary_color),
    ]))
    elements.append(table)
    
    # Notes
    if quote.get('notes'):
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("<b>Notes:</b>", normal_style))
        elements.append(Paragraph(quote['notes'], normal_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

@api_router.get("/pdf-templates")
async def get_pdf_templates(user: dict = Depends(get_current_user)):
    """Get available PDF templates"""
    return [{"id": k, "name": v["name"]} for k, v in PDF_TEMPLATES.items()]

@api_router.get("/quotes/{quote_id}/pdf")
async def get_quote_pdf(quote_id: str, template: str = Query("professional"), user: dict = Depends(get_current_user)):
    """Generate and return PDF for a quote"""
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get branding settings
    branding_doc = await db.settings.find_one({"type": "branding"}, {"_id": 0})
    branding = branding_doc.get("data", {}) if branding_doc else {}
    
    # Generate PDF with template
    pdf_buffer = generate_quote_pdf(quote, branding, template)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={quote['quote_number']}.pdf"
        }
    )

class SendQuoteEmailRequest(BaseModel):
    frontend_url: Optional[str] = None
    template: Optional[str] = "professional"

@api_router.post("/quotes/{quote_id}/send-email")
async def send_quote_email(quote_id: str, data: SendQuoteEmailRequest = None, user: dict = Depends(require_accountant_or_admin)):
    """Send quote email to client with PDF attachment"""
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get branding settings
    branding_doc = await db.settings.find_one({"type": "branding"}, {"_id": 0})
    branding = branding_doc.get("data", {}) if branding_doc else {}
    company_name = branding.get("company_name", "KyberBusiness")
    
    # Get SMTP settings
    smtp_settings = await db.settings.find_one({"type": "smtp"}, {"_id": 0})
    if not smtp_settings:
        raise HTTPException(status_code=400, detail="SMTP not configured. Please configure email settings first.")
    
    smtp_config = smtp_settings.get("data", {})
    
    # Generate PDF with template
    template = data.template if data and data.template else "professional"
    pdf_buffer = generate_quote_pdf(quote, branding, template)
    
    # Create email
    message = MIMEMultipart("mixed")
    message["From"] = f"{smtp_config.get('from_name', company_name)} <{smtp_config.get('from_email')}>"
    message["To"] = quote["client_email"]
    message["Subject"] = f"Quote {quote['quote_number']} from {company_name}"
    
    # HTML body
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #06b6d4;">Quote {quote['quote_number']}</h1>
        <p>Dear {quote['client_name']},</p>
        <p>Please find attached your quote from {company_name}.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Quote Number:</strong> {quote['quote_number']}</p>
            <p style="margin: 5px 0;"><strong>Total:</strong> ${quote['total']:.2f}</p>
            {f"<p style='margin: 5px 0;'><strong>Valid Until:</strong> {quote['valid_until']}</p>" if quote.get('valid_until') else ""}
        </div>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>{company_name}</p>
    </div>
    """
    
    # Attach HTML body
    html_part = MIMEText(html_body, "html")
    message.attach(html_part)
    
    # Attach PDF
    pdf_attachment = MIMEBase("application", "pdf")
    pdf_attachment.set_payload(pdf_buffer.read())
    encoders.encode_base64(pdf_attachment)
    pdf_attachment.add_header("Content-Disposition", f"attachment; filename={quote['quote_number']}.pdf")
    message.attach(pdf_attachment)
    
    # Send email
    try:
        await aiosmtplib.send(
            message,
            hostname=smtp_config.get("host"),
            port=smtp_config.get("port"),
            username=smtp_config.get("username"),
            password=decrypt_data(smtp_config.get("password")),
            use_tls=smtp_config.get("use_tls", True)
        )
    except Exception as e:
        logging.error(f"Failed to send quote email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    
    # Update quote status to sent if it was draft
    if quote["status"] == "draft":
        await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "sent"}})
    
    return {"message": "Quote sent successfully", "sent_to": quote["client_email"]}

# ==================== INVOICES ROUTES ====================

@api_router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(data: InvoiceCreate, user: dict = Depends(require_accountant_or_admin)):
    subtotal, tax, total = calculate_totals(data.items)
    invoice_id = str(uuid.uuid4())
    
    invoice_doc = {
        "id": invoice_id,
        "invoice_number": generate_number("INV"),
        "client_name": data.client_name,
        "client_email": data.client_email,
        "client_address": data.client_address or "",
        "items": data.items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "notes": data.notes or "",
        "due_date": data.due_date,
        "status": data.status,
        "payment_link": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.invoices.insert_one(invoice_doc)
    
    return InvoiceResponse(**{k: v for k, v in invoice_doc.items() if k != "_id"})

@api_router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [InvoiceResponse(**inv) for inv in invoices]

@api_router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse(**invoice)

@api_router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(invoice_id: str, data: InvoiceCreate, user: dict = Depends(require_accountant_or_admin)):
    subtotal, tax, total = calculate_totals(data.items)
    
    update_doc = {
        "client_name": data.client_name,
        "client_email": data.client_email,
        "client_address": data.client_address or "",
        "items": data.items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "notes": data.notes or "",
        "due_date": data.due_date,
        "status": data.status
    }
    
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return InvoiceResponse(**invoice)

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(require_accountant_or_admin)):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}

# Public invoice view (no auth required)
@api_router.get("/public/invoices/{invoice_id}")
async def get_public_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get PayPal settings for payment button
    paypal_settings = await db.settings.find_one({"type": "paypal"}, {"_id": 0})
    paypal_client_id = None
    if paypal_settings and paypal_settings.get("data", {}).get("client_id"):
        paypal_client_id = decrypt_data(paypal_settings["data"]["client_id"])
    
    return {
        **invoice,
        "paypal_client_id": paypal_client_id
    }

@api_router.post("/public/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: str, payment_id: str = Query(...)):
    result = await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "paid", "payment_id": payment_id, "paid_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice marked as paid"}

# Helper function to generate PDF for invoices
def generate_invoice_pdf(invoice: dict, branding: dict = None, payment_link: str = None) -> BytesIO:
    """Generate a PDF for an invoice"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Company name / title
    company_name = branding.get("company_name", "KyberBusiness") if branding else "KyberBusiness"
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=colors.HexColor('#06b6d4'))
    elements.append(Paragraph(company_name, title_style))
    
    # Invoice header
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=18, spaceAfter=12)
    elements.append(Paragraph(f"INVOICE: {invoice['invoice_number']}", header_style))
    elements.append(Spacer(1, 12))
    
    # Client info
    normal_style = styles['Normal']
    elements.append(Paragraph(f"<b>Bill To:</b> {invoice['client_name']}", normal_style))
    elements.append(Paragraph(f"<b>Email:</b> {invoice['client_email']}", normal_style))
    if invoice.get('client_address'):
        elements.append(Paragraph(f"<b>Address:</b> {invoice['client_address']}", normal_style))
    elements.append(Paragraph(f"<b>Invoice Date:</b> {invoice['created_at'][:10]}", normal_style))
    if invoice.get('due_date'):
        elements.append(Paragraph(f"<b>Due Date:</b> {invoice['due_date']}", normal_style))
    elements.append(Paragraph(f"<b>Status:</b> {invoice['status'].upper()}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Items table
    table_data = [['Description', 'Qty', 'Price', 'Total']]
    for item in invoice['items']:
        qty = item.get('quantity', 1)
        price = item.get('price', 0)
        total = qty * price
        table_data.append([
            item.get('description', ''),
            str(qty),
            f"${price:.2f}",
            f"${total:.2f}"
        ])
    
    # Add totals
    table_data.append(['', '', 'Subtotal:', f"${invoice['subtotal']:.2f}"])
    table_data.append(['', '', 'Tax (10%):', f"${invoice['tax']:.2f}"])
    table_data.append(['', '', 'Total Due:', f"${invoice['total']:.2f}"])
    
    table = Table(table_data, colWidths=[3.5*inch, 0.75*inch, 1*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#06b6d4')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -4), colors.white),
        ('GRID', (0, 0), (-1, -4), 1, colors.lightgrey),
        ('FONTNAME', (2, -3), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (3, -1), (3, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (3, -1), (3, -1), colors.HexColor('#06b6d4')),
    ]))
    elements.append(table)
    
    # Payment link
    if payment_link:
        elements.append(Spacer(1, 20))
        link_style = ParagraphStyle('Link', parent=normal_style, textColor=colors.HexColor('#06b6d4'))
        elements.append(Paragraph(f"<b>Pay Online:</b> <a href='{payment_link}'>{payment_link}</a>", link_style))
    
    # Notes
    if invoice.get('notes'):
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("<b>Notes:</b>", normal_style))
        elements.append(Paragraph(invoice['notes'], normal_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

@api_router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    """Generate and return PDF for an invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get branding settings
    branding_doc = await db.settings.find_one({"type": "branding"}, {"_id": 0})
    branding = branding_doc.get("data", {}) if branding_doc else {}
    
    # Generate PDF
    pdf_buffer = generate_invoice_pdf(invoice, branding)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={invoice['invoice_number']}.pdf"
        }
    )

class SendInvoiceRequest(BaseModel):
    frontend_url: str  # The frontend URL for generating payment link

@api_router.post("/invoices/{invoice_id}/send")
async def send_invoice_email(invoice_id: str, data: SendInvoiceRequest, user: dict = Depends(require_accountant_or_admin)):
    """Send invoice email to client with payment link and PDF attachment"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get branding settings
    branding_doc = await db.settings.find_one({"type": "branding"}, {"_id": 0})
    branding = branding_doc.get("data", {}) if branding_doc else {}
    company_name = branding.get("company_name", "KyberBusiness")
    
    # Get SMTP settings
    smtp_settings = await db.settings.find_one({"type": "smtp"}, {"_id": 0})
    if not smtp_settings:
        raise HTTPException(status_code=400, detail="SMTP not configured. Please configure email settings first.")
    
    smtp_config = smtp_settings.get("data", {})
    
    # Build payment link
    payment_link = f"{data.frontend_url}/pay/{invoice_id}"
    
    # Generate PDF with payment link
    pdf_buffer = generate_invoice_pdf(invoice, branding, payment_link)
    
    # Create email
    message = MIMEMultipart("mixed")
    message["From"] = f"{smtp_config.get('from_name', company_name)} <{smtp_config.get('from_email')}>"
    message["To"] = invoice["client_email"]
    message["Subject"] = f"Invoice {invoice['invoice_number']} from {company_name}"
    
    # HTML body
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #06b6d4;">Invoice {invoice['invoice_number']}</h1>
        <p>Dear {invoice['client_name']},</p>
        <p>Please find attached your invoice from {company_name}.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> {invoice['invoice_number']}</p>
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${invoice['total']:.2f}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> {invoice.get('due_date') or 'Upon Receipt'}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{payment_link}" style="background: #06b6d4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Pay Now</a>
        </div>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>{company_name}</p>
    </div>
    """
    
    # Attach HTML body
    html_part = MIMEText(html_body, "html")
    message.attach(html_part)
    
    # Attach PDF
    pdf_attachment = MIMEBase("application", "pdf")
    pdf_attachment.set_payload(pdf_buffer.read())
    encoders.encode_base64(pdf_attachment)
    pdf_attachment.add_header("Content-Disposition", f"attachment; filename={invoice['invoice_number']}.pdf")
    message.attach(pdf_attachment)
    
    # Send email
    try:
        await aiosmtplib.send(
            message,
            hostname=smtp_config.get("host"),
            port=smtp_config.get("port"),
            username=smtp_config.get("username"),
            password=decrypt_data(smtp_config.get("password")),
            use_tls=smtp_config.get("use_tls", True)
        )
    except Exception as e:
        logging.error(f"Failed to send invoice email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    
    # Update invoice status to sent if it was draft
    if invoice["status"] == "draft":
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "sent"}})
    
    return {"message": "Invoice sent successfully", "payment_link": payment_link}

# ==================== EXPENSES ROUTES ====================

@api_router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(data: ExpenseCreate, user: dict = Depends(require_accountant_or_admin)):
    expense_id = str(uuid.uuid4())
    
    # Get category name
    category = await db.categories.find_one({"id": data.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    # Get vendor name if provided
    vendor_name = None
    if data.vendor_id:
        vendor = await db.vendors.find_one({"id": data.vendor_id}, {"_id": 0})
        if vendor:
            vendor_name = vendor["name"]
    
    expense_doc = {
        "id": expense_id,
        "description": data.description,
        "amount": data.amount,
        "category_id": data.category_id,
        "category_name": category["name"],
        "vendor_id": data.vendor_id,
        "vendor_name": vendor_name,
        "date": data.date,
        "notes": data.notes or "",
        "receipt_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.expenses.insert_one(expense_doc)
    
    return ExpenseResponse(**{k: v for k, v in expense_doc.items() if k != "_id"})

@api_router.post("/expenses/{expense_id}/upload-receipt")
async def upload_receipt(expense_id: str, file: UploadFile = File(...), user: dict = Depends(require_accountant_or_admin)):
    # Check file size (10MB limit)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Check file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WEBP")
    
    # Save file
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{expense_id}.{file_ext}"
    filepath = UPLOAD_DIR / filename
    
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)
    
    # Update expense with receipt URL
    receipt_url = f"/api/uploads/{filename}"
    await db.expenses.update_one({"id": expense_id}, {"$set": {"receipt_url": receipt_url}})
    
    return {"receipt_url": receipt_url}

@api_router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(user: dict = Depends(get_current_user)):
    expenses = await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return [ExpenseResponse(**exp) for exp in expenses]

@api_router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(expense_id: str, user: dict = Depends(get_current_user)):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return ExpenseResponse(**expense)

@api_router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: str, data: ExpenseCreate, user: dict = Depends(require_accountant_or_admin)):
    category = await db.categories.find_one({"id": data.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    vendor_name = None
    if data.vendor_id:
        vendor = await db.vendors.find_one({"id": data.vendor_id}, {"_id": 0})
        if vendor:
            vendor_name = vendor["name"]
    
    update_doc = {
        "description": data.description,
        "amount": data.amount,
        "category_id": data.category_id,
        "category_name": category["name"],
        "vendor_id": data.vendor_id,
        "vendor_name": vendor_name,
        "date": data.date,
        "notes": data.notes or ""
    }
    
    result = await db.expenses.update_one({"id": expense_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    return ExpenseResponse(**expense)

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(require_accountant_or_admin)):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

# ==================== CATEGORIES ROUTES ====================

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, user: dict = Depends(require_accountant_or_admin)):
    category_id = str(uuid.uuid4())
    category_doc = {
        "id": category_id,
        "name": data.name,
        "color": data.color
    }
    await db.categories.insert_one(category_doc)
    return CategoryResponse(**{k: v for k, v in category_doc.items() if k != "_id"})

@api_router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(user: dict = Depends(get_current_user)):
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return [CategoryResponse(**cat) for cat in categories]

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(require_accountant_or_admin)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

# ==================== VENDORS ROUTES ====================

@api_router.post("/vendors", response_model=VendorResponse)
async def create_vendor(data: VendorCreate, user: dict = Depends(require_accountant_or_admin)):
    vendor_id = str(uuid.uuid4())
    vendor_doc = {
        "id": vendor_id,
        "name": data.name,
        "email": data.email or "",
        "phone": data.phone or "",
        "address": data.address or ""
    }
    await db.vendors.insert_one(vendor_doc)
    return VendorResponse(**{k: v for k, v in vendor_doc.items() if k != "_id"})

@api_router.get("/vendors", response_model=List[VendorResponse])
async def list_vendors(user: dict = Depends(get_current_user)):
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    return [VendorResponse(**v) for v in vendors]

@api_router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, user: dict = Depends(require_accountant_or_admin)):
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted successfully"}

# ==================== SETTINGS ROUTES ====================

@api_router.post("/settings/smtp")
async def save_smtp_settings(data: SMTPSettings, user: dict = Depends(require_admin)):
    encrypted_password = encrypt_data(data.password)
    settings_doc = {
        "type": "smtp",
        "data": {
            "host": data.host,
            "port": data.port,
            "username": data.username,
            "password": encrypted_password,
            "from_email": data.from_email,
            "from_name": data.from_name,
            "use_tls": data.use_tls
        }
    }
    await db.settings.update_one({"type": "smtp"}, {"$set": settings_doc}, upsert=True)
    return {"message": "SMTP settings saved successfully"}

@api_router.get("/settings/smtp")
async def get_smtp_settings(user: dict = Depends(require_admin)):
    settings = await db.settings.find_one({"type": "smtp"}, {"_id": 0})
    if not settings:
        return {"configured": False}
    
    data = settings.get("data", {})
    return {
        "configured": True,
        "host": data.get("host"),
        "port": data.get("port"),
        "username": data.get("username"),
        "from_email": data.get("from_email"),
        "from_name": data.get("from_name"),
        "use_tls": data.get("use_tls", True)
    }

@api_router.post("/settings/paypal")
async def save_paypal_settings(data: PayPalSettings, user: dict = Depends(require_admin)):
    encrypted_client_id = encrypt_data(data.client_id)
    encrypted_secret = encrypt_data(data.client_secret)
    
    settings_doc = {
        "type": "paypal",
        "data": {
            "client_id": encrypted_client_id,
            "client_secret": encrypted_secret,
            "sandbox": data.sandbox
        }
    }
    await db.settings.update_one({"type": "paypal"}, {"$set": settings_doc}, upsert=True)
    return {"message": "PayPal settings saved successfully"}

@api_router.get("/settings/paypal")
async def get_paypal_settings(user: dict = Depends(require_admin)):
    settings = await db.settings.find_one({"type": "paypal"}, {"_id": 0})
    if not settings:
        return {"configured": False}
    
    return {
        "configured": True,
        "sandbox": settings.get("data", {}).get("sandbox", True)
    }

# ==================== EMAIL TEMPLATES ROUTES ====================

DEFAULT_TEMPLATES = [
    {
        "id": "default-professional",
        "name": "Professional Invoice",
        "theme": "professional",
        "subject": "Invoice #{invoice_number} from KyberBusiness",
        "body_html": """
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #ffffff; border: 1px solid #e0e0e0;">
    <h1 style="color: #333; border-bottom: 2px solid #06b6d4; padding-bottom: 10px;">INVOICE</h1>
    <p style="color: #666;">Invoice Number: <strong>#{invoice_number}</strong></p>
    <p style="color: #666;">Amount Due: <strong>${total}</strong></p>
    <p style="color: #666;">Due Date: <strong>{due_date}</strong></p>
    <div style="margin: 30px 0;">
        <a href="{payment_link}" style="background: #06b6d4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Pay Now</a>
    </div>
    <p style="color: #999; font-size: 12px;">Thank you for your business.</p>
</div>
        """,
        "is_default": True
    },
    {
        "id": "default-modern",
        "name": "Modern Invoice",
        "theme": "modern",
        "subject": "Your Invoice #{invoice_number} is Ready",
        "body_html": """
<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
    <div style="background: linear-gradient(135deg, #06b6d4, #d946ef); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Invoice Ready</h1>
    </div>
    <div style="padding: 30px; background: #f8f9fa;">
        <p style="font-size: 18px; color: #333;">Invoice <strong>#{invoice_number}</strong></p>
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 24px; color: #06b6d4;"><strong>${total}</strong></p>
            <p style="margin: 5px 0 0; color: #666;">Due: {due_date}</p>
        </div>
        <a href="{payment_link}" style="display: block; background: #d946ef; color: white; padding: 15px; text-decoration: none; border-radius: 25px; text-align: center;">Pay Invoice</a>
    </div>
</div>
        """,
        "is_default": False
    },
    {
        "id": "default-minimal",
        "name": "Minimal Invoice",
        "theme": "minimal",
        "subject": "Invoice #{invoice_number}",
        "body_html": """
<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px;">
    <p style="color: #333; margin-bottom: 30px;">Hi,</p>
    <p style="color: #666;">Your invoice <strong>#{invoice_number}</strong> for <strong>${total}</strong> is due on {due_date}.</p>
    <p style="margin: 30px 0;">
        <a href="{payment_link}" style="color: #06b6d4; text-decoration: none; border-bottom: 2px solid #06b6d4; padding-bottom: 2px;">Pay now →</a>
    </p>
    <p style="color: #999; font-size: 14px;">Thanks,<br>KyberBusiness</p>
</div>
        """,
        "is_default": False
    },
    {
        "id": "default-bold",
        "name": "Bold Invoice",
        "theme": "bold",
        "subject": "💎 INVOICE #{invoice_number} - Action Required",
        "body_html": """
<div style="font-family: 'Impact', sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; padding: 0;">
    <div style="background: #d946ef; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 3px;">INVOICE</h1>
    </div>
    <div style="padding: 30px; text-align: center;">
        <p style="color: #06b6d4; font-size: 48px; margin: 0;"><strong>${total}</strong></p>
        <p style="color: #94a3b8; font-size: 14px;">Invoice #{invoice_number}</p>
        <p style="color: #94a3b8;">Due: {due_date}</p>
        <a href="{payment_link}" style="display: inline-block; margin-top: 20px; background: #06b6d4; color: #0f172a; padding: 20px 40px; text-decoration: none; font-weight: bold; font-size: 18px;">PAY NOW</a>
    </div>
</div>
        """,
        "is_default": False
    },
    {
        "id": "default-classic",
        "name": "Classic Invoice",
        "theme": "classic",
        "subject": "Invoice #{invoice_number} - Payment Request",
        "body_html": """
<div style="font-family: 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 3px double #333;">
    <div style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 20px;">
        <h1 style="color: #333; margin: 0; font-style: italic;">KyberBusiness</h1>
        <p style="color: #666; margin: 5px 0;">Invoice</p>
    </div>
    <div style="padding: 30px 0;">
        <table style="width: 100%;">
            <tr><td style="color: #666;">Invoice No:</td><td style="text-align: right;"><strong>#{invoice_number}</strong></td></tr>
            <tr><td style="color: #666;">Amount:</td><td style="text-align: right;"><strong>${total}</strong></td></tr>
            <tr><td style="color: #666;">Due Date:</td><td style="text-align: right;">{due_date}</td></tr>
        </table>
    </div>
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
        <a href="{payment_link}" style="color: #06b6d4; text-decoration: none;">Click here to pay</a>
    </div>
</div>
        """,
        "is_default": False
    }
]

@api_router.get("/email-templates", response_model=List[EmailTemplateResponse])
async def list_email_templates(user: dict = Depends(get_current_user)):
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    if not templates:
        # Initialize with defaults
        for t in DEFAULT_TEMPLATES:
            await db.email_templates.insert_one(t)
        templates = DEFAULT_TEMPLATES
    return [EmailTemplateResponse(**t) for t in templates]

@api_router.post("/email-templates", response_model=EmailTemplateResponse)
async def create_email_template(data: EmailTemplateCreate, user: dict = Depends(require_admin)):
    template_id = str(uuid.uuid4())
    template_doc = {
        "id": template_id,
        "name": data.name,
        "theme": data.theme,
        "subject": data.subject,
        "body_html": data.body_html,
        "is_default": False
    }
    await db.email_templates.insert_one(template_doc)
    return EmailTemplateResponse(**{k: v for k, v in template_doc.items() if k != "_id"})

@api_router.put("/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def update_email_template(template_id: str, data: EmailTemplateCreate, user: dict = Depends(require_admin)):
    update_doc = {
        "name": data.name,
        "theme": data.theme,
        "subject": data.subject,
        "body_html": data.body_html
    }
    result = await db.email_templates.update_one({"id": template_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    return EmailTemplateResponse(**template)

@api_router.post("/email-templates/{template_id}/set-default")
async def set_default_template(template_id: str, user: dict = Depends(require_admin)):
    await db.email_templates.update_many({}, {"$set": {"is_default": False}})
    result = await db.email_templates.update_one({"id": template_id}, {"$set": {"is_default": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Default template updated"}

@api_router.delete("/email-templates/{template_id}")
async def delete_email_template(template_id: str, user: dict = Depends(require_admin)):
    template = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    if template and template.get("id", "").startswith("default-"):
        raise HTTPException(status_code=400, detail="Cannot delete default templates")
    
    result = await db.email_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}

# ==================== BRANDING ROUTES ====================

@api_router.post("/settings/branding")
async def save_branding_settings(data: BrandingSettings, user: dict = Depends(require_admin)):
    settings_doc = {
        "type": "branding",
        "data": {
            "company_name": data.company_name,
            "primary_color": data.primary_color,
            "secondary_color": data.secondary_color,
            "accent_color": data.accent_color,
            "tagline": data.tagline or "",
            "address": data.address or "",
            "phone": data.phone or "",
            "email": data.email or "",
            "website": data.website or ""
        }
    }
    await db.settings.update_one({"type": "branding"}, {"$set": settings_doc}, upsert=True)
    return {"message": "Branding settings saved successfully"}

@api_router.get("/settings/branding")
async def get_branding_settings(user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"type": "branding"}, {"_id": 0})
    if not settings:
        return {
            "configured": False,
            "company_name": "KyberBusiness",
            "primary_color": "#06b6d4",
            "secondary_color": "#d946ef",
            "accent_color": "#10b981",
            "tagline": "",
            "address": "",
            "phone": "",
            "email": "",
            "website": "",
            "logo_url": None
        }
    
    data = settings.get("data", {})
    return {
        "configured": True,
        "company_name": data.get("company_name", "KyberBusiness"),
        "primary_color": data.get("primary_color", "#06b6d4"),
        "secondary_color": data.get("secondary_color", "#d946ef"),
        "accent_color": data.get("accent_color", "#10b981"),
        "tagline": data.get("tagline", ""),
        "address": data.get("address", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "website": data.get("website", ""),
        "logo_url": data.get("logo_url")
    }

@api_router.get("/public/branding")
async def get_public_branding():
    """Public endpoint for branding (used on public invoice pages)"""
    settings = await db.settings.find_one({"type": "branding"}, {"_id": 0})
    if not settings:
        return {
            "company_name": "KyberBusiness",
            "primary_color": "#06b6d4",
            "secondary_color": "#d946ef",
            "accent_color": "#10b981",
            "tagline": "",
            "address": "",
            "phone": "",
            "email": "",
            "website": "",
            "logo_url": None
        }
    
    data = settings.get("data", {})
    logo_url = data.get("logo_url")
    # Convert authenticated URL to public URL for public access
    if logo_url and logo_url.startswith("/uploads/"):
        logo_url = "/public" + logo_url
    
    return {
        "company_name": data.get("company_name", "KyberBusiness"),
        "primary_color": data.get("primary_color", "#06b6d4"),
        "secondary_color": data.get("secondary_color", "#d946ef"),
        "accent_color": data.get("accent_color", "#10b981"),
        "tagline": data.get("tagline", ""),
        "address": data.get("address", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "website": data.get("website", ""),
        "logo_url": logo_url
    }

@api_router.post("/settings/branding/logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo must be less than 5MB")
    
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, SVG")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"company_logo.{file_ext}"
    filepath = UPLOAD_DIR / filename
    
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)
    
    # Store URL without /api prefix since frontend adds it
    logo_url = f"/uploads/{filename}"
    
    # Update branding settings with logo URL
    await db.settings.update_one(
        {"type": "branding"},
        {"$set": {"data.logo_url": logo_url}},
        upsert=True
    )
    
    return {"logo_url": logo_url}

@api_router.delete("/settings/branding/logo")
async def delete_logo(user: dict = Depends(require_admin)):
    # Remove logo URL from settings
    await db.settings.update_one(
        {"type": "branding"},
        {"$unset": {"data.logo_url": ""}}
    )
    
    # Delete logo files
    import glob
    for f in glob.glob(str(UPLOAD_DIR / "company_logo.*")):
        try:
            os.remove(f)
        except:
            pass
    
    return {"message": "Logo deleted successfully"}

# ==================== REPORTS ROUTES ====================

@api_router.get("/reports/summary")
async def get_report_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: dict = Depends(get_current_user)
):
    # Revenue from paid invoices
    invoices = await db.invoices.find({
        "status": "paid",
        "paid_at": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    total_revenue = sum(inv.get("total", 0) for inv in invoices)
    
    # Expenses
    expenses = await db.expenses.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    total_expenses = sum(exp.get("amount", 0) for exp in expenses)
    
    # Profit/Loss
    profit_loss = total_revenue - total_expenses
    
    # Monthly breakdown for charts
    monthly_data = {}
    for inv in invoices:
        month = inv.get("paid_at", "")[:7]  # YYYY-MM
        if month not in monthly_data:
            monthly_data[month] = {"revenue": 0, "expenses": 0}
        monthly_data[month]["revenue"] += inv.get("total", 0)
    
    for exp in expenses:
        month = exp.get("date", "")[:7]
        if month not in monthly_data:
            monthly_data[month] = {"revenue": 0, "expenses": 0}
        monthly_data[month]["expenses"] += exp.get("amount", 0)
    
    chart_data = [
        {"month": k, "revenue": v["revenue"], "expenses": v["expenses"]}
        for k, v in sorted(monthly_data.items())
    ]
    
    # Expense breakdown by category
    category_breakdown = {}
    for exp in expenses:
        cat = exp.get("category_name", "Uncategorized")
        if cat not in category_breakdown:
            category_breakdown[cat] = 0
        category_breakdown[cat] += exp.get("amount", 0)
    
    category_data = [{"name": k, "value": v} for k, v in category_breakdown.items()]
    
    return {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "profit_loss": profit_loss,
        "invoice_count": len(invoices),
        "expense_count": len(expenses),
        "chart_data": chart_data,
        "category_breakdown": category_data
    }

@api_router.get("/reports/dashboard")
async def get_dashboard_data(user: dict = Depends(get_current_user)):
    # Get counts and recent items
    invoice_count = await db.invoices.count_documents({})
    quote_count = await db.quotes.count_documents({})
    expense_count = await db.expenses.count_documents({})
    
    # Pending invoices
    pending_invoices = await db.invoices.find(
        {"status": {"$in": ["draft", "sent"]}}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Recent expenses
    recent_expenses = await db.expenses.find({}, {"_id": 0}).sort("date", -1).limit(5).to_list(5)
    
    # Total outstanding
    outstanding_invoices = await db.invoices.find(
        {"status": {"$in": ["draft", "sent", "overdue"]}},
        {"_id": 0}
    ).to_list(1000)
    total_outstanding = sum(inv.get("total", 0) for inv in outstanding_invoices)
    
    # This month's revenue
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).isoformat()[:10]
    paid_this_month = await db.invoices.find({
        "status": "paid",
        "paid_at": {"$gte": month_start}
    }, {"_id": 0}).to_list(1000)
    revenue_this_month = sum(inv.get("total", 0) for inv in paid_this_month)
    
    return {
        "invoice_count": invoice_count,
        "quote_count": quote_count,
        "expense_count": expense_count,
        "total_outstanding": total_outstanding,
        "revenue_this_month": revenue_this_month,
        "pending_invoices": pending_invoices,
        "recent_expenses": recent_expenses
    }

# ==================== FILE SERVING ====================

from fastapi.responses import FileResponse

@api_router.get("/uploads/{filename}")
async def serve_upload(filename: str, user: dict = Depends(get_current_user)):
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

@api_router.get("/public/uploads/{filename}")
async def serve_public_upload(filename: str):
    """Public endpoint for serving logos and other public assets"""
    # Only allow company logo files to be served publicly
    if not filename.startswith("company_logo"):
        raise HTTPException(status_code=403, detail="Access denied")
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
