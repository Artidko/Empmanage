// server/src/routes/payroll.routes.js
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { only } from "../middleware/role.js";

const router = Router();

function normalizeMonthYear(s) {
  if (!s) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const str = String(s).replace("/", "-");
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return String(s).slice(0, 7);
}

async function upsertToUserSalaries(payrollRow, month_year) {
  const p = payrollRow;
  const ym = normalizeMonthYear(month_year || p.month_year);
  const meta = p.meta_json || p.meta || null;

  await pool.query(
    `
    INSERT INTO user_salaries
      (user_id, month_year, payroll_id, emp_code, full_name, department,
       base_amount, bonus_amount, deduction_amount, net_amount, status, paid_at, meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', NOW(), ?)
    ON DUPLICATE KEY UPDATE
      payroll_id = VALUES(payroll_id),
      emp_code = VALUES(emp_code),
      full_name = VALUES(full_name),
      department = VALUES(department),
      base_amount = VALUES(base_amount),
      bonus_amount = VALUES(bonus_amount),
      deduction_amount = VALUES(deduction_amount),
      net_amount = VALUES(net_amount),
      status = 'paid',
      paid_at = VALUES(paid_at),
      meta_json = VALUES(meta_json)
  `,
    [
      p.user_id,
      ym,
      p.id || p.payroll_id,
      p.emp_code,
      p.full_name,
      p.department,
      Number(p.base_amount ?? p.base ?? 0),
      Number(p.bonus_amount ?? p.bonus ?? 0),
      Number(p.deduction_amount ?? p.deduction ?? 0),
      Number(p.net_amount ?? p.net ?? 0),
      typeof meta === "string" ? meta : JSON.stringify(meta || {}),
    ]
  );
}

/** POST /api/admin/payroll/publish-to-user  { payroll_id, month_year? } */
router.post(
  "/payroll/publish-to-user",
  requireAuth, only("admin"),
  async (req, res) => {
    try {
      const { payroll_id, month_year } = req.body || {};
      if (!payroll_id) return res.status(400).json({ ok: false, error: "missing payroll_id" });
      const [rows] = await pool.query(
        "SELECT * FROM payroll WHERE id = ? OR payroll_id = ?",
        [payroll_id, payroll_id]
      );
      if (!rows?.length) return res.status(404).json({ ok: false, error: "payroll not found" });

      await upsertToUserSalaries(rows[0], month_year);
      return res.json({ ok: true });
    } catch (e) {
      console.error("publish-to-user error:", e);
      return res.status(500).json({ ok: false, error: e.message || "server error" });
    }
  }
);

/** alias เดิม: POST /api/admin/payroll/:id/publish */
router.post(
  "/payroll/:id/publish",
  requireAuth, only("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const [rows] = await pool.query("SELECT * FROM payroll WHERE id = ? OR payroll_id = ?", [id, id]);
      if (!rows?.length) return res.status(404).json({ ok: false });
      await upsertToUserSalaries(rows[0], req.body?.month_year);
      return res.json({ ok: true });
    } catch (e) {
      console.error("publish alias error:", e);
      return res.status(500).json({ ok: false });
    }
  }
);

export default router;
