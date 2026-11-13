import { NextResponse } from "next/server";
import { findUserByEmail, hashPassword } from "@/lib/users";
import { signJwt } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Please provide both email and password." },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "No account found with this email. Please sign up." },
        { status: 401 }
      );
    }

    const hashed = hashPassword(password);
    if (user.passwordHash !== hashed) {
      return NextResponse.json(
        { success: false, message: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    const token = signJwt({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city,
      preferredCar: user.preferredCar,
    });

    return NextResponse.json({
      success: true,
      message: "Logged in successfully!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        preferredCar: user.preferredCar,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Internal server error during login." },
      { status: 500 }
    );
  }
}
