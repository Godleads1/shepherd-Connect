import supertest from "supertest";
import app from "../app";

export const api = supertest(app);

export async function loginAs(email: string, password: string) {
  const res = await api
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  return res.body.token as string;
}

export const CREDS = {
  superAdmin: { email: "superadmin@shepherd.com", password: "admin123" },
  admin:      { email: "admin@shepherd.com",      password: "admin123" },
  teacher:    { email: "teacher1@shepherd.com",   password: "teacher123" },
  attendant:  { email: "attendant@shepherd.com",  password: "attend123" },
  parent:     { email: "parent1@shepherd.com",    password: "parent123" },
};
