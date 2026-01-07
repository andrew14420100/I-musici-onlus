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
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

# ===================== ENUMS =====================
class UserRole(str, Enum):
    ADMIN = "admin"
    STUDENT = "studente"
    TEACHER = "insegnante"

class UserStatus(str, Enum):
    ACTIVE = "attivo"
    INACTIVE = "inattivo"

class CourseStatus(str, Enum):
    ACTIVE = "attivo"
    INACTIVE = "inattivo"

class LessonStatus(str, Enum):
    SCHEDULED = "programmata"
    COMPLETED = "completata"
    CANCELLED = "annullata"

class PaymentStatus(str, Enum):
    PENDING = "in_attesa"
    PAID = "pagato"
    OVERDUE = "scaduto"

class PaymentType(str, Enum):
    STUDENT_FEE = "quota_studente"
    TEACHER_COMPENSATION = "compenso_insegnante"

class NotificationType(str, Enum):
    GENERAL = "generale"
    PAYMENT_REMINDER = "promemoria_pagamento"
    LESSON_REMINDER = "promemoria_lezione"

# ===================== MODELS =====================

# Instruments enum
class Instrument(str, Enum):
    PIANOFORTE = "pianoforte"
    CANTO = "canto"
    PERCUSSIONI = "percussioni"
    VIOLINO = "violino"
    CHITARRA = "chitarra"
    CHITARRA_ELETTRICA = "chitarra_elettrica"

# Attendance status
class AttendanceStatus(str, Enum):
    PRESENT = "presente"
    ABSENT = "assente"
    JUSTIFIED = "giustificato"

# User Models
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: UserRole = UserRole.STUDENT
    status: UserStatus = UserStatus.ACTIVE
    phone: Optional[str] = None
    instrument: Optional[str] = None  # For students and teachers
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.STUDENT
    instrument: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[UserStatus] = None
    role: Optional[UserRole] = None
    instrument: Optional[str] = None

# Attendance Models
class Attendance(BaseModel):
    attendance_id: str = Field(default_factory=lambda: f"att_{uuid.uuid4().hex[:12]}")
    lesson_id: str
    student_id: str
    teacher_id: str
    instrument: str
    date: datetime
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceCreate(BaseModel):
    lesson_id: Optional[str] = None
    student_id: str
    date: str  # YYYY-MM-DD format
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Optional[str] = None

class AttendanceUpdate(BaseModel):
    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None

# Assignment Models
class Assignment(BaseModel):
    assignment_id: str = Field(default_factory=lambda: f"assign_{uuid.uuid4().hex[:12]}")
    teacher_id: str
    student_id: str
    instrument: str
    title: str
    description: str
    due_date: datetime
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssignmentCreate(BaseModel):
    student_id: str
    title: str
    description: str
    due_date: str  # YYYY-MM-DD format

class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None

# Course Models
class Course(BaseModel):
    course_id: str = Field(default_factory=lambda: f"course_{uuid.uuid4().hex[:12]}")
    name: str
    instrument: str
    description: Optional[str] = None
    status: CourseStatus = CourseStatus.ACTIVE
    teacher_ids: List[str] = []
    student_ids: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CourseCreate(BaseModel):
    name: str
    instrument: str
    description: Optional[str] = None

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    instrument: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CourseStatus] = None

# Lesson Models
class Lesson(BaseModel):
    lesson_id: str = Field(default_factory=lambda: f"lesson_{uuid.uuid4().hex[:12]}")
    course_id: str
    teacher_id: str
    student_id: str
    date_time: datetime
    duration_minutes: int = 60
    status: LessonStatus = LessonStatus.SCHEDULED
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LessonCreate(BaseModel):
    course_id: str
    teacher_id: str
    student_id: str
    date_time: datetime
    duration_minutes: int = 60
    notes: Optional[str] = None

class LessonUpdate(BaseModel):
    date_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[LessonStatus] = None
    notes: Optional[str] = None

# Payment Models
class Payment(BaseModel):
    payment_id: str = Field(default_factory=lambda: f"payment_{uuid.uuid4().hex[:12]}")
    user_id: str
    payment_type: PaymentType
    amount: float
    description: str
    due_date: datetime
    status: PaymentStatus = PaymentStatus.PENDING
    visible_to_user: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentCreate(BaseModel):
    user_id: str
    payment_type: PaymentType
    amount: float
    description: str
    due_date: datetime

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[PaymentStatus] = None
    visible_to_user: Optional[bool] = None

# Notification Models
class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    title: str
    message: str
    notification_type: NotificationType = NotificationType.GENERAL
    recipient_ids: List[str] = []  # Empty means all users
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: NotificationType = NotificationType.GENERAL
    recipient_ids: List[str] = []

class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    is_active: Optional[bool] = None

# Session Models
class SessionData(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ===================== AUTH HELPERS =====================

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    return token

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token"""
    token = await get_session_token(request)
    if not token:
        return None
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at <= datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if user_doc:
        return User(**user_doc)
    return None

async def require_auth(request: Request) -> User:
    """Require authentication - raises HTTPException if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Non autenticato")
    return user

async def require_admin(request: Request) -> User:
    """Require admin role"""
    user = await require_auth(request)
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accesso negato - Solo amministratori")
    return user

# ===================== AUTH ROUTES =====================

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Non autenticato")
    return user

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    requested_role = body.get("role", "studente")  # Get requested role from body
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id richiesto")
    
    # Validate role
    valid_roles = ["admin", "studente", "insegnante"]
    if requested_role not in valid_roles:
        requested_role = "studente"
    
    # Exchange session_id with Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Session ID non valido")
            
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=500, detail="Errore di autenticazione")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update role if user wants to change it
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"role": requested_role}}
        )
    else:
        # Create new user with requested role
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "role": requested_role,  # Use requested role
            "status": UserStatus.ACTIVE.value,
            "phone": None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Get updated user
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    return {"user": user_doc, "session_token": session_token}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    token = await get_session_token(request)
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logout effettuato"}

# ===================== USER ROUTES =====================

@api_router.get("/users", response_model=List[User])
async def get_users(
    request: Request,
    role: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all users with optional filters"""
    await require_auth(request)
    
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, request: Request):
    """Get a specific user"""
    await require_auth(request)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return User(**user)

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, request: Request):
    """Create a new user (admin only)"""
    await require_admin(request)
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "phone": user_data.phone,
        "role": user_data.role.value,
        "status": UserStatus.ACTIVE.value,
        "picture": None,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(new_user)
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**user_doc)

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: UserUpdate, request: Request):
    """Update a user"""
    current_user = await require_auth(request)
    
    # Only admin can update other users
    if current_user.user_id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    if "status" in update_dict:
        update_dict["status"] = update_dict["status"].value
    if "role" in update_dict:
        update_dict["role"] = update_dict["role"].value
    
    if update_dict:
        await db.users.update_one({"user_id": user_id}, {"$set": update_dict})
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return User(**user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user (admin only)"""
    await require_admin(request)
    
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Clean up related data
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "Utente eliminato"}

# ===================== COURSE ROUTES =====================

@api_router.get("/courses", response_model=List[Course])
async def get_courses(
    request: Request,
    status: Optional[str] = None,
    instrument: Optional[str] = None
):
    """Get all courses with optional filters"""
    await require_auth(request)
    
    query = {}
    if status:
        query["status"] = status
    if instrument:
        query["instrument"] = {"$regex": instrument, "$options": "i"}
    
    courses = await db.courses.find(query, {"_id": 0}).to_list(1000)
    return [Course(**c) for c in courses]

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, request: Request):
    """Get a specific course"""
    await require_auth(request)
    
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    return Course(**course)

@api_router.post("/courses", response_model=Course)
async def create_course(course_data: CourseCreate, request: Request):
    """Create a new course (admin only)"""
    await require_admin(request)
    
    course = Course(**course_data.model_dump())
    await db.courses.insert_one(course.model_dump())
    
    return course

@api_router.put("/courses/{course_id}", response_model=Course)
async def update_course(course_id: str, course_data: CourseUpdate, request: Request):
    """Update a course (admin only)"""
    await require_admin(request)
    
    update_dict = {k: v for k, v in course_data.model_dump().items() if v is not None}
    if "status" in update_dict:
        update_dict["status"] = update_dict["status"].value
    
    if update_dict:
        await db.courses.update_one({"course_id": course_id}, {"$set": update_dict})
    
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    return Course(**course)

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, request: Request):
    """Delete a course (admin only)"""
    await require_admin(request)
    
    result = await db.courses.delete_one({"course_id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    
    return {"message": "Corso eliminato"}

@api_router.post("/courses/{course_id}/teachers/{teacher_id}")
async def assign_teacher(course_id: str, teacher_id: str, request: Request):
    """Assign a teacher to a course"""
    await require_admin(request)
    
    # Verify teacher exists and is a teacher
    teacher = await db.users.find_one({"user_id": teacher_id, "role": "insegnante"}, {"_id": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="Insegnante non trovato")
    
    await db.courses.update_one(
        {"course_id": course_id},
        {"$addToSet": {"teacher_ids": teacher_id}}
    )
    
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    return Course(**course)

@api_router.delete("/courses/{course_id}/teachers/{teacher_id}")
async def remove_teacher(course_id: str, teacher_id: str, request: Request):
    """Remove a teacher from a course"""
    await require_admin(request)
    
    await db.courses.update_one(
        {"course_id": course_id},
        {"$pull": {"teacher_ids": teacher_id}}
    )
    
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    return Course(**course)

@api_router.post("/courses/{course_id}/students/{student_id}")
async def enroll_student(course_id: str, student_id: str, request: Request):
    """Enroll a student in a course"""
    await require_admin(request)
    
    # Verify student exists
    student = await db.users.find_one({"user_id": student_id, "role": "studente"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")
    
    await db.courses.update_one(
        {"course_id": course_id},
        {"$addToSet": {"student_ids": student_id}}
    )
    
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    return Course(**course)

@api_router.delete("/courses/{course_id}/students/{student_id}")
async def remove_student(course_id: str, student_id: str, request: Request):
    """Remove a student from a course"""
    await require_admin(request)
    
    await db.courses.update_one(
        {"course_id": course_id},
        {"$pull": {"student_ids": student_id}}
    )
    
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    return Course(**course)

# ===================== LESSON ROUTES =====================

@api_router.get("/lessons", response_model=List[Lesson])
async def get_lessons(
    request: Request,
    course_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get all lessons with optional filters"""
    await require_auth(request)
    
    query = {}
    if course_id:
        query["course_id"] = course_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    if from_date:
        query["date_time"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        if "date_time" in query:
            query["date_time"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["date_time"] = {"$lte": datetime.fromisoformat(to_date)}
    
    lessons = await db.lessons.find(query, {"_id": 0}).sort("date_time", 1).to_list(1000)
    return [Lesson(**l) for l in lessons]

@api_router.get("/lessons/{lesson_id}", response_model=Lesson)
async def get_lesson(lesson_id: str, request: Request):
    """Get a specific lesson"""
    await require_auth(request)
    
    lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    return Lesson(**lesson)

@api_router.post("/lessons", response_model=Lesson)
async def create_lesson(lesson_data: LessonCreate, request: Request):
    """Create a new lesson (admin only)"""
    await require_admin(request)
    
    lesson = Lesson(**lesson_data.model_dump())
    await db.lessons.insert_one(lesson.model_dump())
    
    return lesson

@api_router.put("/lessons/{lesson_id}", response_model=Lesson)
async def update_lesson(lesson_id: str, lesson_data: LessonUpdate, request: Request):
    """Update a lesson"""
    current_user = await require_auth(request)
    
    # Get existing lesson
    existing = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    # Only admin or assigned teacher can update
    if current_user.role != UserRole.ADMIN and current_user.user_id != existing["teacher_id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    update_dict = {k: v for k, v in lesson_data.model_dump().items() if v is not None}
    if "status" in update_dict:
        update_dict["status"] = update_dict["status"].value
    
    if update_dict:
        await db.lessons.update_one({"lesson_id": lesson_id}, {"$set": update_dict})
    
    lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    return Lesson(**lesson)

@api_router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, request: Request):
    """Delete a lesson (admin only)"""
    await require_admin(request)
    
    result = await db.lessons.delete_one({"lesson_id": lesson_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    return {"message": "Lezione eliminata"}

# ===================== PAYMENT ROUTES =====================

@api_router.get("/payments", response_model=List[Payment])
async def get_payments(
    request: Request,
    user_id: Optional[str] = None,
    payment_type: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all payments with optional filters"""
    current_user = await require_auth(request)
    
    query = {}
    
    # Non-admin users can only see their own payments
    if current_user.role != UserRole.ADMIN:
        query["user_id"] = current_user.user_id
        query["visible_to_user"] = True
    else:
        if user_id:
            query["user_id"] = user_id
    
    if payment_type:
        query["payment_type"] = payment_type
    if status:
        query["status"] = status
    
    payments = await db.payments.find(query, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return [Payment(**p) for p in payments]

@api_router.get("/payments/{payment_id}", response_model=Payment)
async def get_payment(payment_id: str, request: Request):
    """Get a specific payment"""
    current_user = await require_auth(request)
    
    payment = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    # Non-admin users can only see their own payments
    if current_user.role != UserRole.ADMIN and payment["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    return Payment(**payment)

@api_router.post("/payments", response_model=Payment)
async def create_payment(payment_data: PaymentCreate, request: Request):
    """Create a new payment (admin only)"""
    await require_admin(request)
    
    payment = Payment(**payment_data.model_dump())
    await db.payments.insert_one(payment.model_dump())
    
    return payment

@api_router.put("/payments/{payment_id}", response_model=Payment)
async def update_payment(payment_id: str, payment_data: PaymentUpdate, request: Request):
    """Update a payment (admin only)"""
    await require_admin(request)
    
    update_dict = {k: v for k, v in payment_data.model_dump().items() if v is not None}
    if "status" in update_dict:
        update_dict["status"] = update_dict["status"].value
    
    if update_dict:
        await db.payments.update_one({"payment_id": payment_id}, {"$set": update_dict})
    
    payment = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    return Payment(**payment)

@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, request: Request):
    """Delete a payment (admin only)"""
    await require_admin(request)
    
    result = await db.payments.delete_one({"payment_id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    return {"message": "Pagamento eliminato"}

# ===================== NOTIFICATION ROUTES =====================

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(
    request: Request,
    active_only: bool = True
):
    """Get all notifications"""
    current_user = await require_auth(request)
    
    query = {}
    if active_only:
        query["is_active"] = True
    
    # Filter by recipient
    if current_user.role != UserRole.ADMIN:
        query["$or"] = [
            {"recipient_ids": {"$size": 0}},  # All users
            {"recipient_ids": current_user.user_id}
        ]
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [Notification(**n) for n in notifications]

@api_router.post("/notifications", response_model=Notification)
async def create_notification(notif_data: NotificationCreate, request: Request):
    """Create a new notification (admin only)"""
    await require_admin(request)
    
    notification = Notification(**notif_data.model_dump())
    await db.notifications.insert_one(notification.model_dump())
    
    return notification

@api_router.put("/notifications/{notification_id}", response_model=Notification)
async def update_notification(notification_id: str, notif_data: NotificationUpdate, request: Request):
    """Update a notification (admin only)"""
    await require_admin(request)
    
    update_dict = {k: v for k, v in notif_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.notifications.update_one({"notification_id": notification_id}, {"$set": update_dict})
    
    notification = await db.notifications.find_one({"notification_id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return Notification(**notification)

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification (admin only)"""
    await require_admin(request)
    
    result = await db.notifications.delete_one({"notification_id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    
    return {"message": "Notifica eliminata"}

# ===================== DASHBOARD STATS =====================

@api_router.get("/stats/admin")
async def get_admin_stats(request: Request):
    """Get admin dashboard statistics"""
    await require_admin(request)
    
    # Count users by role
    students = await db.users.count_documents({"role": "studente", "status": "attivo"})
    teachers = await db.users.count_documents({"role": "insegnante", "status": "attivo"})
    
    # Count courses
    active_courses = await db.courses.count_documents({"status": "attivo"})
    
    # Count lessons this week
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_end = week_start + timedelta(days=7)
    lessons_this_week = await db.lessons.count_documents({
        "date_time": {"$gte": week_start, "$lt": week_end}
    })
    
    # Count pending payments
    unpaid_student_fees = await db.payments.count_documents({
        "payment_type": "quota_studente",
        "status": {"$in": ["in_attesa", "scaduto"]}
    })
    unpaid_teacher_comp = await db.payments.count_documents({
        "payment_type": "compenso_insegnante",
        "status": {"$in": ["in_attesa", "scaduto"]}
    })
    
    # Active notifications
    active_notifications = await db.notifications.count_documents({"is_active": True})
    
    # Today's lessons
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    todays_lessons = await db.lessons.find({
        "date_time": {"$gte": today_start, "$lt": today_end}
    }, {"_id": 0}).to_list(100)
    
    return {
        "studenti_attivi": students,
        "insegnanti_attivi": teachers,
        "corsi_attivi": active_courses,
        "lezioni_settimana": lessons_this_week,
        "pagamenti_studenti_non_pagati": unpaid_student_fees,
        "compensi_insegnanti_non_pagati": unpaid_teacher_comp,
        "notifiche_attive": active_notifications,
        "lezioni_oggi": [Lesson(**l).model_dump() for l in todays_lessons]
    }

# ===================== SEED DATA =====================

@api_router.post("/seed")
async def seed_database(request: Request):
    """Seed database with sample data"""
    # Check if already seeded
    existing = await db.users.count_documents({})
    if existing > 5:
        return {"message": "Database già popolato", "status": "skipped"}
    
    # Sample teachers
    teachers = [
        {"user_id": "teacher_001", "email": "mario.rossi@musici.it", "name": "Mario Rossi", "role": "insegnante", "status": "attivo", "phone": "+39 333 1234567", "picture": None, "created_at": datetime.now(timezone.utc)},
        {"user_id": "teacher_002", "email": "lucia.bianchi@musici.it", "name": "Lucia Bianchi", "role": "insegnante", "status": "attivo", "phone": "+39 333 2345678", "picture": None, "created_at": datetime.now(timezone.utc)},
        {"user_id": "teacher_003", "email": "paolo.verdi@musici.it", "name": "Paolo Verdi", "role": "insegnante", "status": "attivo", "phone": "+39 333 3456789", "picture": None, "created_at": datetime.now(timezone.utc)},
    ]
    
    # Sample students
    students = [
        {"user_id": "student_001", "email": "giulia.ferrari@email.it", "name": "Giulia Ferrari", "role": "studente", "status": "attivo", "phone": "+39 340 1111111", "picture": None, "created_at": datetime.now(timezone.utc)},
        {"user_id": "student_002", "email": "marco.romano@email.it", "name": "Marco Romano", "role": "studente", "status": "attivo", "phone": "+39 340 2222222", "picture": None, "created_at": datetime.now(timezone.utc)},
        {"user_id": "student_003", "email": "sara.conti@email.it", "name": "Sara Conti", "role": "studente", "status": "attivo", "phone": "+39 340 3333333", "picture": None, "created_at": datetime.now(timezone.utc)},
        {"user_id": "student_004", "email": "luca.esposito@email.it", "name": "Luca Esposito", "role": "studente", "status": "attivo", "phone": "+39 340 4444444", "picture": None, "created_at": datetime.now(timezone.utc)},
        {"user_id": "student_005", "email": "anna.bruno@email.it", "name": "Anna Bruno", "role": "studente", "status": "inattivo", "phone": "+39 340 5555555", "picture": None, "created_at": datetime.now(timezone.utc)},
    ]
    
    # Sample courses
    courses = [
        {"course_id": "course_001", "name": "Pianoforte Base", "instrument": "Pianoforte", "description": "Corso introduttivo al pianoforte", "status": "attivo", "teacher_ids": ["teacher_001"], "student_ids": ["student_001", "student_002"], "created_at": datetime.now(timezone.utc)},
        {"course_id": "course_002", "name": "Violino Intermedio", "instrument": "Violino", "description": "Corso intermedio di violino", "status": "attivo", "teacher_ids": ["teacher_002"], "student_ids": ["student_003", "student_004"], "created_at": datetime.now(timezone.utc)},
        {"course_id": "course_003", "name": "Chitarra Classica", "instrument": "Chitarra", "description": "Corso di chitarra classica", "status": "attivo", "teacher_ids": ["teacher_003"], "student_ids": ["student_001", "student_003"], "created_at": datetime.now(timezone.utc)},
        {"course_id": "course_004", "name": "Canto Lirico", "instrument": "Voce", "description": "Corso di canto lirico", "status": "inattivo", "teacher_ids": ["teacher_002"], "student_ids": [], "created_at": datetime.now(timezone.utc)},
    ]
    
    # Sample lessons (spread across this week and next)
    now = datetime.now(timezone.utc)
    lessons = []
    for i in range(10):
        lesson_date = now + timedelta(days=i % 7, hours=9 + (i % 8))
        lessons.append({
            "lesson_id": f"lesson_{i+1:03d}",
            "course_id": courses[i % 3]["course_id"],
            "teacher_id": courses[i % 3]["teacher_ids"][0],
            "student_id": courses[i % 3]["student_ids"][i % len(courses[i % 3]["student_ids"])] if courses[i % 3]["student_ids"] else "student_001",
            "date_time": lesson_date,
            "duration_minutes": 60,
            "status": "programmata" if i > 2 else "completata",
            "notes": "Lezione di prova" if i < 3 else None,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Sample payments
    payments = [
        {"payment_id": "payment_001", "user_id": "student_001", "payment_type": "quota_studente", "amount": 150.0, "description": "Quota mensile Luglio 2025", "due_date": now + timedelta(days=5), "status": "in_attesa", "visible_to_user": True, "created_at": datetime.now(timezone.utc)},
        {"payment_id": "payment_002", "user_id": "student_002", "payment_type": "quota_studente", "amount": 150.0, "description": "Quota mensile Luglio 2025", "due_date": now - timedelta(days=5), "status": "scaduto", "visible_to_user": True, "created_at": datetime.now(timezone.utc)},
        {"payment_id": "payment_003", "user_id": "student_003", "payment_type": "quota_studente", "amount": 200.0, "description": "Quota mensile Luglio 2025 + materiali", "due_date": now + timedelta(days=10), "status": "in_attesa", "visible_to_user": True, "created_at": datetime.now(timezone.utc)},
        {"payment_id": "payment_004", "user_id": "teacher_001", "payment_type": "compenso_insegnante", "amount": 500.0, "description": "Compenso Giugno 2025", "due_date": now - timedelta(days=2), "status": "pagato", "visible_to_user": True, "created_at": datetime.now(timezone.utc)},
        {"payment_id": "payment_005", "user_id": "teacher_002", "payment_type": "compenso_insegnante", "amount": 600.0, "description": "Compenso Giugno 2025", "due_date": now + timedelta(days=3), "status": "in_attesa", "visible_to_user": True, "created_at": datetime.now(timezone.utc)},
    ]
    
    # Sample notifications
    notifications = [
        {"notification_id": "notif_001", "title": "Benvenuti all'Accademia!", "message": "Benvenuti nella nuova app dell'Accademia de 'I Musici'. Qui potrete gestire le vostre lezioni e pagamenti.", "notification_type": "generale", "recipient_ids": [], "is_active": True, "created_at": datetime.now(timezone.utc)},
        {"notification_id": "notif_002", "title": "Concerto di fine anno", "message": "Il concerto di fine anno si terrà il 20 Dicembre 2025. Tutti gli allievi sono invitati a partecipare!", "notification_type": "generale", "recipient_ids": [], "is_active": True, "created_at": datetime.now(timezone.utc)},
        {"notification_id": "notif_003", "title": "Promemoria pagamento", "message": "Ricordiamo che la quota mensile è in scadenza.", "notification_type": "promemoria_pagamento", "recipient_ids": ["student_001", "student_002"], "is_active": True, "created_at": datetime.now(timezone.utc)},
    ]
    
    # Insert all data
    await db.users.insert_many(teachers + students)
    await db.courses.insert_many(courses)
    await db.lessons.insert_many(lessons)
    await db.payments.insert_many(payments)
    await db.notifications.insert_many(notifications)
    
    return {
        "message": "Database popolato con successo",
        "data": {
            "insegnanti": len(teachers),
            "studenti": len(students),
            "corsi": len(courses),
            "lezioni": len(lessons),
            "pagamenti": len(payments),
            "notifiche": len(notifications)
        }
    }

# ===================== MAIN ROUTES =====================

@api_router.get("/")
async def root():
    return {"message": "API Accademia de 'I Musici'", "version": "1.0"}

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
