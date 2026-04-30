from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import resend
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

resend.api_key = os.getenv("RESEND_API_KEY")



# =====================
# ENV VARIABLES
# =====================
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

EMAIL_USER = os.environ.get("EMAIL_USER")
EMAIL_PASS = os.environ.get("EMAIL_PASS")


# =====================
# DATABASE
# =====================
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


# =====================
# APP SETUP
# =====================
app = FastAPI(title="Webfoot API")
api_router = APIRouter(prefix="/api")


# =====================
# LOGGING
# =====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =====================
# EMAIL FUNCTION
# =====================
def send_email(to_email: str, subject: str, html_content: str):
    try:
        resend.Emails.send({
            "from": os.getenv("FROM_EMAIL"),
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        })
    except Exception:
        logger.exception("Email sending failed")


# =====================
# MODELS
# =====================
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class LeadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=40)
    business_type: Optional[str] = Field(default=None, max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)


class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: Optional[str] = None
    business_type: Optional[str] = None
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =====================
# ROUTES
# =====================
@api_router.get("/")
async def root():
    return {"message": "Webfoot API up"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check.get('timestamp'), str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


@api_router.post("/leads", response_model=Lead, status_code=201)
async def create_lead(payload: LeadCreate, background_tasks: BackgroundTasks):
    lead = Lead(**payload.model_dump())
    doc = lead.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    try:
        await db.leads.insert_one(doc)
    except Exception as e:
        logger.exception("Failed to insert lead")
        raise HTTPException(status_code=500, detail="Unable to save lead") from e

    # =====================
    # EMAIL TO USER
    # =====================
    background_tasks.add_task(
        send_email,
        lead.email,
        "Your Webfoot request is in — we’re working on it",
        f"""
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            
            <h2 style="margin-bottom: 10px;">Hi {lead.name},</h2>

            <p>Thanks for reaching out to <strong>Webfoot</strong>.</p>

            <p>
                We've received your request and we're already reviewing your requirements.
                Our goal is to craft something that doesn't just look good—but actually
                helps your business grow online.
            </p>

            <br/>

            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px;">
                <p style="margin: 0;"><strong>Your submission:</strong></p>
                <p style="margin: 5px 0;"><b>Business Type:</b> {lead.business_type or 'Not specified'}</p>
                <p style="margin: 5px 0;"><b>Message:</b> {lead.message}</p>
            </div>

            <br/>

            <p><strong>What happens next?</strong></p>
            <ul>
                <li>We review your requirements</li>
                <li>Prepare tailored website ideas</li>
                <li>Reach out within <strong>24 hours</strong></li>
            </ul>

            <br/>

            <p>
                If there's anything you'd like to add or clarify, just reply to this email.
            </p>

            <br/>

            <p style="margin-top: 20px;">
                — Team Webfoot<br/>
                <span style="color: #666;">Building your digital footprint</span>
            </p>

        </div>
        """
    )

    # =====================
    # EMAIL TO YOU
    # =====================
    background_tasks.add_task(
        send_email,
        os.getenv("FROM_EMAIL"),
        "New Webfoot Lead",
        f"""
        <h3>New Lead Received</h3>
        <p><b>Name:</b> {lead.name}</p>
        <p><b>Email:</b> {lead.email}</p>
        <p><b>Phone:</b> {lead.phone or 'N/A'}</p>
        <p><b>Business:</b> {lead.business_type or 'N/A'}</p>
        <p><b>Message:</b> {lead.message}</p>
        """
    )

    return lead


@api_router.get("/leads", response_model=List[Lead])
async def list_leads(limit: int = 100):
    limit = max(1, min(limit, 500))
    cursor = db.leads.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)

    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])

    return items


# =====================
# MIDDLEWARE
# =====================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================
# SHUTDOWN
# =====================
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()