import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db.js";

const router = Router();

/* ---------- ที่เก็บไฟล์ ---------- */
const baseUploadDir = path.join(process.cwd(), "uploads", "docs");
fs.mkdirSync(baseUploadDir, { recursive: true });

/* ---------- หา user id จาก session/jwt ---------- */
function getUserId(req) {
  const v =
    req.user?.id ??
    req.auth?.id ??
    req.session?.user?.id ??
    req.headers["x-user-id"] ??
    req.query.user_id;

  const id = Number(v);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/* ---------- multer storage ---------- */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uid = getUserId(req) || "anon";
    const dir = path.join(baseUploadDir, String(uid));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "") || "";
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/* ---------- เสิร์ฟไฟล์แบบ static ---------- */
// ไปเพิ่มใน app.js: app.use("/uploads", express.static(path.join(process.cwd(),"uploads")));
function publicBase(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

/* ============== API ============== */

// GET /api/user/documents  → รายการเอกสารของ user ปัจจุบัน
router.get("/", async (req, res) => {
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });

  const [rows] = await pool.query(
    "SELECT * FROM employee_documents WHERE user_id=? ORDER BY created_at DESC",
    [uid]
  );

  const base = publicBase(req);
  const items = rows.map((r) => ({
    ...r,
    url:
      r.file_url ||
      `${base}/uploads/docs/${r.user_id}/${path.basename(r.file_path)}`,
  }));
  res.json(items);
});

// POST /api/user/documents  → อัปโหลดเอกสาร (multipart/form-data)
router.post("/", upload.single("file"), async (req, res) => {
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });
  if (!req.file) return res.status(400).json({ error: "no file" });

  const type = req.body.type || "other";
  const title = req.body.title || req.file.originalname || "document";

  const relPath = path
    .relative(process.cwd(), req.file.path)
    .replace(/\\/g, "/");
  const base = publicBase(req);
  const url = `${base}/uploads/docs/${uid}/${req.file.filename}`;

  const [r] = await pool.query(
    `INSERT INTO employee_documents
     (user_id,type,title,file_path,file_url,mime_type,size,status)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      uid,
      type,
      title,
      relPath,
      url,
      req.file.mimetype || "application/octet-stream",
      req.file.size || 0,
      "ready",
    ]
  );

  res.json({ id: r.insertId, url, title, type, status: "ready" });
});

// GET /api/user/documents/:id/download → ดาวน์โหลดไฟล์
router.get("/:id/download", async (req, res) => {
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });

  const [rows] = await pool.query(
    "SELECT * FROM employee_documents WHERE id=? AND user_id=?",
    [req.params.id, uid]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });

  const row = rows[0];
  const abs = path.isAbsolute(row.file_path)
    ? row.file_path
    : path.join(process.cwd(), row.file_path);
  return res.download(abs, path.basename(abs));
});

export default router;
