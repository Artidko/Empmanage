// ใช้ร่วมกับ Vite proxy ไป http://localhost:4000
const BASE = import.meta.env.VITE_API_BASE || "";

async function http(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // รับ/ส่ง cookie JWT
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

export const auth = {
  login: ({ username, password }) =>
    http("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => http("/api/auth/me"),
  logout: () => http("/api/auth/logout", { method: "POST" }),
};
