import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const r = Router();

r.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Missing credentials" });

  // ✅ ใช้ email อย่างเดียว เพราะตารางไม่มีคอลัมน์ username
  const [rows] = await pool.query(
    `SELECT id, email, full_name, role_id, password_hash
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email]
  );

  if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

  const u = rows[0];
  const ok = await bcrypt.compare(password, u.password_hash || "");
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ uid: u.id, role_id: u.role_id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 7 * 24 * 3600 * 1000 });

  delete u.password_hash;
  res.json({ user: u });
});

export default r;
