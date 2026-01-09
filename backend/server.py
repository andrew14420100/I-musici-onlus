from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from enum import Enum
from passlib.context import CryptContext
from jose import JWTError, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Create the main app without a prefix
app = FastAPI(title="Accademia de 'I Musici' API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "accademia-musici-secret-key-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# ===================== ENUMS =====================
class UserRole(str, Enum):
    ADMIN = "amministratore"
    TEACHER = "insegnante"
    STUDENT = "allievo"
    SECRETARY = "segretaria"

class AttendanceStatus(str, Enum):
    PRESENT = "presente"
    ABSENT_JUSTIFIED = "assente_giustificato"
    ABSENT_UNJUSTIFIED = "assente_non_giustificato"
    MAKEUP = "recupero"

class PaymentStatus(str, Enum):
    PENDING = "in_attesa"
    PAID = "pagato"
    OVERDUE = "scaduto"

class PaymentType(str, Enum):
    MONTHLY = "mensile"
    ANNUAL = "annuale"
    TEACHER_COMPENSATION = "compenso_insegnante"

class NotificationType(str, Enum):
    GENERAL = "generale"
    PAYMENT = "pagamento"
    LESSON = "lezione"
    PAYMENT_REQUEST = "pagamenti_da_effettuare"
    EVENT = "eventi"

class RecipientType(str, Enum):
    ALL = "tutti"
    SPECIFIC = "singoli"

# Instruments list
INSTRUMENTS = ["pianoforte", "canto", "percussioni", "violino", "chitarra", "chitarra_elettrica"]

# Settings
PAYMENT_DUE_DAY = 7  # Giorno di scadenza pagamento mensile
PAYMENT_TOLERANCE_DAYS = 0  # Tolleranza in giorni (configurabile)

# ===================== MODELS =====================

# 1. UTENTI - Main users table
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    ruolo: UserRole
    nome: str
    cognome: str
    email: str
    password_hash: str
    data_nascita: Optional[str] = None  # YYYY-MM-DD
    attivo: bool = True
    first_login: bool = True  # True = must change password
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ultimo_accesso: Optional[datetime] = None
    note_admin: Optional[str] = None

class UserCreate(BaseModel):
    ruolo: UserRole
    nome: str
    cognome: str
    email: str
    password: str  # Plain password, will be hashed
    data_nascita: Optional[str] = None
    note_admin: Optional[str] = None
    # For students - which teacher they belong to
    insegnante_id: Optional[str] = None
    # For teachers - which instrument they teach
    strumento: Optional[str] = None

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None  # New password if changing
    data_nascita: Optional[str] = None
    attivo: Optional[bool] = None
    first_login: Optional[bool] = None
    note_admin: Optional[str] = None
    insegnante_id: Optional[str] = None
    strumento: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    ruolo: UserRole
    nome: str
    cognome: str
    email: str
    attivo: bool
    first_login: bool
    data_nascita: Optional[str] = None
    data_creazione: datetime
    ultimo_accesso: Optional[datetime] = None

# 2. ACCESSO_AMMINISTRAZIONE - Admin 2-factor auth
class AdminAccess(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    utente_id: str
    pin_hash: str
    pin_attivo: bool = True
    google_id: Optional[str] = None
    ultimo_accesso: Optional[datetime] = None

class AdminAccessCreate(BaseModel):
    utente_id: str
    pin: str  # Plain PIN, will be hashed

class AdminAccessUpdate(BaseModel):
    pin: Optional[str] = None
    pin_attivo: Optional[bool] = None

# 3. SESSIONI - Session management
class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    utente_id: str
    token_sessione: str
    dispositivo: str = "web"
    ip: Optional[str] = None
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_scadenza: datetime

# 4. ALLIEVI_DETTAGLIO - Student details
class StudentDetail(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    utente_id: str
    telefono: Optional[str] = None
    data_nascita: Optional[str] = None
    corso_principale: Optional[str] = None  # Instrument
    note: Optional[str] = None

class StudentDetailCreate(BaseModel):
    telefono: Optional[str] = None
    data_nascita: Optional[str] = None
    corso_principale: Optional[str] = None
    note: Optional[str] = None

# 5. INSEGNANTI_DETTAGLIO - Teacher details
class TeacherDetail(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    utente_id: str
    specializzazione: Optional[str] = None  # Instrument
    compenso_orario: Optional[float] = None
    note: Optional[str] = None

class TeacherDetailCreate(BaseModel):
    specializzazione: Optional[str] = None
    compenso_orario: Optional[float] = None
    note: Optional[str] = None

# Attendance Models
class Attendance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    corso_id: Optional[str] = None
    lezione_id: Optional[str] = None
    allievo_id: str
    insegnante_id: str
    data: datetime
    stato: AttendanceStatus = AttendanceStatus.PRESENT
    recupero_data: Optional[datetime] = None  # Data di recupero se giustificato
    note: Optional[str] = None
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceCreate(BaseModel):
    corso_id: Optional[str] = None
    lezione_id: Optional[str] = None
    allievo_id: str
    data: str  # YYYY-MM-DD format
    stato: AttendanceStatus = AttendanceStatus.PRESENT
    recupero_data: Optional[str] = None  # YYYY-MM-DD format
    note: Optional[str] = None

# Course Models
class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    nome: str
    strumento: str
    insegnante_id: str
    descrizione: Optional[str] = None
    attivo: bool = True
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CourseCreate(BaseModel):
    nome: str
    strumento: str
    insegnante_id: str
    descrizione: Optional[str] = None

class CourseUpdate(BaseModel):
    nome: Optional[str] = None
    strumento: Optional[str] = None
    insegnante_id: Optional[str] = None
    descrizione: Optional[str] = None
    attivo: Optional[bool] = None

# Lesson Models
class Lesson(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    corso_id: str
    insegnante_id: str
    data: datetime
    ora: str  # HH:MM format
    durata: int  # minuti
    note: Optional[str] = None
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LessonCreate(BaseModel):
    corso_id: str
    insegnante_id: str
    data: str  # YYYY-MM-DD
    ora: str  # HH:MM
    durata: int  # minuti

class LessonUpdate(BaseModel):
    data: Optional[str] = None
    ora: Optional[str] = None
    durata: Optional[int] = None
    note: Optional[str] = None

# Teacher Compensation Models
class TeacherCompensation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    insegnante_id: str
    corso_id: Optional[str] = None
    quota_per_presenza: float  # Compenso per ogni presenza
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeacherCompensationCreate(BaseModel):
    insegnante_id: str
    corso_id: Optional[str] = None
    quota_per_presenza: float

# Assignment Models
class Assignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    insegnante_id: str
    allievo_id: str
    titolo: str
    descrizione: str
    data_scadenza: datetime
    completato: bool = False
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssignmentCreate(BaseModel):
    allievo_id: str
    titolo: str
    descrizione: str
    data_scadenza: str  # YYYY-MM-DD format

# Payment Models
class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    utente_id: str
    tipo: PaymentType  # mensile / annuale / compenso_insegnante
    importo: float
    descrizione: str
    data_scadenza: datetime
    stato: PaymentStatus = PaymentStatus.PENDING
    data_pagamento: Optional[datetime] = None  # Data effettiva del pagamento
    data_inizio_validita: Optional[datetime] = None  # Per pagamenti annuali
    data_fine_validita: Optional[datetime] = None  # Per pagamenti annuali
    tolleranza_giorni: int = 0  # Configurabile da Admin
    visibile_utente: bool = True
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentCreate(BaseModel):
    utente_id: str
    tipo: PaymentType
    importo: float
    descrizione: str
    data_scadenza: str  # YYYY-MM-DD
    tolleranza_giorni: int = 0

class PaymentUpdate(BaseModel):
    importo: Optional[float] = None
    descrizione: Optional[str] = None
    data_scadenza: Optional[str] = None
    stato: Optional[PaymentStatus] = None
    data_pagamento: Optional[str] = None
    tolleranza_giorni: Optional[int] = None
    visibile_utente: Optional[bool] = None

# Payment Request Models (for in-app payment flow)
class PaymentRequestStatus(str, Enum):
    PENDING = "in_attesa"  # Allievo deve ancora confermare
    CONFIRMED = "confermato"  # Allievo ha confermato, admin deve approvare
    APPROVED = "approvato"  # Admin ha approvato, pagamento completato
    REJECTED = "rifiutato"  # Admin ha rifiutato

class PaymentRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    utente_id: str
    importo: float
    causale: str
    scadenza: datetime
    note: Optional[str] = None
    stato: PaymentRequestStatus = PaymentRequestStatus.PENDING
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_conferma_allievo: Optional[datetime] = None  # Quando l'allievo conferma
    data_approvazione_admin: Optional[datetime] = None  # Quando l'admin approva
    note_allievo: Optional[str] = None  # Note/ricevuta caricata dall'allievo
    notification_id: Optional[str] = None  # Link alla notifica originale

class PaymentRequestCreate(BaseModel):
    destinatari_ids: list[str]  # Lista di utente_id degli allievi
    importo: float
    causale: str
    scadenza: str  # YYYY-MM-DD format
    note: Optional[str] = None

# Lesson Slot / Booking Models (Calendar System)
class LessonSlotStatus(str, Enum):
    AVAILABLE = "disponibile"
    BOOKED = "prenotato"
    CANCELLED = "annullato"

class LessonSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    insegnante_id: str
    strumento: str  # pianoforte, canto, etc.
    data: datetime  # Date and time of the lesson
    durata: int = 60  # Duration in minutes (30, 45, 60)
    stato: LessonSlotStatus = LessonSlotStatus.AVAILABLE
    allievo_id: Optional[str] = None  # Who booked (if booked)
    note: Optional[str] = None
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_prenotazione: Optional[datetime] = None  # When it was booked

class LessonSlotCreate(BaseModel):
    insegnante_id: str
    strumento: str
    data: str  # YYYY-MM-DD
    ora: str  # HH:MM
    durata: int = 60

class LessonSlotUpdate(BaseModel):
    insegnante_id: Optional[str] = None
    strumento: Optional[str] = None
    data: Optional[str] = None
    ora: Optional[str] = None
    durata: Optional[int] = None
    note: Optional[str] = None

class BookLessonRequest(BaseModel):
    allievo_id: Optional[str] = None  # If admin books for someone

# Notification Models
class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    titolo: str
    messaggio: str
    tipo: NotificationType = NotificationType.GENERAL  # generale / pagamento / lezione
    destinatari_tipo: RecipientType = RecipientType.ALL  # tutti / singoli
    destinatari_ids: List[str] = []  # Empty = all users
    filtro_pagamento: Optional[str] = None  # null / in_attesa / scaduto
    attivo: bool = True
    data_creazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationCreate(BaseModel):
    titolo: str
    messaggio: str
    tipo: str = "generale"
    destinatari_tipo: str = "tutti"
    destinatari_ids: List[str] = []
    filtro_pagamento: Optional[str] = None

# Login Models
class LoginRequest(BaseModel):
    email: str
    password: str

class AdminPinRequest(BaseModel):
    email: str
    pin: str

class AdminGoogleRequest(BaseModel):
    email: str
    session_id: str  # From Google OAuth

# ===================== HELPER FUNCTIONS =====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    return token

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token"""
    token = await get_session_token(request)
    if not token:
        return None
    
    # Check session in database
    session = await db.sessioni.find_one({"token_sessione": token}, {"_id": 0})
    if not session:
        return None
    
    # Check expiration
    scadenza = session.get("data_scadenza")
    if scadenza:
        if isinstance(scadenza, str):
            scadenza = datetime.fromisoformat(scadenza.replace('Z', '+00:00'))
        if scadenza.tzinfo is None:
            scadenza = scadenza.replace(tzinfo=timezone.utc)
        if scadenza <= datetime.now(timezone.utc):
            return None
    
    # Get user
    user = await db.utenti.find_one({"id": session["utente_id"]}, {"_id": 0})
    if not user or not user.get("attivo", False):
        return None
    
    return user

async def require_auth(request: Request) -> dict:
    """Require authentication - raises HTTPException if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Non autenticato")
    return user

async def require_admin(request: Request) -> dict:
    """Require admin role"""
    user = await require_auth(request)
    if user.get("ruolo") != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Accesso negato - Solo amministratori")
    return user

async def require_teacher_or_admin(request: Request) -> dict:
    """Require teacher or admin role"""
    user = await require_auth(request)
    if user.get("ruolo") not in [UserRole.ADMIN.value, UserRole.TEACHER.value]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    return user

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/login")
async def login(login_data: LoginRequest, request: Request, response: Response):
    """Login for all users (email + password) - including Admin"""
    # Find user by email
    user = await db.utenti.find_one({"email": login_data.email.lower()}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Email o password non validi")
    
    # Check if user is active
    if not user.get("attivo", False):
        raise HTTPException(status_code=401, detail="Account disattivato. Contattare l'amministrazione.")
    
    # Verify password
    if not verify_password(login_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o password non validi")
    
    # Create session
    token = create_access_token({"sub": user["id"], "ruolo": user["ruolo"]})
    scadenza = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    
    session = {
        "id": str(uuid4()),
        "utente_id": user["id"],
        "token_sessione": token,
        "dispositivo": request.headers.get("User-Agent", "unknown")[:100],
        "ip": request.client.host if request.client else None,
        "data_creazione": datetime.now(timezone.utc),
        "data_scadenza": scadenza
    }
    
    await db.sessioni.insert_one(session)
    
    # Update last access
    await db.utenti.update_one(
        {"id": user["id"]},
        {"$set": {"ultimo_accesso": datetime.now(timezone.utc)}}
    )
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    # Return user data (without sensitive fields)
    user_response = {
        "id": user["id"],
        "ruolo": user["ruolo"],
        "nome": user["nome"],
        "cognome": user["cognome"],
        "email": user["email"],
        "attivo": user["attivo"]
    }
    
    # Add details based on role
    if user["ruolo"] == UserRole.STUDENT.value:
        detail = await db.allievi_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
        if detail:
            user_response["dettaglio"] = detail
    elif user["ruolo"] == UserRole.TEACHER.value:
        detail = await db.insegnanti_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
        if detail:
            user_response["dettaglio"] = detail
    
    return {"user": user_response, "token": token}

@api_router.post("/auth/admin/pin")
async def admin_pin_verify(pin_data: AdminPinRequest, request: Request):
    """Step 1 of admin login - verify PIN"""
    # Find admin user
    user = await db.utenti.find_one({
        "email": pin_data.email.lower(),
        "ruolo": UserRole.ADMIN.value
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    if not user.get("attivo", False):
        raise HTTPException(status_code=401, detail="Account disattivato")
    
    # Get admin access record
    admin_access = await db.accesso_amministrazione.find_one({
        "utente_id": user["id"]
    }, {"_id": 0})
    
    if not admin_access or not admin_access.get("pin_attivo", False):
        raise HTTPException(status_code=401, detail="PIN non configurato")
    
    # Verify PIN
    if not verify_password(pin_data.pin, admin_access.get("pin_hash", "")):
        raise HTTPException(status_code=401, detail="PIN non valido")
    
    # Create temporary token for Google step
    temp_token = create_access_token(
        {"sub": user["id"], "step": "google_pending"},
        expires_delta=timedelta(minutes=5)
    )
    
    return {
        "message": "PIN verificato. Procedere con Google.",
        "temp_token": temp_token,
        "user_id": user["id"]
    }

@api_router.post("/auth/admin/google")
async def admin_google_verify(google_data: AdminGoogleRequest, request: Request, response: Response):
    """Step 2 of admin login - verify Google"""
    # Find admin user
    user = await db.utenti.find_one({
        "email": google_data.email.lower(),
        "ruolo": UserRole.ADMIN.value
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    # Exchange session_id with Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": google_data.session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Sessione Google non valida")
            
            google_data_resp = auth_response.json()
        except Exception as e:
            logger.error(f"Google auth error: {e}")
            raise HTTPException(status_code=500, detail="Errore di autenticazione Google")
    
    # Verify email matches
    if google_data_resp.get("email", "").lower() != user["email"].lower():
        raise HTTPException(status_code=401, detail="Account Google non autorizzato")
    
    # Update admin access with google_id
    await db.accesso_amministrazione.update_one(
        {"utente_id": user["id"]},
        {"$set": {
            "google_id": google_data_resp.get("sub"),
            "ultimo_accesso": datetime.now(timezone.utc)
        }}
    )
    
    # Create session
    token = create_access_token({"sub": user["id"], "ruolo": user["ruolo"]})
    scadenza = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    
    session = {
        "id": str(uuid4()),
        "utente_id": user["id"],
        "token_sessione": token,
        "dispositivo": request.headers.get("User-Agent", "unknown")[:100],
        "ip": request.client.host if request.client else None,
        "data_creazione": datetime.now(timezone.utc),
        "data_scadenza": scadenza
    }
    
    await db.sessioni.insert_one(session)
    
    # Update last access
    await db.utenti.update_one(
        {"id": user["id"]},
        {"$set": {"ultimo_accesso": datetime.now(timezone.utc)}}
    )
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    user_response = {
        "id": user["id"],
        "ruolo": user["ruolo"],
        "nome": user["nome"],
        "cognome": user["cognome"],
        "email": user["email"],
        "attivo": user["attivo"]
    }
    
    return {"user": user_response, "token": token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Non autenticato")
    
    # Remove sensitive fields
    user_response = {
        "id": user["id"],
        "ruolo": user["ruolo"],
        "nome": user["nome"],
        "cognome": user["cognome"],
        "email": user["email"],
        "attivo": user["attivo"],
        "data_creazione": user.get("data_creazione"),
        "ultimo_accesso": user.get("ultimo_accesso")
    }
    
    # Add details based on role
    if user["ruolo"] == UserRole.STUDENT.value:
        detail = await db.allievi_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
        if detail:
            user_response["dettaglio"] = detail
    elif user["ruolo"] == UserRole.TEACHER.value:
        detail = await db.insegnanti_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
        if detail:
            user_response["dettaglio"] = detail
    
    return user_response

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    token = await get_session_token(request)
    if token:
        await db.sessioni.delete_many({"token_sessione": token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logout effettuato"}

# ===================== USER MANAGEMENT (Admin only) =====================

@api_router.get("/utenti")
async def get_users(
    request: Request,
    ruolo: Optional[str] = None,
    attivo: Optional[bool] = None
):
    """Get all users (Admin only)"""
    await require_admin(request)
    
    query = {}
    if ruolo:
        query["ruolo"] = ruolo
    if attivo is not None:
        query["attivo"] = attivo
    
    users = await db.utenti.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Add details for each user
    for user in users:
        if user["ruolo"] == UserRole.STUDENT.value:
            detail = await db.allievi_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
            if detail:
                user["dettaglio"] = detail
        elif user["ruolo"] == UserRole.TEACHER.value:
            detail = await db.insegnanti_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
            if detail:
                user["dettaglio"] = detail
    
    return users

@api_router.get("/utenti/{user_id}")
async def get_user(user_id: str, request: Request):
    """Get single user (Admin only or own profile)"""
    current_user = await require_auth(request)
    
    # Users can only view their own profile unless admin
    if current_user["ruolo"] != UserRole.ADMIN.value and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    user = await db.utenti.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Add details
    if user["ruolo"] == UserRole.STUDENT.value:
        detail = await db.allievi_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
        if detail:
            user["dettaglio"] = detail
    elif user["ruolo"] == UserRole.TEACHER.value:
        detail = await db.insegnanti_dettaglio.find_one({"utente_id": user["id"]}, {"_id": 0})
        if detail:
            user["dettaglio"] = detail
    
    return user

@api_router.get("/utenti/check-duplicates")
async def check_duplicates(
    request: Request,
    email: Optional[str] = None,
    nome: Optional[str] = None,
    cognome: Optional[str] = None,
    data_nascita: Optional[str] = None
):
    """Check if a user with the given data already exists (Admin only)"""
    await require_admin(request)
    
    # Check email duplicate
    if email:
        existing_email = await db.utenti.find_one({"email": email.lower()})
        if existing_email:
            return {"exists": True, "message": "Esiste già un utente con questa email"}
    
    # Check name + surname + birth date duplicate (for students)
    if nome and cognome and data_nascita:
        existing_person = await db.utenti.find_one({
            "nome": {"$regex": f"^{nome}$", "$options": "i"},
            "cognome": {"$regex": f"^{cognome}$", "$options": "i"},
            "data_nascita": data_nascita
        })
        if existing_person:
            return {"exists": True, "message": f"Allievo già presente con questi dati: {nome} {cognome}"}
    
    return {"exists": False}

@api_router.post("/utenti")
async def create_user(user_data: UserCreate, request: Request):
    """Create a new user (Admin only)"""
    await require_admin(request)
    
    # Check if email already exists
    existing = await db.utenti.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Create user
    user_id = str(uuid4())
    new_user = {
        "id": user_id,
        "ruolo": user_data.ruolo.value,
        "nome": user_data.nome,
        "cognome": user_data.cognome,
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "data_nascita": user_data.data_nascita,
        "attivo": True,
        "first_login": True,
        "data_creazione": datetime.now(timezone.utc),
        "ultimo_accesso": None,
        "note_admin": user_data.note_admin,
        # Student: which teacher they belong to
        "insegnante_id": user_data.insegnante_id if user_data.ruolo == UserRole.STUDENT else None,
        # Teacher: which instrument they teach
        "strumento": user_data.strumento if user_data.ruolo == UserRole.TEACHER else None
    }
    
    result = await db.utenti.insert_one(new_user)
    
    # Create admin access if role is admin
    if user_data.ruolo == UserRole.ADMIN:
        # Default PIN is "1234" - should be changed immediately
        admin_access = {
            "id": str(uuid4()),
            "utente_id": user_id,
            "pin_hash": hash_password("1234"),
            "pin_attivo": True,
            "google_id": None,
            "ultimo_accesso": None
        }
        await db.accesso_amministrazione.insert_one(admin_access)
    
    # Return user without password and _id
    new_user.pop("password_hash", None)
    new_user.pop("_id", None)
    return new_user

@api_router.put("/utenti/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, request: Request):
    """Update a user (Admin only)"""
    await require_admin(request)
    
    # Check user exists
    existing = await db.utenti.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    update_dict = {}
    if user_data.nome is not None:
        update_dict["nome"] = user_data.nome
    if user_data.cognome is not None:
        update_dict["cognome"] = user_data.cognome
    if user_data.email is not None:
        # Check email uniqueness
        email_exists = await db.utenti.find_one({"email": user_data.email.lower(), "id": {"$ne": user_id}})
        if email_exists:
            raise HTTPException(status_code=400, detail="Email già in uso")
        update_dict["email"] = user_data.email.lower()
    if user_data.password is not None:
        update_dict["password_hash"] = hash_password(user_data.password)
    if user_data.data_nascita is not None:
        update_dict["data_nascita"] = user_data.data_nascita
    if user_data.attivo is not None:
        update_dict["attivo"] = user_data.attivo
    if user_data.first_login is not None:
        update_dict["first_login"] = user_data.first_login
    if user_data.note_admin is not None:
        update_dict["note_admin"] = user_data.note_admin
    if user_data.insegnante_id is not None:
        update_dict["insegnante_id"] = user_data.insegnante_id
    if user_data.strumento is not None:
        update_dict["strumento"] = user_data.strumento
    
    if update_dict:
        await db.utenti.update_one({"id": user_id}, {"$set": update_dict})
    
    user = await db.utenti.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/utenti/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user (Admin only)"""
    await require_admin(request)
    
    result = await db.utenti.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Clean up related data
    await db.sessioni.delete_many({"utente_id": user_id})
    await db.accesso_amministrazione.delete_many({"utente_id": user_id})
    await db.allievi_dettaglio.delete_many({"utente_id": user_id})
    await db.insegnanti_dettaglio.delete_many({"utente_id": user_id})
    
    return {"message": "Utente eliminato"}

# ===================== STUDENT DETAIL ROUTES =====================

@api_router.post("/utenti/{user_id}/dettaglio-allievo")
async def create_student_detail(user_id: str, detail: StudentDetailCreate, request: Request):
    """Create/update student details (Admin only)"""
    await require_admin(request)
    
    # Verify user exists and is a student
    user = await db.utenti.find_one({"id": user_id, "ruolo": UserRole.STUDENT.value})
    if not user:
        raise HTTPException(status_code=404, detail="Allievo non trovato")
    
    # Upsert detail
    detail_data = {
        "utente_id": user_id,
        "telefono": detail.telefono,
        "data_nascita": detail.data_nascita,
        "corso_principale": detail.corso_principale,
        "note": detail.note
    }
    
    existing = await db.allievi_dettaglio.find_one({"utente_id": user_id})
    if existing:
        await db.allievi_dettaglio.update_one({"utente_id": user_id}, {"$set": detail_data})
    else:
        detail_data["id"] = str(uuid4())
        await db.allievi_dettaglio.insert_one(detail_data)
    
    return await db.allievi_dettaglio.find_one({"utente_id": user_id}, {"_id": 0})

# ===================== TEACHER DETAIL ROUTES =====================

@api_router.post("/utenti/{user_id}/dettaglio-insegnante")
async def create_teacher_detail(user_id: str, detail: TeacherDetailCreate, request: Request):
    """Create/update teacher details (Admin only)"""
    await require_admin(request)
    
    # Verify user exists and is a teacher
    user = await db.utenti.find_one({"id": user_id, "ruolo": UserRole.TEACHER.value})
    if not user:
        raise HTTPException(status_code=404, detail="Insegnante non trovato")
    
    # Upsert detail
    detail_data = {
        "utente_id": user_id,
        "specializzazione": detail.specializzazione,
        "compenso_orario": detail.compenso_orario,
        "note": detail.note
    }
    
    existing = await db.insegnanti_dettaglio.find_one({"utente_id": user_id})
    if existing:
        await db.insegnanti_dettaglio.update_one({"utente_id": user_id}, {"$set": detail_data})
    else:
        detail_data["id"] = str(uuid4())
        await db.insegnanti_dettaglio.insert_one(detail_data)
    
    return await db.insegnanti_dettaglio.find_one({"utente_id": user_id}, {"_id": 0})

# ===================== ADMIN PIN MANAGEMENT =====================

@api_router.put("/admin/pin/{user_id}")
async def update_admin_pin(user_id: str, request: Request):
    """Update admin PIN (Admin only)"""
    current_admin = await require_admin(request)
    
    body = await request.json()
    new_pin = body.get("pin")
    
    if not new_pin or len(new_pin) < 4:
        raise HTTPException(status_code=400, detail="PIN deve essere di almeno 4 caratteri")
    
    # Verify target is an admin
    user = await db.utenti.find_one({"id": user_id, "ruolo": UserRole.ADMIN.value})
    if not user:
        raise HTTPException(status_code=404, detail="Amministratore non trovato")
    
    await db.accesso_amministrazione.update_one(
        {"utente_id": user_id},
        {"$set": {"pin_hash": hash_password(new_pin), "pin_attivo": True}},
        upsert=True
    )
    
    return {"message": "PIN aggiornato"}

# ===================== ATTENDANCE ROUTES =====================

@api_router.get("/presenze")
async def get_attendance(
    request: Request,
    allievo_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get attendance records"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Filter based on role
    if current_user["ruolo"] == UserRole.STUDENT.value:
        query["allievo_id"] = current_user["id"]
    elif current_user["ruolo"] == UserRole.TEACHER.value:
        query["insegnante_id"] = current_user["id"]
        if allievo_id:
            query["allievo_id"] = allievo_id
    else:  # Admin
        if allievo_id:
            query["allievo_id"] = allievo_id
    
    if from_date:
        query["data"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        if "data" in query:
            query["data"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["data"] = {"$lte": datetime.fromisoformat(to_date)}
    
    records = await db.presenze.find(query, {"_id": 0}).sort("data", -1).to_list(500)
    return records

@api_router.post("/presenze")
async def create_attendance(attendance_data: AttendanceCreate, request: Request):
    """Create attendance record (Teacher or Admin)"""
    current_user = await require_teacher_or_admin(request)
    
    record = {
        "id": str(uuid4()),
        "corso_id": attendance_data.corso_id,
        "lezione_id": attendance_data.lezione_id,
        "allievo_id": attendance_data.allievo_id,
        "insegnante_id": current_user["id"],
        "data": datetime.fromisoformat(attendance_data.data),
        "stato": attendance_data.stato.value,
        "recupero_data": datetime.fromisoformat(attendance_data.recupero_data) if attendance_data.recupero_data else None,
        "note": attendance_data.note,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.presenze.insert_one(record)
    record.pop("_id", None)
    return record

@api_router.put("/presenze/{attendance_id}")
async def update_attendance(attendance_id: str, request: Request):
    """Update attendance record (ADMIN ONLY - teachers cannot modify after save)"""
    current_user = await require_auth(request)
    
    body = await request.json()
    
    existing = await db.presenze.find_one({"id": attendance_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Presenza non trovata")
    
    # RULE: Only admin can modify attendance records after creation
    if current_user["ruolo"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo l'amministratore può modificare le presenze salvate")
    
    update_dict = {}
    if "stato" in body:
        update_dict["stato"] = body["stato"]
    if "note" in body:
        update_dict["note"] = body["note"]
    if "recupero_data" in body:
        update_dict["recupero_data"] = datetime.fromisoformat(body["recupero_data"]) if body["recupero_data"] else None
    
    if update_dict:
        await db.presenze.update_one({"id": attendance_id}, {"$set": update_dict})
    
    return await db.presenze.find_one({"id": attendance_id}, {"_id": 0})

@api_router.delete("/presenze/{attendance_id}")
async def delete_attendance(attendance_id: str, request: Request):
    """Delete attendance record (Admin only)"""
    await require_admin(request)
    
    result = await db.presenze.delete_one({"id": attendance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presenza non trovata")
    
    return {"message": "Presenza eliminata"}

# ===================== COURSE ROUTES =====================

@api_router.get("/corsi")
async def get_courses(
    request: Request,
    insegnante_id: Optional[str] = None,
    attivo: Optional[bool] = None
):
    """Get courses"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Teachers can only see their own courses
    if current_user["ruolo"] == UserRole.TEACHER.value:
        query["insegnante_id"] = current_user["id"]
    elif insegnante_id:
        query["insegnante_id"] = insegnante_id
    
    if attivo is not None:
        query["attivo"] = attivo
    
    courses = await db.corsi.find(query, {"_id": 0}).to_list(500)
    
    # Add teacher info
    for course in courses:
        teacher = await db.utenti.find_one({"id": course["insegnante_id"]}, {"_id": 0, "password_hash": 0})
        if teacher:
            course["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
    
    return courses

@api_router.post("/corsi")
async def create_course(course_data: CourseCreate, request: Request):
    """Create course (Admin only)"""
    await require_admin(request)
    
    course = {
        "id": str(uuid4()),
        "nome": course_data.nome,
        "strumento": course_data.strumento,
        "insegnante_id": course_data.insegnante_id,
        "descrizione": course_data.descrizione,
        "attivo": True,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.corsi.insert_one(course)
    course.pop("_id", None)
    return course

@api_router.put("/corsi/{course_id}")
async def update_course(course_id: str, request: Request):
    """Update course (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    
    update_dict = {}
    if "nome" in body:
        update_dict["nome"] = body["nome"]
    if "strumento" in body:
        update_dict["strumento"] = body["strumento"]
    if "insegnante_id" in body:
        update_dict["insegnante_id"] = body["insegnante_id"]
    if "descrizione" in body:
        update_dict["descrizione"] = body["descrizione"]
    if "attivo" in body:
        update_dict["attivo"] = body["attivo"]
    
    if update_dict:
        await db.corsi.update_one({"id": course_id}, {"$set": update_dict})
    
    course = await db.corsi.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    return course

@api_router.delete("/corsi/{course_id}")
async def delete_course(course_id: str, request: Request):
    """Delete course (Admin only)"""
    await require_admin(request)
    
    result = await db.corsi.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    
    return {"message": "Corso eliminato"}

# ===================== LESSON ROUTES =====================

@api_router.get("/lezioni")
async def get_lessons(
    request: Request,
    corso_id: Optional[str] = None,
    insegnante_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get lessons"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Teachers can only see their own lessons
    if current_user["ruolo"] == UserRole.TEACHER.value:
        query["insegnante_id"] = current_user["id"]
    elif insegnante_id:
        query["insegnante_id"] = insegnante_id
    
    if corso_id:
        query["corso_id"] = corso_id
    
    if from_date:
        query["data"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        if "data" in query:
            query["data"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["data"] = {"$lte": datetime.fromisoformat(to_date)}
    
    lessons = await db.lezioni.find(query, {"_id": 0}).sort("data", 1).to_list(500)
    
    # Add course and teacher info
    for lesson in lessons:
        course = await db.corsi.find_one({"id": lesson["corso_id"]}, {"_id": 0})
        if course:
            lesson["corso"] = {"nome": course["nome"], "strumento": course["strumento"]}
        teacher = await db.utenti.find_one({"id": lesson["insegnante_id"]}, {"_id": 0, "password_hash": 0})
        if teacher:
            lesson["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
    
    return lessons

@api_router.post("/lezioni")
async def create_lesson(lesson_data: LessonCreate, request: Request):
    """Create lesson (Admin only)"""
    await require_admin(request)
    
    lesson = {
        "id": str(uuid4()),
        "corso_id": lesson_data.corso_id,
        "insegnante_id": lesson_data.insegnante_id,
        "data": datetime.fromisoformat(lesson_data.data),
        "ora": lesson_data.ora,
        "durata": lesson_data.durata,
        "note": None,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.lezioni.insert_one(lesson)
    lesson.pop("_id", None)
    return lesson

@api_router.put("/lezioni/{lesson_id}")
async def update_lesson(lesson_id: str, request: Request):
    """Update lesson (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    
    update_dict = {}
    if "data" in body:
        update_dict["data"] = datetime.fromisoformat(body["data"])
    if "ora" in body:
        update_dict["ora"] = body["ora"]
    if "durata" in body:
        update_dict["durata"] = body["durata"]
    if "note" in body:
        update_dict["note"] = body["note"]
    
    if update_dict:
        await db.lezioni.update_one({"id": lesson_id}, {"$set": update_dict})
    
    lesson = await db.lezioni.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    return lesson

@api_router.delete("/lezioni/{lesson_id}")
async def delete_lesson(lesson_id: str, request: Request):
    """Delete lesson (Admin only)"""
    await require_admin(request)
    
    result = await db.lezioni.delete_one({"id": lesson_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    return {"message": "Lezione eliminata"}

# ===================== TEACHER COMPENSATION ROUTES =====================

@api_router.get("/compensi")
async def get_compensations(
    request: Request,
    insegnante_id: Optional[str] = None
):
    """Get teacher compensations"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Teachers can only see their own compensations
    if current_user["ruolo"] == UserRole.TEACHER.value:
        query["insegnante_id"] = current_user["id"]
    elif insegnante_id:
        query["insegnante_id"] = insegnante_id
    
    compensations = await db.compensi.find(query, {"_id": 0}).to_list(500)
    return compensations

@api_router.post("/compensi")
async def create_compensation(comp_data: TeacherCompensationCreate, request: Request):
    """Create teacher compensation (Admin only)"""
    await require_admin(request)
    
    compensation = {
        "id": str(uuid4()),
        "insegnante_id": comp_data.insegnante_id,
        "corso_id": comp_data.corso_id,
        "quota_per_presenza": comp_data.quota_per_presenza,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.compensi.insert_one(compensation)
    compensation.pop("_id", None)
    return compensation

@api_router.put("/compensi/{comp_id}")
async def update_compensation(comp_id: str, request: Request):
    """Update compensation (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    
    update_dict = {}
    if "quota_per_presenza" in body:
        update_dict["quota_per_presenza"] = body["quota_per_presenza"]
    if "corso_id" in body:
        update_dict["corso_id"] = body["corso_id"]
    
    if update_dict:
        await db.compensi.update_one({"id": comp_id}, {"$set": update_dict})
    
    compensation = await db.compensi.find_one({"id": comp_id}, {"_id": 0})
    if not compensation:
        raise HTTPException(status_code=404, detail="Compenso non trovato")
    return compensation

@api_router.delete("/compensi/{comp_id}")
async def delete_compensation(comp_id: str, request: Request):
    """Delete compensation (Admin only)"""
    await require_admin(request)
    
    result = await db.compensi.delete_one({"id": comp_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compenso non trovato")
    
    return {"message": "Compenso eliminato"}

# ===================== CALCULATE TEACHER COMPENSATION =====================

@api_router.get("/compensi/calcolo/{insegnante_id}")
async def calculate_teacher_compensation(
    insegnante_id: str,
    from_date: str,
    to_date: str,
    request: Request
):
    """
    Calculate teacher compensation based on attendance records.
    Rules:
    - Presente = pagato
    - Assente = pagato
    - Giustificato = NON pagato
    - Recupero = pagato nel giorno del recupero
    """
    current_user = await require_auth(request)
    
    # Teachers can only see their own, admin can see all
    if current_user["ruolo"] == UserRole.TEACHER.value and current_user["id"] != insegnante_id:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    # Get compensation rate
    comp = await db.compensi.find_one({"insegnante_id": insegnante_id}, {"_id": 0})
    quota = comp["quota_per_presenza"] if comp else 30.0  # Default
    
    # Get attendance records
    query = {
        "insegnante_id": insegnante_id,
        "data": {
            "$gte": datetime.fromisoformat(from_date),
            "$lte": datetime.fromisoformat(to_date)
        }
    }
    
    records = await db.presenze.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate
    presenti = 0
    assenti = 0
    giustificati = 0
    recuperi = 0
    
    for r in records:
        if r["stato"] == AttendanceStatus.PRESENT.value:
            presenti += 1
        elif r["stato"] == AttendanceStatus.ABSENT.value:
            assenti += 1
        elif r["stato"] == AttendanceStatus.JUSTIFIED.value:
            giustificati += 1
            # Check if there's a recovery date
            if r.get("recupero_data"):
                recuperi += 1
    
    # Compenso = (presenti + assenti + recuperi) * quota
    # Giustificati senza recupero = NON pagati
    lezioni_pagate = presenti + assenti + recuperi
    totale = lezioni_pagate * quota
    
    return {
        "insegnante_id": insegnante_id,
        "periodo": {"da": from_date, "a": to_date},
        "dettaglio": {
            "presenti": presenti,
            "assenti": assenti,
            "giustificati": giustificati,
            "recuperi": recuperi
        },
        "quota_per_presenza": quota,
        "lezioni_pagate": lezioni_pagate,
        "totale_compenso": totale
    }

# ===================== PAYMENT AUTOMATION =====================

@api_router.post("/automazioni/aggiorna-pagamenti-scaduti")
async def update_overdue_payments(request: Request):
    """
    Update payment statuses based on due date.
    - Monthly payments: overdue from day 8 of the month
    - With tolerance: overdue from day (7 + tolerance + 1)
    Admin only.
    """
    await require_admin(request)
    
    today = datetime.now(timezone.utc)
    
    # Find all pending payments that are past due
    query = {
        "stato": PaymentStatus.PENDING.value,
        "data_scadenza": {"$lt": today}
    }
    
    # Get payments and check tolerance
    payments = await db.pagamenti.find(query, {"_id": 0}).to_list(1000)
    
    updated_count = 0
    for payment in payments:
        tolerance = payment.get("tolleranza_giorni", PAYMENT_TOLERANCE_DAYS)
        due_date = payment["data_scadenza"]
        
        # Add tolerance days
        actual_due_date = due_date + timedelta(days=tolerance)
        
        if today > actual_due_date:
            await db.pagamenti.update_one(
                {"id": payment["id"]},
                {"$set": {"stato": PaymentStatus.OVERDUE.value}}
            )
            updated_count += 1
    
    return {
        "message": f"Aggiornati {updated_count} pagamenti a SCADUTO",
        "updated_count": updated_count
    }

@api_router.post("/automazioni/crea-pagamenti-mensili")
async def create_monthly_payments(request: Request):
    """
    Create monthly payment entries for all active students.
    Monthly payments have default due date of day 7.
    Admin only.
    """
    await require_admin(request)
    
    body = await request.json()
    importo = body.get("importo", 150.0)
    mese = body.get("mese")  # YYYY-MM format
    descrizione = body.get("descrizione")
    
    if not mese:
        # Default to current month
        now = datetime.now(timezone.utc)
        mese = now.strftime("%Y-%m")
    
    if not descrizione:
        descrizione = f"Quota mensile {mese}"
    
    # Due date is day 7 of the specified month
    due_date = datetime.fromisoformat(f"{mese}-07T23:59:59")
    
    # Get all active students
    students = await db.utenti.find({
        "ruolo": UserRole.STUDENT.value,
        "attivo": True
    }, {"_id": 0}).to_list(500)
    
    created_count = 0
    for student in students:
        # Check if payment already exists for this month
        existing = await db.pagamenti.find_one({
            "utente_id": student["id"],
            "tipo": PaymentType.MONTHLY.value,
            "descrizione": {"$regex": mese}
        })
        
        if not existing:
            payment = {
                "id": str(uuid4()),
                "utente_id": student["id"],
                "tipo": PaymentType.MONTHLY.value,
                "importo": importo,
                "descrizione": descrizione,
                "data_scadenza": due_date,
                "stato": PaymentStatus.PENDING.value,
                "data_pagamento": None,
                "tolleranza_giorni": PAYMENT_TOLERANCE_DAYS,
                "visibile_utente": True,
                "data_creazione": datetime.now(timezone.utc)
            }
            await db.pagamenti.insert_one(payment)
            created_count += 1
    
    return {
        "message": f"Creati {created_count} pagamenti mensili per {mese}",
        "created_count": created_count
    }

@api_router.post("/automazioni/avvisi-pagamento")
async def create_payment_reminders(request: Request):
    """
    Create automatic notifications for pending/overdue payments.
    Admin only.
    """
    await require_admin(request)
    
    body = await request.json()
    tipo_avviso = body.get("tipo", "in_attesa")  # in_attesa | scaduto
    
    # Get users with specified payment status
    query = {"stato": tipo_avviso}
    payments = await db.pagamenti.find(query, {"_id": 0}).to_list(1000)
    
    user_ids = list(set([p["utente_id"] for p in payments]))
    
    if not user_ids:
        return {"message": "Nessun utente con pagamenti " + tipo_avviso}
    
    # Create notification
    if tipo_avviso == "in_attesa":
        titolo = "Promemoria pagamento"
        messaggio = "Ricorda di effettuare il pagamento della quota entro la scadenza."
    else:  # scaduto
        titolo = "Pagamento scaduto"
        messaggio = "Hai un pagamento scaduto. Ti preghiamo di regolarizzare la tua posizione."
    
    notification = {
        "id": str(uuid4()),
        "titolo": titolo,
        "messaggio": messaggio,
        "tipo": NotificationType.PAYMENT.value,
        "destinatari_tipo": RecipientType.SPECIFIC.value,
        "destinatari_ids": user_ids,
        "filtro_pagamento": tipo_avviso,
        "attivo": True,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.notifiche.insert_one(notification)
    
    return {
        "message": f"Creato avviso per {len(user_ids)} utenti con pagamenti {tipo_avviso}",
        "notification_id": notification["id"],
        "recipients_count": len(user_ids)
    }

@api_router.get("/automazioni/pagamenti-in-scadenza")
async def get_expiring_payments(
    request: Request,
    giorni: int = 30
):
    """
    Get annual payments expiring within specified days.
    Useful for creating reminders 1 month before expiration.
    """
    await require_admin(request)
    
    today = datetime.now(timezone.utc)
    future_date = today + timedelta(days=giorni)
    
    query = {
        "tipo": PaymentType.ANNUAL.value,
        "stato": PaymentStatus.PAID.value,
        "data_fine_validita": {
            "$gte": today,
            "$lte": future_date
        }
    }
    
    payments = await db.pagamenti.find(query, {"_id": 0}).to_list(500)
    
    # Add user info
    for payment in payments:
        user = await db.utenti.find_one({"id": payment["utente_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            payment["utente"] = {"nome": user["nome"], "cognome": user["cognome"], "email": user["email"]}
    
    return {
        "message": f"Trovati {len(payments)} pagamenti annuali in scadenza nei prossimi {giorni} giorni",
        "payments": payments
    }

# ===================== SETTINGS API =====================

@api_router.get("/impostazioni")
async def get_settings(request: Request):
    """Get system settings (Admin only)"""
    await require_admin(request)
    
    settings = await db.impostazioni.find_one({}, {"_id": 0})
    if not settings:
        # Default settings
        settings = {
            "payment_due_day": PAYMENT_DUE_DAY,
            "payment_tolerance_days": PAYMENT_TOLERANCE_DAYS,
            "default_monthly_fee": 150.0,
            "annual_reminder_days": 30
        }
        await db.impostazioni.insert_one(settings)
    
    return settings

@api_router.put("/impostazioni")
async def update_settings(request: Request):
    """Update system settings (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    
    update_dict = {}
    if "payment_due_day" in body:
        update_dict["payment_due_day"] = body["payment_due_day"]
    if "payment_tolerance_days" in body:
        update_dict["payment_tolerance_days"] = body["payment_tolerance_days"]
    if "default_monthly_fee" in body:
        update_dict["default_monthly_fee"] = body["default_monthly_fee"]
    if "annual_reminder_days" in body:
        update_dict["annual_reminder_days"] = body["annual_reminder_days"]
    
    if update_dict:
        await db.impostazioni.update_one({}, {"$set": update_dict}, upsert=True)
    
    return await db.impostazioni.find_one({}, {"_id": 0})

# ===================== ASSIGNMENT ROUTES =====================

@api_router.get("/compiti")
async def get_assignments(
    request: Request,
    allievo_id: Optional[str] = None,
    completato: Optional[bool] = None
):
    """Get assignments"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Filter based on role
    if current_user["ruolo"] == UserRole.STUDENT.value:
        query["allievo_id"] = current_user["id"]
    elif current_user["ruolo"] == UserRole.TEACHER.value:
        query["insegnante_id"] = current_user["id"]
        if allievo_id:
            query["allievo_id"] = allievo_id
    else:  # Admin
        if allievo_id:
            query["allievo_id"] = allievo_id
    
    if completato is not None:
        query["completato"] = completato
    
    assignments = await db.compiti.find(query, {"_id": 0}).sort("data_scadenza", 1).to_list(500)
    return assignments

@api_router.post("/compiti")
async def create_assignment(assignment_data: AssignmentCreate, request: Request):
    """Create assignment (Teacher or Admin)"""
    current_user = await require_teacher_or_admin(request)
    
    assignment = {
        "id": str(uuid4()),
        "insegnante_id": current_user["id"],
        "allievo_id": assignment_data.allievo_id,
        "titolo": assignment_data.titolo,
        "descrizione": assignment_data.descrizione,
        "data_scadenza": datetime.fromisoformat(assignment_data.data_scadenza),
        "completato": False,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.compiti.insert_one(assignment)
    assignment.pop("_id", None)
    return assignment

@api_router.put("/compiti/{assignment_id}")
async def update_assignment(assignment_id: str, request: Request):
    """Update assignment"""
    current_user = await require_auth(request)
    
    body = await request.json()
    
    existing = await db.compiti.find_one({"id": assignment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Compito non trovato")
    
    update_dict = {}
    
    # Students can only mark as completed
    if current_user["ruolo"] == UserRole.STUDENT.value:
        if current_user["id"] != existing["allievo_id"]:
            raise HTTPException(status_code=403, detail="Non autorizzato")
        if "completato" in body:
            update_dict["completato"] = body["completato"]
    else:
        # Teachers/admins can update everything
        if "titolo" in body:
            update_dict["titolo"] = body["titolo"]
        if "descrizione" in body:
            update_dict["descrizione"] = body["descrizione"]
        if "data_scadenza" in body:
            update_dict["data_scadenza"] = datetime.fromisoformat(body["data_scadenza"])
        if "completato" in body:
            update_dict["completato"] = body["completato"]
    
    if update_dict:
        await db.compiti.update_one({"id": assignment_id}, {"$set": update_dict})
    
    return await db.compiti.find_one({"id": assignment_id}, {"_id": 0})

@api_router.delete("/compiti/{assignment_id}")
async def delete_assignment(assignment_id: str, request: Request):
    """Delete assignment"""
    await require_teacher_or_admin(request)
    
    result = await db.compiti.delete_one({"id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compito non trovato")
    
    return {"message": "Compito eliminato"}

# ===================== PAYMENT ROUTES =====================

@api_router.get("/pagamenti")
async def get_payments(
    request: Request,
    utente_id: Optional[str] = None,
    tipo: Optional[str] = None,
    stato: Optional[str] = None
):
    """Get payments"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Non-admin users can only see their own payments
    if current_user["ruolo"] != UserRole.ADMIN.value:
        query["utente_id"] = current_user["id"]
        query["visibile_utente"] = True
    else:
        if utente_id:
            query["utente_id"] = utente_id
    
    if tipo:
        query["tipo"] = tipo
    if stato:
        query["stato"] = stato
    
    payments = await db.pagamenti.find(query, {"_id": 0}).sort("data_scadenza", 1).to_list(1000)
    return payments

@api_router.post("/pagamenti")
async def create_payment(payment_data: PaymentCreate, request: Request):
    """Create payment (Admin only)"""
    await require_admin(request)
    
    payment = {
        "id": str(uuid4()),
        "utente_id": payment_data.utente_id,
        "tipo": payment_data.tipo.value,
        "importo": payment_data.importo,
        "descrizione": payment_data.descrizione,
        "data_scadenza": datetime.fromisoformat(payment_data.data_scadenza),
        "stato": PaymentStatus.PENDING.value,
        "visibile_utente": True,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.pagamenti.insert_one(payment)
    payment.pop("_id", None)
    return payment

@api_router.put("/pagamenti/{payment_id}")
async def update_payment(payment_id: str, request: Request):
    """Update payment (Admin only)"""
    await require_admin(request)
    
    # Verifica che il pagamento esista
    existing = await db.pagamenti.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    body = await request.json()
    logger.info(f"Aggiornamento pagamento {payment_id}: {body}")
    
    update_dict = {}
    if "importo" in body:
        update_dict["importo"] = body["importo"]
    if "descrizione" in body:
        update_dict["descrizione"] = body["descrizione"]
    if "data_scadenza" in body:
        update_dict["data_scadenza"] = datetime.fromisoformat(body["data_scadenza"])
    if "stato" in body:
        update_dict["stato"] = body["stato"]
        # Se lo stato diventa "pagato", imposta automaticamente la data di pagamento
        if body["stato"] == PaymentStatus.PAID.value:
            update_dict["data_pagamento"] = datetime.now(timezone.utc)
            logger.info(f"Pagamento {payment_id} segnato come PAGATO")
    if "visibile_utente" in body:
        update_dict["visibile_utente"] = body["visibile_utente"]
    
    if update_dict:
        result = await db.pagamenti.update_one({"id": payment_id}, {"$set": update_dict})
        logger.info(f"Update result: modified_count={result.modified_count}")
    
    payment = await db.pagamenti.find_one({"id": payment_id}, {"_id": 0})
    return payment

@api_router.delete("/pagamenti/{payment_id}")
async def delete_payment(payment_id: str, request: Request):
    """Delete payment (Admin only)"""
    await require_admin(request)
    
    result = await db.pagamenti.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    return {"message": "Pagamento eliminato"}

# ===================== PAYMENT REQUEST ROUTES =====================

@api_router.post("/richieste-pagamento")
async def create_payment_request(request_data: PaymentRequestCreate, request: Request):
    """Create payment request - Admin only"""
    await require_admin(request)
    
    # Parse scadenza
    scadenza = datetime.fromisoformat(request_data.scadenza)
    
    # Crea una richiesta di pagamento per ogni destinatario
    created_requests = []
    
    for utente_id in request_data.destinatari_ids:
        # Verifica che l'utente esista e sia un allievo
        user = await db.utenti.find_one({"id": utente_id})
        if not user or user["ruolo"] != UserRole.STUDENT.value:
            continue
        
        # Crea notifica
        notification = {
            "id": str(uuid4()),
            "titolo": "Pagamento da Effettuare",
            "messaggio": f"Causale: {request_data.causale}\nImporto: €{request_data.importo:.2f}\nScadenza: {request_data.scadenza}",
            "tipo": NotificationType.PAYMENT_REQUEST.value,
            "destinatari_ids": [utente_id],
            "attivo": True,
            "data_creazione": datetime.now(timezone.utc)
        }
        await db.notifiche.insert_one(notification)
        
        # Crea richiesta di pagamento
        payment_request = {
            "id": str(uuid4()),
            "utente_id": utente_id,
            "importo": request_data.importo,
            "causale": request_data.causale,
            "scadenza": scadenza,
            "note": request_data.note,
            "stato": PaymentRequestStatus.PENDING.value,
            "data_creazione": datetime.now(timezone.utc),
            "notification_id": notification["id"]
        }
        await db.richieste_pagamento.insert_one(payment_request)
        payment_request.pop("_id", None)
        created_requests.append(payment_request)
    
    return {"message": f"{len(created_requests)} richieste create", "requests": created_requests}

@api_router.get("/richieste-pagamento")
async def get_payment_requests(request: Request):
    """Get payment requests"""
    current_user = await require_auth(request)
    
    query = {}
    if current_user["ruolo"] != UserRole.ADMIN.value:
        # Gli allievi vedono solo le loro richieste
        query["utente_id"] = current_user["id"]
    
    requests = await db.richieste_pagamento.find(query, {"_id": 0}).sort("data_creazione", -1).to_list(100)
    
    # Arricchisci con dati utente per admin
    if current_user["ruolo"] == UserRole.ADMIN.value:
        for req in requests:
            user = await db.utenti.find_one({"id": req["utente_id"]}, {"_id": 0, "nome": 1, "cognome": 1, "email": 1})
            if user:
                req["utente"] = user
    
    return requests

@api_router.put("/richieste-pagamento/{request_id}/conferma")
async def confirm_payment_request(request_id: str, request: Request):
    """Allievo conferma pagamento effettuato"""
    current_user = await require_auth(request)
    
    body = await request.json()
    note_allievo = body.get("note_allievo", "")
    
    # Trova la richiesta
    payment_request = await db.richieste_pagamento.find_one({"id": request_id})
    if not payment_request:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    
    # Verifica che l'utente sia il proprietario
    if payment_request["utente_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    # Aggiorna stato
    await db.richieste_pagamento.update_one(
        {"id": request_id},
        {"$set": {
            "stato": PaymentRequestStatus.CONFIRMED.value,
            "data_conferma_allievo": datetime.now(timezone.utc),
            "note_allievo": note_allievo
        }}
    )
    
    updated_request = await db.richieste_pagamento.find_one({"id": request_id}, {"_id": 0})
    return updated_request

@api_router.put("/richieste-pagamento/{request_id}/approva")
async def approve_payment_request(request_id: str, request: Request):
    """Admin approva pagamento"""
    await require_admin(request)
    
    # Trova la richiesta
    payment_request = await db.richieste_pagamento.find_one({"id": request_id})
    if not payment_request:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    
    # Aggiorna stato richiesta
    await db.richieste_pagamento.update_one(
        {"id": request_id},
        {"$set": {
            "stato": PaymentRequestStatus.APPROVED.value,
            "data_approvazione_admin": datetime.now(timezone.utc)
        }}
    )
    
    # Crea automaticamente entry in pagamenti
    payment = {
        "id": str(uuid4()),
        "utente_id": payment_request["utente_id"],
        "tipo": PaymentType.MONTHLY.value,  # Default mensile
        "importo": payment_request["importo"],
        "descrizione": payment_request["causale"],
        "data_scadenza": payment_request["scadenza"],
        "stato": PaymentStatus.PAID.value,
        "data_pagamento": datetime.now(timezone.utc),
        "visibile_utente": True,
        "data_creazione": datetime.now(timezone.utc)
    }
    await db.pagamenti.insert_one(payment)
    
    # Aggiorna notifica per mostrare "Pagamento Approvato"
    if payment_request.get("notification_id"):
        await db.notifiche.update_one(
            {"id": payment_request["notification_id"]},
            {"$set": {
                "titolo": "Pagamento Approvato",
                "messaggio": f"Il tuo pagamento di €{payment_request['importo']:.2f} per {payment_request['causale']} è stato approvato!"
            }}
        )
    
    return {"message": "Pagamento approvato e registrato", "payment_id": payment["id"]}

@api_router.put("/richieste-pagamento/{request_id}/rifiuta")
async def reject_payment_request(request_id: str, request: Request):
    """Admin rifiuta pagamento"""
    await require_admin(request)
    
    body = await request.json()
    motivo = body.get("motivo", "")
    
    # Trova la richiesta
    payment_request = await db.richieste_pagamento.find_one({"id": request_id})
    if not payment_request:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    
    # Aggiorna stato
    await db.richieste_pagamento.update_one(
        {"id": request_id},
        {"$set": {
            "stato": PaymentRequestStatus.REJECTED.value,
            "note_admin": motivo
        }}
    )
    
    # Aggiorna notifica
    if payment_request.get("notification_id"):
        await db.notifiche.update_one(
            {"id": payment_request["notification_id"]},
            {"$set": {
                "titolo": "Pagamento Rifiutato",
                "messaggio": f"Il pagamento è stato rifiutato. Motivo: {motivo}"
            }}
        )
    
    return {"message": "Pagamento rifiutato"}

# ===================== NOTIFICATION ROUTES =====================

@api_router.get("/notifiche")
async def get_notifications(
    request: Request,
    attivo_only: bool = True
):
    """Get notifications"""
    current_user = await require_auth(request)
    
    query = {}
    if attivo_only:
        query["attivo"] = True
    
    # Filter by recipient
    if current_user["ruolo"] != UserRole.ADMIN.value:
        query["$or"] = [
            {"destinatari_ids": {"$size": 0}},  # All users
            {"destinatari_ids": current_user["id"]}
        ]
    
    notifications = await db.notifiche.find(query, {"_id": 0}).sort("data_creazione", -1).to_list(100)
    return notifications

@api_router.post("/notifiche")
async def create_notification(notif_data: NotificationCreate, request: Request):
    """Create notification (Admin only)"""
    await require_admin(request)
    
    notification = {
        "id": str(uuid4()),
        "titolo": notif_data.titolo,
        "messaggio": notif_data.messaggio,
        "tipo": notif_data.tipo,
        "destinatari_tipo": notif_data.destinatari_tipo,
        "destinatari_ids": notif_data.destinatari_ids,
        "filtro_pagamento": notif_data.filtro_pagamento,
        "attivo": True,
        "data_creazione": datetime.now(timezone.utc)
    }
    
    await db.notifiche.insert_one(notification)
    notification.pop("_id", None)
    return notification

@api_router.put("/notifiche/{notification_id}")
async def update_notification(notification_id: str, request: Request):
    """Update notification (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    
    update_dict = {}
    if "titolo" in body:
        update_dict["titolo"] = body["titolo"]
    if "messaggio" in body:
        update_dict["messaggio"] = body["messaggio"]
    if "attivo" in body:
        update_dict["attivo"] = body["attivo"]
    
    if update_dict:
        await db.notifiche.update_one({"id": notification_id}, {"$set": update_dict})
    
    notification = await db.notifiche.find_one({"id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return notification

@api_router.delete("/notifiche/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete notification (Admin only)"""
    await require_admin(request)
    
    result = await db.notifiche.delete_one({"id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    
    return {"message": "Notifica eliminata"}

# ===================== CALENDAR / LESSON SLOTS =====================

@api_router.get("/slot-lezioni")
async def get_lesson_slots(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    insegnante_id: Optional[str] = None,
    strumento: Optional[str] = None,
    stato: Optional[str] = None
):
    """Get lesson slots - available for all authenticated users"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Date filter
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
            query["data"] = {"$gte": from_dt}
        except:
            pass
    
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date)
            if "data" in query:
                query["data"]["$lte"] = to_dt
            else:
                query["data"] = {"$lte": to_dt}
        except:
            pass
    
    # Other filters
    if insegnante_id:
        query["insegnante_id"] = insegnante_id
    if strumento:
        query["strumento"] = strumento
    if stato:
        query["stato"] = stato
    
    slots = await db.slot_lezioni.find(query, {"_id": 0}).sort("data", 1).to_list(500)
    
    # Add teacher info to each slot
    for slot in slots:
        teacher = await db.utenti.find_one({"id": slot["insegnante_id"]}, {"_id": 0, "password_hash": 0})
        if teacher:
            slot["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
        
        # Add student info if booked
        if slot.get("allievo_id"):
            student = await db.utenti.find_one({"id": slot["allievo_id"]}, {"_id": 0, "password_hash": 0})
            if student:
                slot["allievo"] = {"nome": student["nome"], "cognome": student["cognome"]}
    
    return slots

@api_router.post("/slot-lezioni")
async def create_lesson_slot(slot_data: LessonSlotCreate, request: Request):
    """Create a new lesson slot (Admin only)"""
    await require_admin(request)
    
    # Parse date and time
    try:
        slot_datetime = datetime.fromisoformat(f"{slot_data.data}T{slot_data.ora}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data/ora non valido. Usa YYYY-MM-DD e HH:MM")
    
    # Verify teacher exists
    teacher = await db.utenti.find_one({"id": slot_data.insegnante_id, "ruolo": UserRole.TEACHER.value})
    if not teacher:
        raise HTTPException(status_code=404, detail="Insegnante non trovato")
    
    # Check for overlapping slots for the same teacher
    overlap_start = slot_datetime
    overlap_end = slot_datetime + timedelta(minutes=slot_data.durata)
    
    existing_slot = await db.slot_lezioni.find_one({
        "insegnante_id": slot_data.insegnante_id,
        "stato": {"$ne": LessonSlotStatus.CANCELLED.value},
        "$or": [
            {"data": {"$gte": overlap_start, "$lt": overlap_end}},
        ]
    })
    
    if existing_slot:
        raise HTTPException(status_code=400, detail="Esiste già uno slot in questo orario per questo insegnante")
    
    slot = {
        "id": str(uuid4()),
        "insegnante_id": slot_data.insegnante_id,
        "strumento": slot_data.strumento,
        "data": slot_datetime,
        "durata": slot_data.durata,
        "stato": LessonSlotStatus.AVAILABLE.value,
        "allievo_id": None,
        "note": None,
        "data_creazione": datetime.now(timezone.utc),
        "data_prenotazione": None
    }
    
    await db.slot_lezioni.insert_one(slot)
    slot.pop("_id", None)
    
    # Add teacher info
    slot["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
    
    return slot

@api_router.put("/slot-lezioni/{slot_id}")
async def update_lesson_slot(slot_id: str, slot_data: LessonSlotUpdate, request: Request):
    """Update a lesson slot (Admin only)"""
    await require_admin(request)
    
    slot = await db.slot_lezioni.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot non trovato")
    
    update_dict = {}
    
    if slot_data.insegnante_id:
        # Verify teacher exists
        teacher = await db.utenti.find_one({"id": slot_data.insegnante_id, "ruolo": UserRole.TEACHER.value})
        if not teacher:
            raise HTTPException(status_code=404, detail="Insegnante non trovato")
        update_dict["insegnante_id"] = slot_data.insegnante_id
    
    if slot_data.strumento:
        update_dict["strumento"] = slot_data.strumento
    
    if slot_data.data and slot_data.ora:
        try:
            update_dict["data"] = datetime.fromisoformat(f"{slot_data.data}T{slot_data.ora}")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato data/ora non valido")
    
    if slot_data.durata:
        update_dict["durata"] = slot_data.durata
    
    if slot_data.note is not None:
        update_dict["note"] = slot_data.note
    
    if update_dict:
        await db.slot_lezioni.update_one({"id": slot_id}, {"$set": update_dict})
    
    updated_slot = await db.slot_lezioni.find_one({"id": slot_id}, {"_id": 0})
    
    # Add teacher info
    teacher = await db.utenti.find_one({"id": updated_slot["insegnante_id"]}, {"_id": 0, "password_hash": 0})
    if teacher:
        updated_slot["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
    
    return updated_slot

@api_router.delete("/slot-lezioni/{slot_id}")
async def delete_lesson_slot(slot_id: str, request: Request):
    """Delete a lesson slot (Admin only)"""
    await require_admin(request)
    
    slot = await db.slot_lezioni.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot non trovato")
    
    # If slot is booked, mark as cancelled instead of deleting
    if slot.get("allievo_id"):
        await db.slot_lezioni.update_one(
            {"id": slot_id},
            {"$set": {"stato": LessonSlotStatus.CANCELLED.value}}
        )
        return {"message": "Slot annullato (era prenotato)"}
    
    result = await db.slot_lezioni.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slot non trovato")
    
    return {"message": "Slot eliminato"}

@api_router.post("/slot-lezioni/{slot_id}/prenota")
async def book_lesson_slot(slot_id: str, booking_data: BookLessonRequest, request: Request):
    """Book a lesson slot - Students can book for themselves, Admin can book for any student"""
    current_user = await require_auth(request)
    
    slot = await db.slot_lezioni.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot non trovato")
    
    if slot["stato"] != LessonSlotStatus.AVAILABLE.value:
        raise HTTPException(status_code=400, detail="Questo slot non è disponibile")
    
    # Determine who is booking
    if current_user["ruolo"] == UserRole.ADMIN.value and booking_data.allievo_id:
        # Admin booking for a specific student
        student = await db.utenti.find_one({"id": booking_data.allievo_id, "ruolo": UserRole.STUDENT.value})
        if not student:
            raise HTTPException(status_code=404, detail="Allievo non trovato")
        booker_id = booking_data.allievo_id
    elif current_user["ruolo"] == UserRole.STUDENT.value:
        # Student booking for themselves
        booker_id = current_user["id"]
    else:
        raise HTTPException(status_code=403, detail="Non autorizzato a prenotare")
    
    # Update slot
    await db.slot_lezioni.update_one(
        {"id": slot_id},
        {
            "$set": {
                "stato": LessonSlotStatus.BOOKED.value,
                "allievo_id": booker_id,
                "data_prenotazione": datetime.now(timezone.utc)
            }
        }
    )
    
    updated_slot = await db.slot_lezioni.find_one({"id": slot_id}, {"_id": 0})
    
    # Add teacher and student info
    teacher = await db.utenti.find_one({"id": updated_slot["insegnante_id"]}, {"_id": 0, "password_hash": 0})
    if teacher:
        updated_slot["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
    
    student = await db.utenti.find_one({"id": booker_id}, {"_id": 0, "password_hash": 0})
    if student:
        updated_slot["allievo"] = {"nome": student["nome"], "cognome": student["cognome"]}
    
    return updated_slot

@api_router.post("/slot-lezioni/{slot_id}/annulla")
async def cancel_booking(slot_id: str, request: Request):
    """Cancel a booking - Student can cancel their own, Admin can cancel any"""
    current_user = await require_auth(request)
    
    slot = await db.slot_lezioni.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot non trovato")
    
    if slot["stato"] != LessonSlotStatus.BOOKED.value:
        raise HTTPException(status_code=400, detail="Questo slot non è prenotato")
    
    # Check authorization
    if current_user["ruolo"] == UserRole.STUDENT.value:
        if slot.get("allievo_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Non puoi annullare la prenotazione di altri")
    elif current_user["ruolo"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    # Free up the slot
    await db.slot_lezioni.update_one(
        {"id": slot_id},
        {
            "$set": {
                "stato": LessonSlotStatus.AVAILABLE.value,
                "allievo_id": None,
                "data_prenotazione": None
            }
        }
    )
    
    updated_slot = await db.slot_lezioni.find_one({"id": slot_id}, {"_id": 0})
    
    # Add teacher info
    teacher = await db.utenti.find_one({"id": updated_slot["insegnante_id"]}, {"_id": 0, "password_hash": 0})
    if teacher:
        updated_slot["insegnante"] = {"nome": teacher["nome"], "cognome": teacher["cognome"]}
    
    return updated_slot

# ===================== TEACHER STUDENTS =====================

@api_router.get("/insegnante/allievi")
async def get_teacher_students(request: Request):
    """Get students for teacher based on specialization"""
    current_user = await require_teacher_or_admin(request)
    
    query = {"ruolo": UserRole.STUDENT.value, "attivo": True}
    
    # If teacher, filter by specialization
    if current_user["ruolo"] == UserRole.TEACHER.value:
        teacher_detail = await db.insegnanti_dettaglio.find_one({"utente_id": current_user["id"]}, {"_id": 0})
        if teacher_detail and teacher_detail.get("specializzazione"):
            # Get students with same course
            student_ids = []
            student_details = await db.allievi_dettaglio.find({
                "corso_principale": teacher_detail["specializzazione"]
            }, {"_id": 0}).to_list(500)
            student_ids = [d["utente_id"] for d in student_details]
            if student_ids:
                query["id"] = {"$in": student_ids}
            else:
                return []  # No students match
    
    students = await db.utenti.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    
    # Add details
    for student in students:
        detail = await db.allievi_dettaglio.find_one({"utente_id": student["id"]}, {"_id": 0})
        if detail:
            student["dettaglio"] = detail
    
    return students

# ===================== STATS =====================

@api_router.get("/stats/admin")
async def get_admin_stats(request: Request):
    """Get admin dashboard statistics"""
    await require_admin(request)
    
    # Count users by role
    allievi = await db.utenti.count_documents({"ruolo": UserRole.STUDENT.value, "attivo": True})
    insegnanti = await db.utenti.count_documents({"ruolo": UserRole.TEACHER.value, "attivo": True})
    
    # Count pending payments
    pagamenti_non_pagati = await db.pagamenti.count_documents({
        "stato": {"$in": [PaymentStatus.PENDING.value, PaymentStatus.OVERDUE.value]}
    })
    
    # Active notifications
    notifiche_attive = await db.notifiche.count_documents({"attivo": True})
    
    # Recent attendance
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    presenze_oggi = await db.presenze.count_documents({"data": {"$gte": today}})
    
    return {
        "allievi_attivi": allievi,
        "insegnanti_attivi": insegnanti,
        "pagamenti_non_pagati": pagamenti_non_pagati,
        "notifiche_attive": notifiche_attive,
        "presenze_oggi": presenze_oggi
    }

# ===================== SEED DATA =====================

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample data"""
    # Check if already seeded
    existing = await db.utenti.count_documents({})
    if existing > 3:
        return {"message": "Database già popolato", "status": "skipped"}
    
    # Create default admin with email/password
    admin_id = str(uuid4())
    admin = {
        "id": admin_id,
        "ruolo": UserRole.ADMIN.value,
        "nome": "Admin",
        "cognome": "Accademia",
        "email": "acc.imusici@gmail.com",
        "password_hash": hash_password("Accademia2026"),
        "attivo": True,
        "data_creazione": datetime.now(timezone.utc),
        "ultimo_accesso": None,
        "note_admin": "Account amministratore principale"
    }
    await db.utenti.insert_one(admin)
    
    # Create sample teachers
    teachers = [
        {"nome": "Mario", "cognome": "Rossi", "email": "mario.rossi@musici.it", "spec": "pianoforte", "compenso": 30.0},
        {"nome": "Lucia", "cognome": "Bianchi", "email": "lucia.bianchi@musici.it", "spec": "violino", "compenso": 35.0},
        {"nome": "Paolo", "cognome": "Verdi", "email": "paolo.verdi@musici.it", "spec": "chitarra", "compenso": 28.0},
        {"nome": "Anna", "cognome": "Neri", "email": "anna.neri@musici.it", "spec": "canto", "compenso": 32.0},
    ]
    
    teacher_ids = []
    for t in teachers:
        teacher_id = str(uuid4())
        teacher_ids.append(teacher_id)
        teacher = {
            "id": teacher_id,
            "ruolo": UserRole.TEACHER.value,
            "nome": t["nome"],
            "cognome": t["cognome"],
            "email": t["email"],
            "password_hash": hash_password("teacher123"),
            "attivo": True,
            "data_creazione": datetime.now(timezone.utc),
            "ultimo_accesso": None,
            "note_admin": None
        }
        await db.utenti.insert_one(teacher)
        
        # Teacher detail
        detail = {
            "id": str(uuid4()),
            "utente_id": teacher_id,
            "specializzazione": t["spec"],
            "compenso_orario": t["compenso"],
            "note": None
        }
        await db.insegnanti_dettaglio.insert_one(detail)
    
    # Create sample students
    students = [
        {"nome": "Giulia", "cognome": "Ferrari", "email": "giulia.ferrari@email.it", "corso": "pianoforte", "tel": "+39 340 1111111"},
        {"nome": "Marco", "cognome": "Romano", "email": "marco.romano@email.it", "corso": "pianoforte", "tel": "+39 340 2222222"},
        {"nome": "Sara", "cognome": "Conti", "email": "sara.conti@email.it", "corso": "violino", "tel": "+39 340 3333333"},
        {"nome": "Luca", "cognome": "Esposito", "email": "luca.esposito@email.it", "corso": "chitarra", "tel": "+39 340 4444444"},
        {"nome": "Anna", "cognome": "Bruno", "email": "anna.bruno@email.it", "corso": "canto", "tel": "+39 340 5555555"},
    ]
    
    student_ids = []
    for s in students:
        student_id = str(uuid4())
        student_ids.append(student_id)
        student = {
            "id": student_id,
            "ruolo": UserRole.STUDENT.value,
            "nome": s["nome"],
            "cognome": s["cognome"],
            "email": s["email"],
            "password_hash": hash_password("student123"),
            "attivo": True,
            "data_creazione": datetime.now(timezone.utc),
            "ultimo_accesso": None,
            "note_admin": None
        }
        await db.utenti.insert_one(student)
        
        # Student detail
        detail = {
            "id": str(uuid4()),
            "utente_id": student_id,
            "telefono": s["tel"],
            "data_nascita": None,
            "corso_principale": s["corso"],
            "note": None
        }
        await db.allievi_dettaglio.insert_one(detail)
    
    # Create sample payments
    now = datetime.now(timezone.utc)
    for i, sid in enumerate(student_ids[:3]):
        payment = {
            "id": str(uuid4()),
            "utente_id": sid,
            "tipo": PaymentType.MONTHLY.value,
            "importo": 150.0,
            "descrizione": f"Quota mensile Luglio 2025",
            "data_scadenza": now + timedelta(days=10 - i*5),
            "stato": PaymentStatus.PENDING.value if i < 2 else PaymentStatus.OVERDUE.value,
            "visibile_utente": True,
            "data_creazione": now
        }
        await db.pagamenti.insert_one(payment)
    
    # Create sample notifications
    notifications = [
        {"titolo": "Benvenuti!", "messaggio": "Benvenuti nella nuova app dell'Accademia de 'I Musici'."},
        {"titolo": "Concerto di fine anno", "messaggio": "Il concerto si terrà il 20 Dicembre 2025."},
    ]
    for n in notifications:
        notif = {
            "id": str(uuid4()),
            "titolo": n["titolo"],
            "messaggio": n["messaggio"],
            "tipo": "generale",
            "destinatari_ids": [],
            "attivo": True,
            "data_creazione": now
        }
        await db.notifiche.insert_one(notif)
    
    return {
        "message": "Database popolato con successo",
        "data": {
            "admin": 1,
            "insegnanti": len(teachers),
            "allievi": len(students),
            "pagamenti": 3,
            "notifiche": 2
        },
        "credenziali_test": {
            "admin": {"email": "acc.imusici@gmail.com", "password": "Accademia2026"},
            "insegnante": {"email": "mario.rossi@musici.it", "password": "teacher123"},
            "allievo": {"email": "giulia.ferrari@email.it", "password": "student123"}
        }
    }


# ===================== CASH PAYMENTS (ADMIN ONLY) =====================

class CashPaymentRequest(BaseModel):
    allievo_id: str
    importo: float
    causale: str
    note: Optional[str] = None

@api_router.post("/pagamenti/contanti")
async def create_cash_payment(request: Request, payment: CashPaymentRequest):
    """Create cash payment (Admin only)"""
    current_user = await require_admin(request)
    
    # Verify student exists
    student = await db.utenti.find_one({"id": payment.allievo_id, "ruolo": UserRole.STUDENT.value}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Allievo non trovato")
    
    # Create payment record
    payment_id = str(uuid4())
    payment_data = {
        "id": payment_id,
        "allievo_id": payment.allievo_id,
        "allievo_nome": student["nome"],
        "allievo_cognome": student["cognome"],
        "importo": payment.importo,
        "metodo": "contanti",
        "stato": "pagato",
        "causale": payment.causale,
        "note": payment.note,
        "data_creazione": datetime.utcnow(),
        "data_pagamento": datetime.utcnow(),
        "operatore_id": current_user["id"],
        "operatore_nome": f"{current_user['nome']} {current_user['cognome']}"
    }
    
    await db.pagamenti.insert_one(payment_data)
    
    return {
        "id": payment_id,
        "message": "Pagamento in contanti registrato con successo",
        "ricevuta": {
            "numero": payment_id[:8].upper(),
            "data": payment_data["data_pagamento"].isoformat(),
            "allievo": f"{student['nome']} {student['cognome']}",
            "importo": payment.importo,
            "causale": payment.causale,
            "operatore": payment_data["operatore_nome"]
        }
    }

# ===================== PAYMENT STATUS UPDATE =====================

class PaymentStatusUpdate(BaseModel):
    stato: str

@api_router.put("/pagamenti/{payment_id}/stato")
async def update_payment_status(request: Request, payment_id: str, status: PaymentStatusUpdate):
    """Update payment status (Admin only)"""
    await require_admin(request)
    
    valid_statuses = ["in_attesa", "pagato", "scaduto", "annullato"]
    if status.stato not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Valori consentiti: {', '.join(valid_statuses)}")
    
    payment = await db.pagamenti.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    update_data = {
        "stato": status.stato,
        "data_aggiornamento": datetime.utcnow()
    }
    
    if status.stato == "pagato" and payment.get("stato") != "pagato":
        update_data["data_pagamento"] = datetime.utcnow()
    
    await db.pagamenti.update_one({"id": payment_id}, {"$set": update_data})
    
    return {"message": f"Stato pagamento aggiornato a: {status.stato}"}

# ===================== SECRETARY PERMISSIONS =====================

class SecretaryPermissions(BaseModel):
    visualizza_pagamenti: bool = False
    modifica_pagamenti: bool = False
    visualizza_rimborsi: bool = False
    modifica_rimborsi: bool = False
    visualizza_dati_burocratici: bool = False
    gestione_utenti: bool = False
    visualizza_calendario: bool = True
    modifica_calendario: bool = False
    invia_notifiche: bool = False

@api_router.get("/segretaria/{user_id}/permessi")
async def get_secretary_permissions(request: Request, user_id: str):
    """Get secretary permissions (Admin only)"""
    await require_admin(request)
    
    # Verify user is secretary
    user = await db.utenti.find_one({"id": user_id, "ruolo": UserRole.SECRETARY.value}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Segretaria non trovata")
    
    permissions = await db.segretaria_permessi.find_one({"utente_id": user_id}, {"_id": 0})
    if not permissions:
        # Return default permissions
        return SecretaryPermissions().dict()
    
    return permissions

@api_router.put("/segretaria/{user_id}/permessi")
async def update_secretary_permissions(request: Request, user_id: str, permissions: SecretaryPermissions):
    """Update secretary permissions (Admin only)"""
    await require_admin(request)
    
    # Verify user is secretary
    user = await db.utenti.find_one({"id": user_id, "ruolo": UserRole.SECRETARY.value}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Segretaria non trovata")
    
    permissions_data = {
        "utente_id": user_id,
        **permissions.dict(),
        "data_aggiornamento": datetime.utcnow()
    }
    
    await db.segretaria_permessi.update_one(
        {"utente_id": user_id},
        {"$set": permissions_data},
        upsert=True
    )
    
    return {"message": "Permessi aggiornati con successo", "permissions": permissions.dict()}

# ===================== LESSON NOTIFICATIONS =====================

class LessonNotification(BaseModel):
    destinatari: List[str] = []  # ['allievo', 'insegnante', 'entrambi']

@api_router.post("/slot-lezioni/{slot_id}/notifica")
async def send_lesson_notification(request: Request, slot_id: str, notif: LessonNotification):
    """Send lesson notification (Admin or Teacher)"""
    current_user = await require_teacher_or_admin(request)
    
    slot = await db.slot_lezioni.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    # Get teacher info
    teacher = await db.utenti.find_one({"id": slot["insegnante_id"]}, {"_id": 0, "password_hash": 0})
    
    # Get student info if booked
    student = None
    if slot.get("allievo_id"):
        student = await db.utenti.find_one({"id": slot["allievo_id"]}, {"_id": 0, "password_hash": 0})
    
    # Format notification message
    data_lezione = slot["data"]
    if isinstance(data_lezione, str):
        try:
            data_obj = datetime.fromisoformat(data_lezione.replace('Z', '+00:00'))
            data_formatted = data_obj.strftime("%d-%m-%Y")
        except:
            data_formatted = data_lezione
    else:
        data_formatted = data_lezione.strftime("%d-%m-%Y")
    
    message = f"📚 Lezione di {slot['strumento']}\n"
    message += f"📅 Data: {data_formatted}\n"
    # Gestisci campo ora che potrebbe non esistere in vecchi slot
    ora_value = slot.get('ora')
    if not ora_value:
        # Fallback: estrai ora da campo data
        data_field = slot.get('data')
        if isinstance(data_field, str) and 'T' in data_field:
            ora_value = data_field.split('T')[1][:5]
        elif isinstance(data_field, datetime):
            ora_value = data_field.strftime('%H:%M')
        else:
            ora_value = 'N/A'
    message += f"🕐 Ora: {ora_value}\n"
    if teacher:
        message += f"👨‍🏫 Insegnante: {teacher['nome']} {teacher['cognome']}\n"
    if student:
        message += f"🎓 Allievo: {student['nome']} {student['cognome']}\n"
    if slot.get("note"):
        message += f"📝 Note: {slot['note']}\n"
    
    notifications_sent = []
    
    # Send to student
    if student and ('allievo' in notif.destinatari or 'entrambi' in notif.destinatari):
        notif_id = str(uuid4())
        notif_data = {
            "id": notif_id,
            "utente_id": student["id"],
            "tipo": "lezione",
            "titolo": f"Promemoria: Lezione di {slot['strumento']}",
            "messaggio": message,
            "letta": False,
            "data": datetime.utcnow(),
            "riferimento_id": slot_id,
            "riferimento_tipo": "slot_lezione"
        }
        await db.notifiche.insert_one(notif_data)
        notifications_sent.append(f"{student['nome']} {student['cognome']}")
    
    # Send to teacher
    if teacher and ('insegnante' in notif.destinatari or 'entrambi' in notif.destinatari):
        notif_id = str(uuid4())
        notif_data = {
            "id": notif_id,
            "utente_id": teacher["id"],
            "tipo": "lezione",
            "titolo": f"Promemoria: Lezione di {slot['strumento']}",
            "messaggio": message,
            "letta": False,
            "data": datetime.utcnow(),
            "riferimento_id": slot_id,
            "riferimento_tipo": "slot_lezione"
        }
        await db.notifiche.insert_one(notif_data)
        notifications_sent.append(f"{teacher['nome']} {teacher['cognome']}")
    
    return {
        "message": f"Notifica inviata a: {', '.join(notifications_sent)}",
        "destinatari": notifications_sent
    }

# ===================== ADMIN QUICK ACTIONS =====================

@api_router.post("/admin/azioni/genera-pagamenti-mensili")
async def generate_monthly_payments(request: Request):
    """Generate monthly payments for all active students"""
    await require_admin(request)
    
    students = await db.utenti.find({"ruolo": UserRole.STUDENT.value, "attivo": True}, {"_id": 0}).to_list(500)
    
    created_count = 0
    current_month = datetime.utcnow().strftime("%m-%Y")
    
    for student in students:
        # Check if payment already exists for this month
        existing = await db.pagamenti.find_one({
            "allievo_id": student["id"],
            "causale": f"Quota mensile {current_month}"
        })
        
        if not existing:
            payment_id = str(uuid4())
            scadenza = datetime.utcnow() + timedelta(days=10)
            
            payment_data = {
                "id": payment_id,
                "allievo_id": student["id"],
                "allievo_nome": student["nome"],
                "allievo_cognome": student["cognome"],
                "importo": 100.0,  # Default amount
                "metodo": "bonifico",
                "stato": "in_attesa",
                "causale": f"Quota mensile {current_month}",
                "data_creazione": datetime.utcnow(),
                "scadenza": scadenza
            }
            
            await db.pagamenti.insert_one(payment_data)
            created_count += 1
    
    return {"message": f"Generati {created_count} pagamenti mensili", "count": created_count}

@api_router.post("/admin/azioni/invia-promemoria-pagamenti")
async def send_payment_reminders(request: Request):
    """Send payment reminders to students with pending payments"""
    await require_admin(request)
    
    pending_payments = await db.pagamenti.find({"stato": "in_attesa"}, {"_id": 0}).to_list(500)
    
    sent_count = 0
    for payment in pending_payments:
        # Create notification
        notif_id = str(uuid4())
        
        scadenza = payment.get("scadenza")
        if scadenza:
            if isinstance(scadenza, str):
                try:
                    scadenza_obj = datetime.fromisoformat(scadenza.replace('Z', '+00:00'))
                    scadenza_str = scadenza_obj.strftime("%d-%m-%Y")
                except:
                    scadenza_str = scadenza
            else:
                scadenza_str = scadenza.strftime("%d-%m-%Y")
        else:
            scadenza_str = "Da definire"
        
        message = f"💰 Pagamento in attesa\n"
        message += f"Importo: €{payment['importo']:.2f}\n"
        message += f"Causale: {payment['causale']}\n"
        message += f"Scadenza: {scadenza_str}\n"
        
        notif_data = {
            "id": notif_id,
            "utente_id": payment["allievo_id"],
            "tipo": "pagamento",
            "titolo": "Promemoria Pagamento",
            "messaggio": message,
            "letta": False,
            "data": datetime.utcnow(),
            "riferimento_id": payment["id"],
            "riferimento_tipo": "pagamento"
        }
        
        await db.notifiche.insert_one(notif_data)
        sent_count += 1
    
    return {"message": f"Inviati {sent_count} promemoria", "count": sent_count}


# ===================== MAIN ROUTES =====================

@api_router.get("/")
async def root():
    return {"message": "API Accademia de 'I Musici'", "version": "2.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
