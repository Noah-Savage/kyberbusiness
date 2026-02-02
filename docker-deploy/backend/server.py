from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from cryptography.fernet import Fernet
import base64
import secrets
import aiofiles
from bson import ObjectId

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://mongo:27017')
db_name = os.environ.get('DB_NAME', 'kyberbusiness')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Encryption key for storing sensitive credentials
# Generate a valid key if not provided or invalid
def get_encryption_key():
    key = os.environ.get('ENCRYPTION_KEY', '')
    if key:
        try:
            # Test if it's a valid Fernet key
            Fernet(key.encode() if isinstance(key, str) else key)
            return key
        except Exception:
            pass
    # Generate a new key if none provided or invalid
    return Fernet.generate_key().decode()

ENCRYPTION_KEY = get_encryption_key()
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
    theme: str
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

class GeneralSettings(BaseModel):
    require_email_verification: bool = False

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
    tax = subtotal * 0.1
    total = subtotal + tax
    return subtotal, tax, total

async def get_general_settings():
    settings = await db.settings.find_one({"type": "general"}, {"_id": 0})
    if not settings:
        return {"require_email_verification": False}
    return settings.get("data", {"require_email_verification": False})

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Determine role based on email domain
    is_admin = data.email.endswith("@thestarforge.org")
    role = UserRole.ADMIN if is_admin else UserRole.VIEWER
    
    # Check if email verification is required
    general_settings = await get_general_settings()
    require_verification = general_settings.get("require_email_verification", False)
    
    user_id = str(uuid.uuid4())
    verification_token = secrets.token_urlsafe(32) if require_verification else None
    
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password": hash_password(data.password),
        "role": role,
        "email_verified": not require_verification,  # Auto-verify if verification is disabled
        "verification_token": verification_token,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, data.email, role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=data.email,
            name=data.name,
            role=role,
            email_verified=user_doc["email_verified"],
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if email verification is required
    general_settings = await get_general_settings()
    require_verification = general_settings.get("require_email_verification", False)
    
    if require_verification and not user.get("email_verified", False):
        raise HTTPException(status_code=403, detail="Email not verified. Please check your email for verification link.")
    
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
async def resend_verification(user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    verification_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"verification_token": verification_token}}
    )
    
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
        try:
            paypal_client_id = decrypt_data(paypal_settings["data"]["client_id"])
        except Exception:
            pass
    
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

@api_router.post("/settings/general")
async def save_general_settings(data: GeneralSettings, user: dict = Depends(require_admin)):
    settings_doc = {
        "type": "general",
        "data": {
            "require_email_verification": data.require_email_verification
        }
    }
    await db.settings.update_one({"type": "general"}, {"$set": settings_doc}, upsert=True)
    return {"message": "General settings saved successfully"}

@api_router.get("/settings/general")
async def get_general_settings_endpoint(user: dict = Depends(require_admin)):
    settings = await db.settings.find_one({"type": "general"}, {"_id": 0})
    if not settings:
        return {"require_email_verification": False}
    return settings.get("data", {"require_email_verification": False})

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
        "subject": "Invoice #{invoice_number} from {company_name}",
        "body_html": """
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #ffffff; border: 1px solid #e0e0e0;">
    <div style="text-align: center; margin-bottom: 30px;">
        {logo_html}
        <h2 style="color: #333; margin: 10px 0 0;">{company_name}</h2>
    </div>
    <h1 style="color: #333; border-bottom: 2px solid {primary_color}; padding-bottom: 10px;">INVOICE</h1>
    <p style="color: #666;">Invoice Number: <strong>#{invoice_number}</strong></p>
    <p style="color: #666;">Amount Due: <strong>${total}</strong></p>
    <p style="color: #666;">Due Date: <strong>{due_date}</strong></p>
    <div style="margin: 30px 0;">
        <a href="{payment_link}" style="background: {primary_color}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Pay Now</a>
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
        "subject": "Your Invoice #{invoice_number} from {company_name} is Ready",
        "body_html": """
<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
    <div style="background: linear-gradient(135deg, {primary_color}, {secondary_color}); padding: 30px; text-align: center;">
        {logo_html}
        <h1 style="color: white; margin: 10px 0 0;">{company_name}</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0;">Invoice Ready</p>
    </div>
    <div style="padding: 30px; background: #f8f9fa;">
        <p style="font-size: 18px; color: #333;">Invoice <strong>#{invoice_number}</strong></p>
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 24px; color: {primary_color};"><strong>${total}</strong></p>
            <p style="margin: 5px 0 0; color: #666;">Due: {due_date}</p>
        </div>
        <a href="{payment_link}" style="display: block; background: {secondary_color}; color: white; padding: 15px; text-decoration: none; border-radius: 25px; text-align: center;">Pay Invoice</a>
    </div>
</div>
        """,
        "is_default": False
    },
    {
        "id": "default-minimal",
        "name": "Minimal Invoice",
        "theme": "minimal",
        "subject": "Invoice #{invoice_number} from {company_name}",
        "body_html": """
<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px;">
    <div style="margin-bottom: 30px;">
        {logo_html}
    </div>
    <p style="color: #333; margin-bottom: 30px;">Hi,</p>
    <p style="color: #666;">Your invoice <strong>#{invoice_number}</strong> for <strong>${total}</strong> is due on {due_date}.</p>
    <p style="margin: 30px 0;">
        <a href="{payment_link}" style="color: {primary_color}; text-decoration: none; border-bottom: 2px solid {primary_color}; padding-bottom: 2px;">Pay now</a>
    </p>
    <p style="color: #999; font-size: 14px;">Thanks,<br>{company_name}</p>
</div>
        """,
        "is_default": False
    },
    {
        "id": "default-bold",
        "name": "Bold Invoice",
        "theme": "bold",
        "subject": "INVOICE #{invoice_number} from {company_name} - Action Required",
        "body_html": """
<div style="font-family: 'Impact', sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; padding: 0;">
    <div style="background: {secondary_color}; padding: 20px; text-align: center;">
        {logo_html}
        <h1 style="color: white; margin: 10px 0 0; font-size: 28px; letter-spacing: 3px;">{company_name}</h1>
    </div>
    <div style="padding: 30px; text-align: center;">
        <p style="color: {primary_color}; font-size: 48px; margin: 0;"><strong>${total}</strong></p>
        <p style="color: #94a3b8; font-size: 14px;">Invoice #{invoice_number}</p>
        <p style="color: #94a3b8;">Due: {due_date}</p>
        <a href="{payment_link}" style="display: inline-block; margin-top: 20px; background: {primary_color}; color: #0f172a; padding: 20px 40px; text-decoration: none; font-weight: bold; font-size: 18px;">PAY NOW</a>
    </div>
</div>
        """,
        "is_default": False
    },
    {
        "id": "default-classic",
        "name": "Classic Invoice",
        "theme": "classic",
        "subject": "Invoice #{invoice_number} from {company_name} - Payment Request",
        "body_html": """
<div style="font-family: 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 3px double #333;">
    <div style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 20px;">
        {logo_html}
        <h1 style="color: #333; margin: 10px 0 0; font-style: italic;">{company_name}</h1>
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
        <a href="{payment_link}" style="color: {primary_color}; text-decoration: none;">Click here to pay</a>
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
        "logo_url": data.get("logo_url")
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
    
    # Ensure the directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)
    
    # Store just the filename, the frontend will construct the full URL
    logo_url = f"/api/uploads/{filename}"
    
    # First ensure the branding document exists
    existing = await db.settings.find_one({"type": "branding"})
    if not existing:
        await db.settings.insert_one({
            "type": "branding",
            "data": {
                "company_name": "KyberBusiness",
                "primary_color": "#06b6d4",
                "secondary_color": "#d946ef",
                "accent_color": "#10b981",
                "logo_url": logo_url
            }
        })
    else:
        await db.settings.update_one(
            {"type": "branding"},
            {"$set": {"data.logo_url": logo_url}}
        )
    
    return {"logo_url": logo_url}

@api_router.delete("/settings/branding/logo")
async def delete_logo(user: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"type": "branding"},
        {"$unset": {"data.logo_url": ""}}
    )
    
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
    invoices = await db.invoices.find({
        "status": "paid",
        "paid_at": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    total_revenue = sum(inv.get("total", 0) for inv in invoices)
    
    expenses = await db.expenses.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    total_expenses = sum(exp.get("amount", 0) for exp in expenses)
    profit_loss = total_revenue - total_expenses
    
    monthly_data = {}
    for inv in invoices:
        month = inv.get("paid_at", "")[:7]
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
    invoice_count = await db.invoices.count_documents({})
    quote_count = await db.quotes.count_documents({})
    expense_count = await db.expenses.count_documents({})
    
    pending_invoices = await db.invoices.find(
        {"status": {"$in": ["draft", "sent"]}}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    recent_expenses = await db.expenses.find({}, {"_id": 0}).sort("date", -1).limit(5).to_list(5)
    
    outstanding_invoices = await db.invoices.find(
        {"status": {"$in": ["draft", "sent", "overdue"]}},
        {"_id": 0}
    ).to_list(1000)
    total_outstanding = sum(inv.get("total", 0) for inv in outstanding_invoices)
    
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

# ==================== PDF GENERATION ====================

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from io import BytesIO
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import aiosmtplib

async def get_branding_data():
    """Get branding settings for PDF generation"""
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
    return settings.get("data", {})

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple for reportlab"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4))

def create_invoice_pdf(invoice: dict, branding: dict) -> bytes:
    """Generate PDF for invoice using reportlab"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    
    company_name = branding.get("company_name", "KyberBusiness")
    primary_color = colors.Color(*hex_to_rgb(branding.get("primary_color", "#06b6d4")))
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CompanyName', fontSize=18, textColor=primary_color, spaceAfter=6, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=28, textColor=primary_color, alignment=TA_RIGHT, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='SectionHeader', fontSize=10, textColor=colors.grey, spaceAfter=4, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='ClientName', fontSize=14, fontName='Helvetica-Bold', spaceAfter=4))
    styles.add(ParagraphStyle(name='Normal_Right', fontSize=10, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='Total', fontSize=14, fontName='Helvetica-Bold', alignment=TA_RIGHT, textColor=primary_color))
    
    elements = []
    
    # Header section
    header_data = [
        [Paragraph(company_name, styles['CompanyName']), Paragraph('INVOICE', styles['InvoiceTitle'])],
    ]
    
    company_info = []
    if branding.get("address"):
        company_info.append(branding["address"])
    if branding.get("phone"):
        company_info.append(branding["phone"])
    if branding.get("email"):
        company_info.append(branding["email"])
    
    if company_info:
        header_data.append([Paragraph('<br/>'.join(company_info), styles['Normal']), 
                           Paragraph(f"<b>{invoice.get('invoice_number', '')}</b>", styles['Normal_Right'])])
    else:
        header_data.append(['', Paragraph(f"<b>{invoice.get('invoice_number', '')}</b>", styles['Normal_Right'])])
    
    header_table = Table(header_data, colWidths=[300, 200])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))
    
    # Bill To section
    elements.append(Paragraph('BILL TO', styles['SectionHeader']))
    elements.append(Paragraph(invoice.get('client_name', ''), styles['ClientName']))
    elements.append(Paragraph(invoice.get('client_email', ''), styles['Normal']))
    if invoice.get('client_address'):
        elements.append(Paragraph(invoice['client_address'], styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Invoice details
    details_data = [
        ['Date:', invoice.get('created_at', '')[:10]],
        ['Due Date:', invoice.get('due_date', 'N/A') or 'N/A'],
        ['Status:', invoice.get('status', 'draft').upper()],
    ]
    details_table = Table(details_data, colWidths=[80, 150])
    details_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 20))
    
    # Line items table
    items_data = [['Description', 'Qty', 'Price', 'Total']]
    for item in invoice.get('items', []):
        line_total = item.get('quantity', 1) * item.get('price', 0)
        items_data.append([
            item.get('description', ''),
            str(item.get('quantity', 1)),
            f"${item.get('price', 0):.2f}",
            f"${line_total:.2f}"
        ])
    
    items_table = Table(items_data, colWidths=[280, 60, 80, 80])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.lightgrey),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.grey),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 20))
    
    # Totals
    totals_data = [
        ['Subtotal:', f"${invoice.get('subtotal', 0):.2f}"],
        ['Tax (10%):', f"${invoice.get('tax', 0):.2f}"],
        ['TOTAL:', f"${invoice.get('total', 0):.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[400, 100])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('TEXTCOLOR', (-1, -1), (-1, -1), primary_color),
        ('LINEABOVE', (0, -1), (-1, -1), 1, primary_color),
        ('TOPPADDING', (0, -1), (-1, -1), 8),
    ]))
    elements.append(totals_table)
    
    # Notes
    if invoice.get('notes'):
        elements.append(Spacer(1, 30))
        elements.append(Paragraph('NOTES', styles['SectionHeader']))
        elements.append(Paragraph(invoice['notes'], styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 40))
    elements.append(Paragraph(f'<para alignment="center"><font color="grey">Thank you for your business! • {company_name}</font></para>', styles['Normal']))
    
    doc.build(elements)
    return buffer.getvalue()

def create_quote_pdf(quote: dict, branding: dict) -> bytes:
    """Generate PDF for quote using reportlab"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    
    company_name = branding.get("company_name", "KyberBusiness")
    secondary_color = colors.Color(*hex_to_rgb(branding.get("secondary_color", "#d946ef")))
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CompanyName', fontSize=18, textColor=secondary_color, spaceAfter=6, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='QuoteTitle', fontSize=28, textColor=secondary_color, alignment=TA_RIGHT, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='SectionHeader', fontSize=10, textColor=colors.grey, spaceAfter=4, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='ClientName', fontSize=14, fontName='Helvetica-Bold', spaceAfter=4))
    styles.add(ParagraphStyle(name='Normal_Right', fontSize=10, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='Total', fontSize=14, fontName='Helvetica-Bold', alignment=TA_RIGHT, textColor=secondary_color))
    
    elements = []
    
    # Header section
    header_data = [
        [Paragraph(company_name, styles['CompanyName']), Paragraph('QUOTE', styles['QuoteTitle'])],
    ]
    
    company_info = []
    if branding.get("address"):
        company_info.append(branding["address"])
    if branding.get("phone"):
        company_info.append(branding["phone"])
    if branding.get("email"):
        company_info.append(branding["email"])
    
    if company_info:
        header_data.append([Paragraph('<br/>'.join(company_info), styles['Normal']), 
                           Paragraph(f"<b>{quote.get('quote_number', '')}</b>", styles['Normal_Right'])])
    else:
        header_data.append(['', Paragraph(f"<b>{quote.get('quote_number', '')}</b>", styles['Normal_Right'])])
    
    header_table = Table(header_data, colWidths=[300, 200])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))
    
    # Prepared For section
    elements.append(Paragraph('PREPARED FOR', styles['SectionHeader']))
    elements.append(Paragraph(quote.get('client_name', ''), styles['ClientName']))
    elements.append(Paragraph(quote.get('client_email', ''), styles['Normal']))
    if quote.get('client_address'):
        elements.append(Paragraph(quote['client_address'], styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Quote details
    details_data = [
        ['Date:', quote.get('created_at', '')[:10]],
        ['Valid Until:', quote.get('valid_until', 'N/A') or 'N/A'],
        ['Status:', quote.get('status', 'draft').upper()],
    ]
    details_table = Table(details_data, colWidths=[80, 150])
    details_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 20))
    
    # Line items table
    items_data = [['Description', 'Qty', 'Price', 'Total']]
    for item in quote.get('items', []):
        line_total = item.get('quantity', 1) * item.get('price', 0)
        items_data.append([
            item.get('description', ''),
            str(item.get('quantity', 1)),
            f"${item.get('price', 0):.2f}",
            f"${line_total:.2f}"
        ])
    
    items_table = Table(items_data, colWidths=[280, 60, 80, 80])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), secondary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.lightgrey),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.grey),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 20))
    
    # Totals
    totals_data = [
        ['Subtotal:', f"${quote.get('subtotal', 0):.2f}"],
        ['Tax (10%):', f"${quote.get('tax', 0):.2f}"],
        ['TOTAL:', f"${quote.get('total', 0):.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[400, 100])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('TEXTCOLOR', (-1, -1), (-1, -1), secondary_color),
        ('LINEABOVE', (0, -1), (-1, -1), 1, secondary_color),
        ('TOPPADDING', (0, -1), (-1, -1), 8),
    ]))
    elements.append(totals_table)
    
    # Notes
    if quote.get('notes'):
        elements.append(Spacer(1, 30))
        elements.append(Paragraph('NOTES', styles['SectionHeader']))
        elements.append(Paragraph(quote['notes'], styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 40))
    elements.append(Paragraph(f'<para alignment="center"><font color="grey">Thank you for considering our services! • {company_name}</font></para>', styles['Normal']))
    
    doc.build(elements)
    return buffer.getvalue()

async def send_email_with_attachment(
    to_email: str,
    subject: str,
    body_html: str,
    attachment_data: bytes,
    attachment_filename: str
):
    """Send email with PDF attachment using configured SMTP"""
    smtp_settings = await db.settings.find_one({"type": "smtp"}, {"_id": 0})
    if not smtp_settings or not smtp_settings.get("data"):
        raise HTTPException(status_code=400, detail="SMTP not configured. Please configure SMTP settings first.")
    
    smtp_data = smtp_settings["data"]
    
    # Create message
    msg = MIMEMultipart()
    msg["From"] = f"{smtp_data.get('from_name', 'KyberBusiness')} <{smtp_data.get('from_email')}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    
    # Attach HTML body
    msg.attach(MIMEText(body_html, "html"))
    
    # Attach PDF
    pdf_attachment = MIMEApplication(attachment_data, _subtype="pdf")
    pdf_attachment.add_header("Content-Disposition", "attachment", filename=attachment_filename)
    msg.attach(pdf_attachment)
    
    # Send email
    try:
        decrypted_password = decrypt_data(smtp_data["password"])
        await aiosmtplib.send(
            msg,
            hostname=smtp_data["host"],
            port=smtp_data["port"],
            username=smtp_data["username"],
            password=decrypted_password,
            start_tls=smtp_data.get("use_tls", True)
        )
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

from fastapi.responses import Response
async def download_invoice_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    """Download invoice as PDF"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    branding = await get_branding_data()
    try:
        pdf_data = create_invoice_pdf(invoice, branding)
    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={invoice['invoice_number']}.pdf"
        }
    )

@api_router.get("/quotes/{quote_id}/pdf")
async def download_quote_pdf(quote_id: str, user: dict = Depends(get_current_user)):
    """Download quote as PDF"""
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    branding = await get_branding_data()
    try:
        pdf_data = create_quote_pdf(quote, branding)
    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={quote['quote_number']}.pdf"
        }
    )
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={quote['quote_number']}.pdf"
        }
    )

class EmailInvoiceRequest(BaseModel):
    custom_message: Optional[str] = ""

@api_router.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, data: EmailInvoiceRequest, user: dict = Depends(require_accountant_or_admin)):
    """Send invoice PDF via email to customer"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    branding = await get_branding_data()
    company_name = branding.get("company_name", "KyberBusiness")
    primary_color = branding.get("primary_color", "#06b6d4")
    
    # Generate PDF using reportlab
    pdf_data = create_invoice_pdf(invoice, branding)
    
    # Build email body
    custom_msg = f"<p>{data.custom_message}</p>" if data.custom_message else ""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: {primary_color};">Invoice from {company_name}</h2>
        {custom_msg}
        <p>Please find attached invoice <strong>{invoice['invoice_number']}</strong> for <strong>${invoice['total']:.2f}</strong>.</p>
        <p>Due Date: {invoice.get('due_date', 'N/A') or 'N/A'}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Thank you for your business!<br>
            {company_name}
        </p>
    </div>
    """
    
    await send_email_with_attachment(
        to_email=invoice["client_email"],
        subject=f"Invoice {invoice['invoice_number']} from {company_name}",
        body_html=email_body,
        attachment_data=pdf_data,
        attachment_filename=f"{invoice['invoice_number']}.pdf"
    )
    
    # Update invoice status to sent if it was draft
    if invoice.get("status") == "draft":
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "sent"}})
    
    return {"message": f"Invoice sent to {invoice['client_email']}"}

class EmailQuoteRequest(BaseModel):
    custom_message: Optional[str] = ""

@api_router.post("/quotes/{quote_id}/send-email")
async def send_quote_email(quote_id: str, data: EmailQuoteRequest, user: dict = Depends(require_accountant_or_admin)):
    """Send quote PDF via email to customer"""
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    branding = await get_branding_data()
    company_name = branding.get("company_name", "KyberBusiness")
    secondary_color = branding.get("secondary_color", "#d946ef")
    
    # Generate PDF using reportlab
    pdf_data = create_quote_pdf(quote, branding)
    
    # Build email body
    custom_msg = f"<p>{data.custom_message}</p>" if data.custom_message else ""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: {secondary_color};">Quote from {company_name}</h2>
        {custom_msg}
        <p>Please find attached quote <strong>{quote['quote_number']}</strong> for <strong>${quote['total']:.2f}</strong>.</p>
        <p>Valid Until: {quote.get('valid_until', 'N/A') or 'N/A'}</p>
        <p>Please review and let us know if you'd like to proceed or if you have any questions.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Thank you for considering our services!<br>
            {company_name}
        </p>
    </div>
    """
    
    await send_email_with_attachment(
        to_email=quote["client_email"],
        subject=f"Quote {quote['quote_number']} from {company_name}",
        body_html=email_body,
        attachment_data=pdf_data,
        attachment_filename=f"{quote['quote_number']}.pdf"
    )
    
    # Update quote status to sent if it was draft
    if quote.get("status") == "draft":
        await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "sent"}})
    
    return {"message": f"Quote sent to {quote['client_email']}"}

# ==================== FILE SERVING ====================

@api_router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded files like logos and receipts"""
    logger.info(f"Serving file request: {filename}")
    filepath = UPLOAD_DIR / filename
    logger.info(f"Looking for file at: {filepath}")
    logger.info(f"UPLOAD_DIR is: {UPLOAD_DIR}")
    logger.info(f"File exists: {filepath.exists()}")
    
    if not filepath.exists():
        logger.error(f"File not found: {filepath}")
        # List contents of upload dir for debugging
        try:
            files = list(UPLOAD_DIR.iterdir())
            logger.info(f"Files in upload dir: {files}")
        except Exception as e:
            logger.error(f"Error listing upload dir: {e}")
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
    logger.info(f"Serving file: {filepath}")
    return FileResponse(
        path=str(filepath),
        filename=filename,
        media_type="application/octet-stream"
    )

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
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
