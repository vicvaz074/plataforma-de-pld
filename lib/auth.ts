import bcrypt from "bcryptjs"
import { serialize } from "cookie"

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function saveUser(user: { name: string; email: string; password: string }) {
  const users = JSON.parse(localStorage.getItem("users") || "[]")
  users.push({ ...user, approved: false })
  localStorage.setItem("users", JSON.stringify(users))
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ authenticated: boolean; user?: any }> {
  if (email === "admin@example.com" && password === "password") {
    return { authenticated: true, user: { name: "Administrador", role: "admin" } }
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]")
  const user = users.find((u: any) => u.email === email && u.approved)

  if (user && (await verifyPassword(password, user.password))) {
    return { authenticated: true, user }
  }

  return { authenticated: false }
}

export function setAuthCookie(res: any, token: string) {
  const cookie = serialize("auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    maxAge: 3600,
    path: "/",
  })
  res.setHeader("Set-Cookie", cookie)
}
