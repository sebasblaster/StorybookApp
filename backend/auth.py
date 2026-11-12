"""Email + password authentication (bcrypt hashes, JWT bearer tokens)."""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request

import db
from engine.paths import DATA_DIR

ALGORITHM = "HS256"
TOKEN_HOURS = 12


def jwt_secret() -> str:
    """JWT_SECRET from the environment, or a random secret generated once and kept in data/.jwt_secret."""
    env = os.environ.get("JWT_SECRET", "").strip()
    if env:
        return env
    f = DATA_DIR / ".jwt_secret"
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode())
    except ValueError:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)}
    return jwt.encode(payload, jwt_secret(), algorithm=ALGORITHM)


def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(auth[7:], jwt_secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token inválido")
    user = db.user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return {"id": user["id"], "email": user["email"], "name": user["name"]}


CurrentUser = Depends(get_current_user)
