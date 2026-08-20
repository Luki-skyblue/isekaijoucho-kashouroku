import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "kashouroku_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set.");
  }

  return secret;
}

export function createAdminSessionToken(timestamp = Date.now()) {
  const secret = getAdminSecret();
  const payload = String(timestamp);
  const signature = createHmac("sha256", secret)
    .update(`kashouroku-admin:${payload}`)
    .digest("hex");

  return `${payload}.${signature}`;
}

export async function isAdminLoggedIn() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const [timestampValue, signature] = token.split(".");
  const timestamp = Number(timestampValue);

  if (
    !Number.isFinite(timestamp) ||
    timestamp > Date.now() + 60_000 ||
    Date.now() - timestamp > SESSION_MAX_AGE_SECONDS * 1000
  ) {
    return false;
  }

  const expectedSignature = createAdminSessionToken(timestamp).split(".")[1];

  if (!signature || signature.length !== expectedSignature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function setAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/_manage",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.delete(COOKIE_NAME);
}