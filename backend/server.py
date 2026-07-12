from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime

from passport_scan import scan_passport_image, ACCEPTED_MIME


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ── Passport OCR / auto-fill for the registration form ──────────────────────
MAX_PASSPORT_BYTES = 8 * 1024 * 1024  # 8 MB cap on client upload


@api_router.post("/passport-scan")
async def passport_scan(file: UploadFile = File(...)):
    """
    Accepts a JPEG / PNG / WEBP passport photo and returns structured fields
    extracted by Gemini vision. See passport_scan.py for the response shape.
    """
    mime = (file.content_type or "").lower()
    if mime not in ACCEPTED_MIME:
        raise HTTPException(status_code=415, detail=f"Unsupported file type '{mime}'. Please upload a JPEG, PNG or WEBP passport photo.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Empty file upload.")
    if len(payload) > MAX_PASSPORT_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 8 MB).")

    try:
        data = await scan_passport_image(payload, mime)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Passport scan runtime error: %s", exc)
        raise HTTPException(status_code=502, detail="Passport auto-fill service is temporarily unavailable. Please enter your details manually.") from exc
    except Exception as exc:  # defensive: don't leak stack traces
        logger.exception("Unexpected passport scan failure")
        raise HTTPException(status_code=500, detail="Could not read passport. Please try a clearer photo or enter details manually.") from exc

    return {"ok": True, "data": data}

# Include the router in the main app
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
