import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db.js";

const uploadDir = process.env.UPLOAD_DIR || "uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g,"_"))
});
const upload = multer({ storage });

const router = Router();

// พนักงานดูสัญญาของตัวเอง
router.get("/contracts", async (req, res) => {
  const [rows] = await pool.query("SELECT id,title,file_path,uploaded_at FROM contracts WHERE user_id=?", [req.user.id]);
  res.json(rows);
});
// แอดมินอัปเอกสารให้พนักงานคนใดคนหนึ่ง
router.post("/contracts/:userId", upload.single("file"), async (req, res) => {
  const { title } = req.body;
  await pool.query(
    "INSERT INTO contracts (user_id,title,file_path) VALUES (?,?,?)",
    [req.params.userId, title || req.file.originalname, path.join(uploadDir, req.file.filename)]
  );
  res.status(201).json({ uploaded: true });
});

export default router;
