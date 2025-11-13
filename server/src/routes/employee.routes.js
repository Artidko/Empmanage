// server/src/routes/employee.routes.js
import { Router } from "express";
import { pool } from "../db.js";
import dayjs from "dayjs";

const router = Router();
const now = () => dayjs().format("YYYY-MM-DD HH:mm:ss");

// ---- helpers ---------------------------------------------------------------
async function getCols(table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  const set = new Set(rows.map((r) => r.COLUMN_NAME));
  return (name) => set.has(name);
}
const getUserId = (req) => req.user?.uid ?? req.user?.id;

// ─────────────────────────────────────────────────────────────────────────────
// โปรไฟล์ของฉัน
// ─────────────────────────────────────────────────────────────────────────────

router.get("/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  const hasP = await getCols("employee_profiles");
  const hasU = await getCols("users");

  const posExpr =
    hasP("position_title") && hasP("position")
      ? "COALESCE(p.position_title, p.position) AS position_title"
      : hasP("position_title")
      ? "p.position_title AS position_title"
      : hasP("position")
      ? "p.position AS position_title"
      : "NULL AS position_title";

  const select = `
    SELECT 
      u.id, u.email, u.full_name,
      ${hasU("status") ? "u.status" : "NULL AS status"},
      ${hasU("phone") ? "u.phone" : "NULL AS phone"},
      ${hasP("emp_code") ? "p.emp_code" : "NULL AS emp_code"},
      ${hasP("department") ? "p.department" : "NULL AS department"},
      ${posExpr},
      ${hasP("salary_base") ? "p.salary_base" : "0 AS salary_base"},
      ${hasP("start_date") ? "p.start_date" : "NULL AS start_date"},
      ${hasP("work_hours_per_day") ? "p.work_hours_per_day" : "8.0 AS work_hours_per_day"},
      ${hasP("level_title") ? "p.level_title" : "NULL AS level_title"},
      ${hasP("address") ? "p.address" : "NULL AS address"},
      ${hasP("avatar_url") ? "p.avatar_url" : "NULL AS avatar_url"},
      ${hasP("created_at") ? "p.created_at" : "NULL AS created_at"},
      ${hasP("updated_at") ? "p.updated_at" : "NULL AS updated_at"}
    FROM users u
    JOIN employee_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `;

  const [rows] = await pool.query(select, [userId]);
  if (!rows.length) return res.status(404).json({ message: "profile not found" });
  res.json({ profile: rows[0] });
});

router.put("/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  const { full_name, phone, address } = req.body || {};
  const hasU = await getCols("users");
  const hasP = await getCols("employee_profiles");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // users
    {
      const sets = [];
      const vals = [];
      if (full_name !== undefined) { sets.push("full_name = ?"); vals.push(full_name); }
      if (phone !== undefined && hasU("phone")) { sets.push("phone = ?"); vals.push(phone); }

      if (sets.length) {
        await conn.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...vals, userId]);
      }
    }

    // employee_profiles
    {
      const sets = [];
      const vals = [];
      if (address !== undefined && hasP("address")) { sets.push("address = ?"); vals.push(address); }
      if (hasP("updated_at")) sets.push("updated_at = NOW()");

      if (sets.length) {
        await conn.query(
          `UPDATE employee_profiles SET ${sets.join(", ")} WHERE user_id = ?`,
          [...vals, userId]
        );
      }
    }

    await conn.commit();
    return res.json({ updated: true });
  } catch (e) {
    await conn.rollback();
    console.error("[employee/me:update]", e);
    return res.status(500).json({ message: "บันทึกไม่สำเร็จ" });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// เข้า-ออกงาน (บันทึกพิกัด lat/lng/accuracy แบบตรวจคอลัมน์อัตโนมัติ)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/attendance/clock-in", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  // กันการเข้างานซ้ำที่ยังไม่ออก
  const [[openRow]] = await pool.query(
    "SELECT id FROM attendance WHERE user_id=? AND clock_out IS NULL ORDER BY id DESC LIMIT 1",
    [userId]
  );
  if (openRow) return res.status(409).json({ message: "คุณยังไม่ได้ออกงานจากรอบก่อน" });

  const hasA = await getCols("attendance");
  const ts = now();

  // รับพิกัดจาก client
  const { lat = null, lng = null, accuracy = null } = req.body || {};

  // สร้างคอลัมน์/ค่าแบบไดนามิก
  const cols = ["user_id", "clock_in"];
  const vals = [userId, ts];

  if (hasA("clock_in_lat"))       { cols.push("clock_in_lat");       vals.push(lat); }
  if (hasA("clock_in_lng"))       { cols.push("clock_in_lng");       vals.push(lng); }
  if (hasA("clock_in_accuracy"))  { cols.push("clock_in_accuracy");  vals.push(accuracy); }
  if (hasA("created_at"))         { cols.push("created_at");         vals.push(ts); }

  const placeholders = cols.map(() => "?").join(",");
  const [rs] = await pool.query(
    `INSERT INTO attendance (${cols.join(",")}) VALUES (${placeholders})`,
    vals
  );

  res.status(201).json({ id: rs.insertId, clock_in: ts });
});

router.post("/attendance/clock-out", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  const hasA = await getCols("attendance");
  const ts = now();
  const { lat = null, lng = null, accuracy = null } = req.body || {};

  const sets = ["clock_out = ?"];
  const vals = [ts];

  if (hasA("clock_out_lat"))      { sets.push("clock_out_lat = ?");      vals.push(lat); }
  if (hasA("clock_out_lng"))      { sets.push("clock_out_lng = ?");      vals.push(lng); }
  if (hasA("clock_out_accuracy")) { sets.push("clock_out_accuracy = ?"); vals.push(accuracy); }
  if (hasA("updated_at"))         { sets.push("updated_at = ?");         vals.push(ts); }

  const [rs] = await pool.query(
    `UPDATE attendance 
        SET ${sets.join(", ")} 
      WHERE user_id=? AND clock_out IS NULL 
      ORDER BY id DESC 
      LIMIT 1`,
    [...vals, userId]
  );

  if (!rs.affectedRows) return res.status(409).json({ message: "ไม่พบรายการเข้างานที่ค้างอยู่" });
  res.json({ clock_out: ts });
});

// ใช้ฟังก์ชันช่วยสร้าง SELECT สำหรับพิกัดแบบมี/ไม่มีคอลัมน์
function attSel(has) {
  const sel = (name) => (has(name) ? `a.${name}` : `NULL AS ${name}`);
  return `
    a.id, a.user_id, a.clock_in, a.clock_out,
    ${sel("clock_in_lat")}, ${sel("clock_in_lng")}, ${sel("clock_in_accuracy")},
    ${sel("clock_out_lat")}, ${sel("clock_out_lng")}, ${sel("clock_out_accuracy")},
    ${has("created_at") ? "a.created_at" : "NULL AS created_at"},
    ${has("updated_at") ? "a.updated_at" : "NULL AS updated_at"},
    CASE 
      WHEN a.clock_out IS NULL THEN NULL
      ELSE TIMESTAMPDIFF(MINUTE, a.clock_in, a.clock_out)
    END AS minutes
  `;
}

router.get("/attendance", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  const hasA = await getCols("attendance");
  const selectCols = attSel(hasA);

  const { from, to } = req.query || {};
  if (from && to) {
    const [rows] = await pool.query(
      `
      SELECT ${selectCols}
        FROM attendance a
       WHERE a.user_id=? AND DATE(a.clock_in) BETWEEN ? AND ?
       ORDER BY a.id DESC
      `,
      [userId, from, to]
    );
    return res.json(rows);
  }

  const [rows] = await pool.query(
    `
    SELECT ${selectCols}
      FROM attendance a
     WHERE a.user_id=?
     ORDER BY a.id DESC
     LIMIT 100
    `,
    [userId]
  );
  res.json(rows);
});

// ─────────────────────────────────────────────────────────────────────────────
// คำขอลา
// ─────────────────────────────────────────────────────────────────────────────

router.post("/leave", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  let { leave_type, start_date, end_date, reason } = req.body || {};
  if (!leave_type || !start_date || !end_date) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ (leave_type, start_date, end_date)" });
  }
  if (dayjs(start_date).isAfter(dayjs(end_date))) {
    return res.status(400).json({ message: "start_date ต้องไม่เกิน end_date" });
  }

  const hasL = await getCols("leave_requests");
  const cols = ["user_id", "leave_type", "start_date", "end_date", "reason"];
  const vals = [userId, leave_type, start_date, end_date, reason ?? null];
  if (hasL("status")) { cols.push("status"); vals.push("pending"); }
  if (hasL("created_at")) { cols.push("created_at"); vals.push(now()); }

  const placeholders = cols.map(() => "?").join(",");
  const [rs] = await pool.query(
    `INSERT INTO leave_requests (${cols.join(",")}) VALUES (${placeholders})`,
    vals
  );
  res.status(201).json({ id: rs.insertId });
});

router.get("/leave", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  const [rows] = await pool.query(
    "SELECT * FROM leave_requests WHERE user_id=? ORDER BY id DESC",
    [userId]
  );
  res.json(rows);
});

// ─────────────────────────────────────────────────────────────────────────────
// เงินเดือนของฉัน (slip)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/payroll", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "unauthorized" });

  const has = await getCols("payroll");
  const orderCol = has("month_year") ? "month_year" : has("created_at") ? "created_at" : "id";

  const [rows] = await pool.query(
    `SELECT * FROM payroll WHERE user_id=? ORDER BY ${orderCol} DESC`,
    [userId]
  );
  res.json(rows);
});

export default router;
