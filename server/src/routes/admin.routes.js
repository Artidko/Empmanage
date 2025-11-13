// server/src/routes/admin.routes.js
import { Router } from "express";
import { pool } from "../db.js";
import bcrypt from "bcryptjs";

const router = Router();

/* ---------- helpers ---------- */
async function readCols(table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  const set = new Set(rows.map((r) => r.COLUMN_NAME));
  return (name) => set.has(name);
}

function buildPositionExpr(hasP) {
  return hasP("position_title") && hasP("position")
    ? "COALESCE(p.position_title, p.position) AS position_title"
    : hasP("position_title")
    ? "p.position_title AS position_title"
    : hasP("position")
    ? "p.position AS position_title"
    : "NULL AS position_title";
}

/* ============================================================
 *               USERS (create / read / update / delete)
 * ============================================================ */
router.post("/users", async (req, res) => {
  try {
    let {
      email,
      password = "User@123",
      full_name,
      emp_code = null,
      department,
      position_title,
      start_date,
      salary_base = 0,
      role_id = 2, // 1=admin, 2=employee
    } = req.body || {};

    if (!full_name || !department || !start_date) {
      return res
        .status(400)
        .json({ message: "ข้อมูลไม่ครบ (full_name, department, start_date)" });
    }
    if (!email && !emp_code) {
      return res
        .status(400)
        .json({ message: "กรุณาระบุ email หรือ emp_code อย่างน้อยหนึ่งค่า" });
    }
    if (!email && emp_code)
      email = `${String(emp_code).toLowerCase()}@company.local`;

    const hash = await bcrypt.hash(password, 10);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // --- users ---
      let userId;
      try {
        const [u] = await conn.query(
          `INSERT INTO users (role_id, email, password_hash, full_name, status)
           VALUES (?, ?, ?, ?, 'active')`,
          [role_id, email, hash, full_name]
        );
        userId = u.insertId;
      } catch (e) {
        if (e.code === "ER_BAD_FIELD_ERROR") {
          const [u2] = await conn.query(
            `INSERT INTO users (role_id, email, password_hash, full_name)
             VALUES (?, ?, ?, ?)`,
            [role_id, email, hash, full_name]
          );
          userId = u2.insertId;
        } else if (e.code === "ER_DUP_ENTRY") {
          await conn.rollback();
          return res.status(409).json({ message: "อีเมลหรือรหัสพนักงานซ้ำ" });
        } else {
          throw e;
        }
      }

      // --- employee_profiles (dynamic) ---
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles'`
      );
      const has = (n) => cols.some((c) => c.COLUMN_NAME === n);

      const columns = ["user_id"];
      const values = [userId];

      if (has("emp_code") && emp_code !== null) {
        columns.push("emp_code");
        values.push(emp_code);
      }
      if (has("full_name")) {
        columns.push("full_name");
        values.push(full_name);
      }
      if (has("department")) {
        columns.push("department");
        values.push(department);
      }
      if (position_title !== undefined) {
        if (has("position_title")) {
          columns.push("position_title");
          values.push(position_title);
        } else if (has("position")) {
          columns.push("position");
          values.push(position_title);
        }
      }
      if (has("start_date")) {
        columns.push("start_date");
        values.push(start_date);
      }
      if (has("work_hours_per_day")) {
        columns.push("work_hours_per_day");
        values.push(8.0);
      }
      if (has("salary_base")) {
        columns.push("salary_base");
        values.push(Number(salary_base) || 0);
      }
      if (has("avatar_url")) {
        columns.push("avatar_url");
        values.push(null);
      }
      if (has("level_title")) {
        columns.push("level_title");
        values.push(null);
      }
      if (has("created_at")) {
        columns.push("created_at");
        values.push(new Date());
      }
      if (has("updated_at")) {
        columns.push("updated_at");
        values.push(new Date());
      }

      const placeholders = columns.map(() => "?").join(",");
      const sql = `INSERT INTO employee_profiles (${columns.join(
        ","
      )}) VALUES (${placeholders})`;
      await conn.query(sql, values);

      await conn.commit();
      return res.status(201).json({ id: userId, email, full_name });
    } catch (e) {
      await conn.rollback();
      console.error("[admin/users:create]", e.code, e.sqlMessage || e.message);
      return res.status(500).json({
        message: "เพิ่มพนักงานไม่สำเร็จ",
        code: e.code,
        sqlMessage: e.sqlMessage,
        sqlState: e.sqlState,
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("[admin/users]", e);
    return res.status(500).json({ message: "เพิ่มพนักงานไม่สำเร็จ" });
  }
});

router.get("/users/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });

  const hasU = await readCols("users");
  const hasP = await readCols("employee_profiles");

  const positionExpr = buildPositionExpr(hasP);
  const startExpr = hasP("start_date") ? "p.start_date" : "NULL AS start_date";
  const statusExpr = hasU("status") ? "u.status" : "NULL AS status";

  const [rows] = await pool.query(
    `
    SELECT
      u.id, u.email, u.full_name, ${statusExpr}, u.role_id,
      p.emp_code, p.department, ${positionExpr},
      p.salary_base, ${startExpr},
      ${hasP("work_hours_per_day") ? "p.work_hours_per_day" : "NULL AS work_hours_per_day"},
      ${hasP("created_at") ? "p.created_at" : "NULL AS created_at"},
      ${hasP("updated_at") ? "p.updated_at" : "NULL AS updated_at"}
    FROM users u
    JOIN employee_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `,
    [id]
  );

  if (!rows.length) return res.status(404).json({ message: "not found" });
  res.json(rows[0]);
});

router.get("/users", async (_req, res) => {
  try {
    const hasU = await readCols("users");
    const hasP = await readCols("employee_profiles");

    const positionExpr = buildPositionExpr(hasP);
    const startExpr = hasP("start_date") ? "p.start_date" : "NULL AS start_date";
    const statusExpr = hasU("status") ? "u.status" : "NULL AS status";

    const [rows] = await pool.query(
      `
      SELECT
        u.id, u.email, u.full_name, ${statusExpr}, u.role_id,
        p.emp_code, p.department, ${positionExpr}, p.salary_base, ${startExpr}
      FROM users u
      JOIN employee_profiles p ON p.user_id = u.id
      WHERE u.role_id = 2
      ORDER BY u.id DESC
    `
    );
    return res.json(rows);
  } catch (e) {
    console.error("[admin/users list]", e);
    return res.status(500).json({ message: "โหลดรายชื่อไม่สำเร็จ" });
  }
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });

  const {
    email,
    full_name,
    status, // 'active' | 'inactive'
    role_id,
    emp_code,
    department,
    position_title,
    position,
    start_date,
    salary_base,
  } = req.body || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // columns
    const [uCols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    const [pCols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles'`
    );
    const hasU = (n) => uCols.some((c) => c.COLUMN_NAME === n);
    const hasP = (n) => pCols.some((c) => c.COLUMN_NAME === n);

    // users
    {
      const sets = [];
      const vals = [];
      if (email !== undefined) { sets.push("email = ?"); vals.push(email); }
      if (full_name !== undefined) { sets.push("full_name = ?"); vals.push(full_name); }
      if (role_id !== undefined) { sets.push("role_id = ?"); vals.push(role_id); }
      if (status !== undefined && hasU("status")) { sets.push("status = ?"); vals.push(status); }

      if (sets.length) {
        try {
          await conn.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
        } catch (e) {
          if (e.code === "ER_DUP_ENTRY") {
            await conn.rollback();
            return res.status(409).json({ message: "อีเมลซ้ำในระบบ" });
          }
          throw e;
        }
      }
    }

    // employee_profiles
    {
      const pSets = [];
      const pVals = [];

      if (emp_code !== undefined && hasP("emp_code")) { pSets.push("emp_code = ?"); pVals.push(emp_code); }
      if (department !== undefined && hasP("department")) { pSets.push("department = ?"); pVals.push(department); }
      if (salary_base !== undefined && hasP("salary_base")) { pSets.push("salary_base = ?"); pVals.push(Number(salary_base || 0)); }
      if (start_date !== undefined && hasP("start_date")) { pSets.push("start_date = ?"); pVals.push(start_date || null); }

      const finalPosValue = position_title !== undefined ? position_title : position !== undefined ? position : undefined;
      if (finalPosValue !== undefined) {
        if (hasP("position_title")) { pSets.push("position_title = ?"); pVals.push(finalPosValue); }
        else if (hasP("position")) { pSets.push("position = ?"); pVals.push(finalPosValue); }
      }

      if (hasP("updated_at")) pSets.push("updated_at = NOW()");
      if (pSets.length) {
        await conn.query(
          `UPDATE employee_profiles SET ${pSets.join(", ")} WHERE user_id = ?`,
          [...pVals, id]
        );
      }
    }

    await conn.commit();

    // return latest
    const hasU2 = await readCols("users");
    const hasP2 = await readCols("employee_profiles");
    const positionExpr = buildPositionExpr(hasP2);
    const startExpr = hasP2("start_date") ? "p.start_date" : "NULL AS start_date";
    const statusExpr = hasU2("status") ? "u.status" : "NULL AS status";

    const [rows] = await pool.query(
      `
      SELECT 
        u.id, u.email, u.full_name, ${statusExpr}, u.role_id,
        p.emp_code, p.department, ${positionExpr}, p.salary_base, ${startExpr}
      FROM users u
      JOIN employee_profiles p ON p.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
      `,
      [id]
    );

    return res.json(rows[0] || { id });
  } catch (e) {
    await conn.rollback();
    console.error("[admin/users:update]", e.code, e.sqlMessage || e.message);
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "ข้อมูลซ้ำ (อีเมล/รหัสพนักงาน)" });
    }
    return res
      .status(500)
      .json({ message: "แก้ไขพนักงานไม่สำเร็จ", code: e.code, sqlMessage: e.sqlMessage });
  } finally {
    conn.release();
  }
});

router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM employee_profiles WHERE user_id = ?`, [id]);
    await conn.query(`DELETE FROM users WHERE id = ?`, [id]);
    await conn.commit();
    return res.status(204).end();
  } catch (e) {
    await conn.rollback();
    console.error("[admin/users:delete]", e.code, e.sqlMessage || e.message);
    if (e.code === "ER_ROW_IS_REFERENCED_2" || e.errno === 1451) {
      return res.status(409).json({
        message: "ลบไม่ได้เนื่องจากมีข้อมูลที่เกี่ยวข้องอยู่ (เช่น เวลาเข้าออกงาน, คำขอลา ฯลฯ)",
        code: e.code,
      });
    }
    return res.status(500).json({ message: "ลบพนักงานไม่สำเร็จ", code: e.code });
  } finally {
    conn.release();
  }
});

/* ============================================================
 *                        LEAVE (admin)
 * ============================================================ */
router.get("/leave/requests", async (_req, res) => {
  try {
    const hasP = await readCols("employee_profiles");
    const positionExpr = buildPositionExpr(hasP);

    const [rows] = await pool.query(`
      SELECT
        lr.id, lr.user_id, lr.leave_type, lr.start_date, lr.end_date,
        lr.reason, lr.status, lr.created_at,
        u.full_name, u.email,
        p.emp_code, p.department,
        ${positionExpr}
      FROM leave_requests lr
      JOIN users u ON u.id = lr.user_id
      LEFT JOIN employee_profiles p ON p.user_id = lr.user_id
      ORDER BY lr.id DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error("[admin leave list]", e);
    res.status(500).json({ message: "โหลดคำขอไม่สำเร็จ" });
  }
});

router.post("/leave/:id/approve", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });
  try {
    try {
      await pool.query(
        `UPDATE leave_requests SET status='approved', reviewed_at=NOW() WHERE id=?`,
        [id]
      );
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") {
        await pool.query(`UPDATE leave_requests SET status='approved' WHERE id=?`, [id]);
      } else throw e;
    }
    const [[row]] = await pool.query(`SELECT * FROM leave_requests WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    console.error("[admin leave approve]", e);
    res.status(500).json({ message: "อนุมัติไม่สำเร็จ" });
  }
});

router.post("/leave/:id/reject", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });
  try {
    try {
      await pool.query(
        `UPDATE leave_requests SET status='rejected', reviewed_at=NOW() WHERE id=?`,
        [id]
      );
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") {
        await pool.query(`UPDATE leave_requests SET status='rejected' WHERE id=?`, [id]);
      } else throw e;
    }
    const [[row]] = await pool.query(`SELECT * FROM leave_requests WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    console.error("[admin leave reject]", e);
    res.status(500).json({ message: "ปฏิเสธไม่สำเร็จ" });
  }
});

/* ============================================================
 *                 ATTENDANCE (admin)  ✅ NEW
 * ============================================================ */
/** คืนส่วน SELECT ของตาราง attendance โดย normalize ฟิลด์ให้เป็นชื่อกลาง */
async function buildAttendanceSelect() {
  const has = await readCols("attendance");
  const inCol = has("clock_in") ? "clock_in" : has("check_in") ? "check_in" : null;
  const outCol = has("clock_out") ? "clock_out" : has("check_out") ? "check_out" : null;

  const minutesExpr =
    inCol && outCol
      ? `TIMESTAMPDIFF(MINUTE, a.${inCol}, a.${outCol}) AS minutes`
      : "NULL AS minutes";

  const sel = [
    "a.id",
    "a.user_id",
    inCol ? `a.${inCol} AS clock_in` : "NULL AS clock_in",
    outCol ? `a.${outCol} AS clock_out` : "NULL AS clock_out",
    has("clock_in_lat") ? "a.clock_in_lat" : "NULL AS clock_in_lat",
    has("clock_in_lng") ? "a.clock_in_lng" : "NULL AS clock_in_lng",
    has("clock_out_lat") ? "a.clock_out_lat" : "NULL AS clock_out_lat",
    has("clock_out_lng") ? "a.clock_out_lng" : "NULL AS clock_out_lng",
    has("created_at") ? "a.created_at" : "NULL AS created_at",
    minutesExpr,
    // แนบข้อมูลพนักงานไว้ด้วย ใช้ได้ทันทีจากหน้าแอดมิน
    "u.full_name",
    "p.emp_code",
    "p.department",
  ].join(", ");

  return { select: sel, inCol, outCol };
}

// GET /api/admin/attendance/today
router.get("/attendance/today", async (_req, res) => {
  try {
    const { select, inCol } = await buildAttendanceSelect();
    if (!inCol) return res.json([]); // ไม่มีคอลัมน์เวลาเข้า

    const [rows] = await pool.query(
      `SELECT ${select}
         FROM attendance a
         JOIN users u ON u.id = a.user_id
    LEFT JOIN employee_profiles p ON p.user_id = a.user_id
        WHERE DATE(a.${inCol}) = CURDATE()
        ORDER BY a.${inCol} DESC, a.id DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error("[admin attendance today]", e);
    res.status(500).json({ message: "cannot load today attendance" });
  }
});

// GET /api/admin/attendance/range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/attendance/range", async (req, res) => {
  try {
    const { from, to } = req.query || {};
    if (!from || !to) {
      return res.status(400).json({ message: "missing from,to (YYYY-MM-DD)" });
    }
    const { select, inCol } = await buildAttendanceSelect();
    if (!inCol) return res.json([]);

    const [rows] = await pool.query(
      `SELECT ${select}
         FROM attendance a
         JOIN users u ON u.id = a.user_id
    LEFT JOIN employee_profiles p ON p.user_id = a.user_id
        WHERE DATE(a.${inCol}) BETWEEN ? AND ?
        ORDER BY a.${inCol} DESC, a.id DESC`,
      [from, to]
    );
    res.json(rows);
  } catch (e) {
    console.error("[admin attendance range]", e);
    res.status(500).json({ message: "cannot load attendance range" });
  }
});

// GET /api/admin/attendance  (optional: ?from&to)
router.get("/attendance", async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const { select, inCol } = await buildAttendanceSelect();

    let rows;
    if (from && to && inCol) {
      [rows] = await pool.query(
        `SELECT ${select}
           FROM attendance a
           JOIN users u ON u.id = a.user_id
      LEFT JOIN employee_profiles p ON p.user_id = a.user_id
          WHERE DATE(a.${inCol}) BETWEEN ? AND ?
          ORDER BY a.${inCol} DESC, a.id DESC`,
        [from, to]
      );
    } else {
      [rows] = await pool.query(
        `SELECT ${select}
           FROM attendance a
           JOIN users u ON u.id = a.user_id
      LEFT JOIN employee_profiles p ON p.user_id = a.user_id
          ORDER BY COALESCE(a.${inCol || "id"}, a.id) DESC
          LIMIT 200`
      );
    }
    res.json(rows);
  } catch (e) {
    console.error("[admin attendance list]", e);
    res.status(500).json({ message: "cannot load attendance" });
  }
});

/* ========================================
 *                PAYROLL
 * ======================================== */

// parse "YYYY-MM" -> string ปลอดภัย, ถ้าไม่ถูกให้ return null
function parseMonthYYYYMM(s) {
  const m = String(s || "").trim();
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}

// คำนวณ net
function calcNetRow(row) {
  const base = Number(row.base || 0);
  const bonus = Number(row.bonus || 0);
  const deduction = Number(row.deduction || 0);
  return base + bonus - deduction;
}

/**
 * GET /api/admin/payroll?month_year=YYYY-MM
 * คืนรายการเงินเดือนของเดือนนั้นจากตาราง payrolls พร้อมข้อมูลพนักงาน
 */
router.get("/payroll", async (req, res) => {
  try {
    const month = parseMonthYYYYMM(req.query.month_year) || null;
    if (!month) return res.status(400).json({ message: "ระบุ month_year=YYYY-MM" });

    const [rows] = await pool.query(
      `
      SELECT
        p.id, p.user_id, p.month_year, p.base, p.bonus, p.deduction, p.net,
        p.status, p.paid_at, p.created_at, p.updated_at,
        u.full_name, u.email,
        ep.emp_code, ep.department, 
        COALESCE(ep.position_title, ep.position) AS position_title
      FROM payrolls p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE p.month_year = ?
      ORDER BY u.full_name ASC
      `,
      [month]
    );

    res.json(rows);
  } catch (e) {
    console.error("[payroll list]", e);
    res.status(500).json({ message: "โหลดรายการเงินเดือนไม่สำเร็จ" });
  }
});

/**
 * POST /api/admin/payroll/generate
 * body: { month_year: "YYYY-MM" }
 * สร้าง/อัปเดต payrolls สำหรับพนักงาน role_id=2 ทุกคน โดยอิง base จาก employee_profiles.salary_base
 */
router.post("/payroll/generate", async (req, res) => {
  const month = parseMonthYYYYMM(req.body?.month_year);
  if (!month) return res.status(400).json({ message: "ระบุ month_year=YYYY-MM" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ดึงพนักงาน (role_id=2) + base
    const [emps] = await conn.query(
      `
      SELECT u.id AS user_id, u.full_name,
             COALESCE(ep.salary_base, 0) AS base
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE u.role_id = 2
      `
    );

    if (!emps.length) {
      await conn.rollback();
      return res.status(400).json({ message: "ไม่มีพนักงานสำหรับสร้างเงินเดือน" });
    }

    // สร้าง/อัปเดตแบบ upsert
    for (const e of emps) {
      const base = Number(e.base || 0);
      // default bonus/deduction=0, net = base
      await conn.query(
        `
        INSERT INTO payrolls (user_id, month_year, base, bonus, deduction, net, status)
        VALUES (?, ?, ?, 0, 0, ?, 'pending')
        ON DUPLICATE KEY UPDATE
          base = VALUES(base),
          net  = VALUES(net),
          updated_at = NOW()
        `,
        [e.user_id, month, base, base]
      );
    }

    await conn.commit();

    // ส่งกลับรายการล่าสุดของเดือนนั้น
    const [rows] = await pool.query(
      `
      SELECT
        p.id, p.user_id, p.month_year, p.base, p.bonus, p.deduction, p.net,
        p.status, p.paid_at, p.created_at, p.updated_at,
        u.full_name, u.email,
        ep.emp_code, ep.department,
        COALESCE(ep.position_title, ep.position) AS position_title
      FROM payrolls p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE p.month_year = ?
      ORDER BY u.full_name ASC
      `,
      [month]
    );
    res.status(201).json(rows);
  } catch (e) {
    await conn.rollback();
    console.error("[payroll generate]", e);
    res.status(500).json({ message: "สร้างเงินเดือนไม่สำเร็จ" });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/payroll/stats?month_year=YYYY-MM
 * คืนสรุปยอดรวม/จำนวนคนจ่ายแล้ว/รอจ่าย/ค่าเฉลี่ย
 */
router.get("/payroll/stats", async (req, res) => {
  try {
    const month = parseMonthYYYYMM(req.query.month_year);
    if (!month) return res.status(400).json({ message: "ระบุ month_year=YYYY-MM" });

    const [[sumRow]] = await pool.query(
      `SELECT COALESCE(SUM(net),0) AS total FROM payrolls WHERE month_year = ?`,
      [month]
    );
    const [[paidRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM payrolls WHERE month_year = ? AND status = 'paid'`,
      [month]
    );
    const [[allRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM payrolls WHERE month_year = ?`,
      [month]
    );

    const total = Number(sumRow.total || 0);
    const paid = Number(paidRow.cnt || 0);
    const all = Number(allRow.cnt || 0);
    const pending = Math.max(all - paid, 0);
    const avg = all ? total / all : 0;

    res.json({ total, paid, pending, avg });
  } catch (e) {
    console.error("[payroll stats]", e);
    res.status(500).json({ message: "คำนวณสรุปไม่สำเร็จ" });
  }
});

/**
 * PATCH /api/admin/payroll/:id
 * body: { bonus?, deduction?, base?, status? }
 * อัปเดตแถว + คำนวณ net ใหม่
 */
router.patch("/payroll/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });

  const { base, bonus, deduction, status } = req.body || {};
  try {
    // อ่านแถวเดิม
    const [[row]] = await pool.query(`SELECT * FROM payrolls WHERE id=?`, [id]);
    if (!row) return res.status(404).json({ message: "not found" });

    const nb = base != null ? Number(base) : Number(row.base || 0);
    const bo = bonus != null ? Number(bonus) : Number(row.bonus || 0);
    const de = deduction != null ? Number(deduction) : Number(row.deduction || 0);
    const net = nb + bo - de;

    await pool.query(
      `
      UPDATE payrolls
      SET base=?, bonus=?, deduction=?, net=?, status = COALESCE(?, status), updated_at = NOW()
      WHERE id=?
      `,
      [nb, bo, de, net, status || null, id]
    );

    const [[newRow]] = await pool.query(`SELECT * FROM payrolls WHERE id=?`, [id]);
    res.json(newRow);
  } catch (e) {
    console.error("[payroll update]", e);
    res.status(500).json({ message: "อัปเดตเงินเดือนไม่สำเร็จ" });
  }
});

/**
 * POST /api/admin/payroll/:id/pay
 * เปลี่ยนสถานะเป็น paid + paid_at=NOW()
 */
router.post("/payroll/:id/pay", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: "bad id" });

  try {
    await pool.query(
      `UPDATE payrolls SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=?`,
      [id]
    );
    const [[row]] = await pool.query(`SELECT * FROM payrolls WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    console.error("[payroll pay]", e);
    res.status(500).json({ message: "เปลี่ยนสถานะเป็นจ่ายแล้วไม่สำเร็จ" });
  }
});


export default router;
