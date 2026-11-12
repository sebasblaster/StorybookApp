"""Storybook API: auth + stories + media. Run:  uvicorn server:app --port 8001"""
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")  # must run before importing the engine (HF_* variables)

import logging  # noqa: E402
import os  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from fastapi import APIRouter, FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel, EmailStr, Field  # noqa: E402

import auth  # noqa: E402
import db  # noqa: E402
import jobs  # noqa: E402
from engine.paths import MEDIA_ROOT  # noqa: E402
from stories import router as stories_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("storybook")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()
    jobs.start()
    logger.info("Storybook listo · offline=%s", os.environ.get("HF_HUB_OFFLINE") == "1")
    yield


app = FastAPI(title="Storybook API", version="2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- auth routes ----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str


class AuthOut(BaseModel):
    user: UserOut
    token: str


api = APIRouter(prefix="/api")


@api.post("/auth/register", response_model=AuthOut)
def register(body: RegisterIn):
    email = body.email.lower().strip()
    if db.user_by_email(email):
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")
    user = db.create_user(email, body.name.strip(), auth.hash_password(body.password))
    return AuthOut(user=UserOut(**user), token=auth.create_token(user["id"], email))


@api.post("/auth/login", response_model=AuthOut)
def login(body: LoginIn):
    email = body.email.lower().strip()
    user = db.user_by_email(email)
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return AuthOut(user=UserOut(id=user["id"], email=email, name=user["name"]), token=auth.create_token(user["id"], email))


@api.post("/auth/logout")
def logout():
    return {"ok": True}  # tokens are stateless: the client just discards its copy


@api.get("/auth/me", response_model=UserOut)
def me(user: dict = auth.CurrentUser):
    return UserOut(**user)


@app.get("/")
@api.get("/")
def root():
    return {
        "message": "Storybook API",
        "version": app.version,
        "health": "/api/health",
        "docs": "/docs",
    }


app.include_router(api)
app.include_router(stories_router)
app.mount("/api/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")
