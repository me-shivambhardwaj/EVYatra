import crypto from "crypto";
import type { UserPayload } from "./auth";

export interface StoredUser extends UserPayload {
  passwordHash: string;
  createdAt: string;
}

// In-memory persistent user repository with initial demo accounts
const users: StoredUser[] = [
  {
    id: "usr-demo-1",
    name: "Shivam Sharma",
    email: "shivam@evyatra.in",
    passwordHash: hashPassword("password123"),
    phone: "+91 9992629295",
    city: "Delhi NCR",
    preferredCar: "Hyn-IONIQ 5",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-demo-2",
    name: "Priya Patel",
    email: "priya@evyatra.in",
    passwordHash: hashPassword("password123"),
    phone: "+91 98123 45678",
    city: "Mumbai",
    preferredCar: "Mercedes-Benz EQS SUV",
    createdAt: new Date().toISOString(),
  },
];

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function findUserByEmail(email: string): StoredUser | undefined {
  return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

export function createUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  preferredCar?: string;
}): StoredUser {
  const newUser: StoredUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    passwordHash: hashPassword(data.password),
    phone: data.phone?.trim() || "",
    city: data.city?.trim() || "Delhi NCR",
    preferredCar: data.preferredCar?.trim() || "",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  return newUser;
}
