import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SECRET_KEY = process.env.JWT_SECRET;

if (process.env.NODE_ENV === "production" && !SECRET_KEY) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not defined in production.",
  );
}

// Fallback only for development
const finalKey = SECRET_KEY || "dev-secret-key-change-it-in-prod";
const encodedKey = new TextEncoder().encode(finalKey);

export async function encrypt(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days session
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
