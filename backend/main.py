import hmac
import hashlib
import base64
import json
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr

app = FastAPI(title="EVYatra API", version="1.0.0")

JWT_SECRET = "evyatra_super_secure_jwt_secret_key_2026"

# In-memory users store
users_db = {
    "shivam@evyatra.in": {
        "id": "usr-demo-1",
        "name": "Shivam Sharma",
        "email": "shivam@evyatra.in",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
        "phone": "+91 9992629295",
        "city": "Delhi NCR",
        "preferred_car": "Hyn-IONIQ 5"
    }
}

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    city: Optional[str] = "Delhi NCR"
    preferredCar: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding < 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode())

def create_jwt_token(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload["iat"] = int(time.time())
    payload["exp"] = int(time.time()) + (7 * 24 * 3600) # 7 days
    
    header_b64 = b64url_encode(json.dumps(header).encode())
    payload_b64 = b64url_encode(json.dumps(payload).encode())
    
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def verify_jwt_token(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid token structure")
    header_b64, payload_b64, sig_b64 = parts
    
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = b64url_encode(hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest())
    
    if sig_b64 != expected_sig:
        raise HTTPException(status_code=401, detail="Invalid token signature")
    
    payload = json.loads(b64url_decode(payload_b64).decode())
    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token has expired")
    return payload

@app.get("/hello")
def hello():
    return {"message": "Welcome to EVYatra API"}

@app.post("/auth/register")
def register(req: RegisterRequest):
    email = req.email.lower().strip()
    if email in users_db:
        raise HTTPException(status_code=409, detail="User already exists with this email")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    user_id = f"usr-{int(time.time())}"
    users_db[email] = {
        "id": user_id,
        "name": req.name.strip(),
        "email": email,
        "password_hash": hashlib.sha256(req.password.encode()).hexdigest(),
        "phone": req.phone or "",
        "city": req.city or "Delhi NCR",
        "preferred_car": req.preferredCar or ""
    }
    
    token = create_jwt_token({
        "id": user_id,
        "name": req.name,
        "email": email,
        "phone": req.phone,
        "city": req.city,
        "preferredCar": req.preferredCar
    })
    return {
        "success": True,
        "message": "User registered successfully",
        "token": token,
        "user": {
            "id": user_id,
            "name": req.name,
            "email": email,
            "phone": req.phone,
            "city": req.city,
            "preferredCar": req.preferredCar
        }
    }

@app.post("/auth/login")
def login(req: LoginRequest):
    email = req.email.lower().strip()
    user = users_db.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="No user found with this email")
    
    pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
    if user["password_hash"] != pw_hash:
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    token = create_jwt_token({
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user.get("phone", ""),
        "city": user.get("city", "Delhi NCR"),
        "preferredCar": user.get("preferred_car", "")
    })
    return {
        "success": True,
        "message": "Logged in successfully",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone", ""),
            "city": user.get("city", "Delhi NCR"),
            "preferredCar": user.get("preferred_car", "")
        }
    }

@app.get("/auth/me")
def me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:]
    payload = verify_jwt_token(token)
    return {"success": True, "user": payload}

@app.get("/stats/impact")
def impact_stats():
    return {
        "total_stations": 14860,
        "co2_tonnes_stopped": 356400,
        "fuel_saved_lakh_litres": 1580,
        "trees_equivalent_lakh": 142.5,
        "clean_power_gwh": 892
    }
