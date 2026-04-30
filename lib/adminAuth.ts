import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE_NAME = "kashouroku_admin_session";

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set.");
  }

  return secret;
}

export function createAdminSessionToken() {
  const secret = getAdminSecret();

  return createHash("sha256")
    .update(`kashouroku-admin:${secret}`)
    .digest("hex");
}

export async function isAdminLoggedIn() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  return token === createAdminSessionToken();
}

export async function setAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/_manage",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.delete(COOKIE_NAME);
}