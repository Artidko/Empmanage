// src/pages/admin/PayrollManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../data/admin";

/* ---------------- Config/Rules ---------------- */
const SHIFT_START = "08:30";
const WORK_HOURS_PER_DAY = 8;
const PAID_LEAVE_NAMES = new Set([
  "ลาป่วย",
  "ลาพักร้อน",
  "ลาประจำปี",
  "sick",
  "vacation",
  "annual",
]);

/* ---------------- Helpers ---------------- */
const fmtMoney = (n) => "฿" + Number(n || 0).toLocaleString();
const ymNow = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
};
const pick = (o, keys, d = undefined) => {
  for (const k of keys) if (o && o[k] != null) return o[k];
  return d;
};

const toHM = (ts) => {
  if (!ts && ts !== 0) return "";
  const s = String(ts);
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.split(" ")[1].slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d))
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d))
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {;}
  return "";
};
const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};
const dateOnly = (s) => {
  if (!s) return null;
  const str = String(s);
  if (str.includes("T")) return str.slice(0, 10);
  if (str.includes(" ")) return str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const monthBounds = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
};
const isWorkday = (d) => {
  const day = d.getDay();
  return day !== 0 && day !== 6;
};
const eachDate = (start, end, fn) => {
  const d = new Date(start);
  while (d <= end) {
    fn(new Date(d));
    d.setDate(d.getDate() + 1);
  }
};

/* ------- tiny REST helper (ใช้กับ fallback endpoints) ------- */
async function postJSON(url, body, method = "POST") {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    body: JSON.stringify(body),
  });
  try { return await res.json(); } catch { return {}; }
}

/* ---------------- Component ---------------- */
export default function PayrollManagement() {
  const [month, setMonth] = useState(ymNow());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);
  const [busyGen, setBusyGen] = useState(false);
  const [payingId, setPayingId] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  const [apiStats, setApiStats] = useState(null);

  /* -------- fetchers (API-first) -------- */
  async function fetchEmployees() {
    const data = await adminApi.listEmployees();
    return Array.isArray(data) ? data : data?.items || data?.employees || [];
  }

  async function fetchPayrollFromDB(m) {
    try {
      if (adminApi?.payroll?.list) {
        const r = await adminApi.payroll.list(m);
        const arr = Array.isArray(r) ? r : r?.items || r?.data || [];
        if (arr.length) return arr;
      }
    } catch {;}
    const urls = [
      `/api/admin/payroll?month_year=${encodeURIComponent(m)}`,
      `/api/admin/payroll/${encodeURIComponent(m)}`,
      (() => {
        const [yy, mm] = String(m).split("-");
        return `/api/admin/payroll?year=${yy}&month=${mm}`;
      })(),
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u, { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          const arr = Array.isArray(data) ? data : data?.items || data?.data || [];
          if (arr.length) return arr;
        }
      } catch {;}
    }
    return [];
  }

  async function fetchAttendanceRange(from, to) {
    try {
      if (adminApi?.attendance?.range) {
        const r = await adminApi.attendance.range(from, to);
        const arr = Array.isArray(r) ? r : r?.items || r?.data || [];
        if (arr.length) return arr;
      }
      if (adminApi?.attendance?.list) {
        const r = await adminApi.attendance.list({ from, to });
        const arr = Array.isArray(r) ? r : r?.items || r?.data || [];
        if (arr.length) return arr;
      }
    } catch {;}
    const urls = [
      `/api/admin/attendance/range?from=${from}&to=${to}`,
      `/api/admin/attendance?from=${from}&to=${to}`,
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u, { credentials: "include" });
        if (r.ok) return await r.json();
      } catch {;}
    }
    return [];
  }

  async function fetchApprovedLeaves(from, to) {
    try {
      if (adminApi?.leave?.list) {
        const r = await adminApi.leave.list({ from, to, status: "approved" });
        return Array.isArray(r) ? r : r?.items || r?.data || [];
      }
    } catch {;}
    try {
      const all = await adminApi.listLeaveRequests();
      const arr = Array.isArray(all) ? all : all?.items || all?.data || [];
      const s = new Date(from);
      const e = new Date(to);
      return arr.filter((x) => {
        const st = new Date(pick(x, ["start_date", "startDate", "from_date", "from"]));
        const en = new Date(pick(x, ["end_date", "endDate", "to_date", "to"]));
        const approved = (x.status || x.approval_status || "")
          .toLowerCase()
          .includes("approve");
        return approved && !isNaN(st) && !isNaN(en) && en >= s && st <= e;
      });
    } catch {;}
    return [];
  }

  async function fetchServerStats(m) {
    try {
      if (adminApi?.payroll?.stats) return await adminApi.payroll.stats(m);
    } catch {;}
    try {
      const r = await fetch(`/api/admin/payroll/stats?month_year=${encodeURIComponent(m)}`, {
        credentials: "include",
      });
      if (r.ok) return await r.json();
    } catch {;}
    return null;
  }

  /* ---------------- Core Load ---------------- */
  async function load() {
    setLoading(true);
    setErr("");
    try {
      // 1) พยายามดึงรายการเพย์โรล “จริง” ของเดือนจาก DB ก่อน
      const dbList = await fetchPayrollFromDB(month);

      if (dbList.length > 0) {
        const mapped = dbList.map((r) => ({
          id: r.id ?? r.payroll_id ?? r._id,
          payroll_id: r.id ?? r.payroll_id ?? r._id,
          user_id: pick(r, ["user_id", "employee_id"]),
          emp_code: pick(r, ["emp_code", "employee_code", "code"]),
          full_name: pick(r, ["full_name", "name"]),
          department: pick(r, ["department", "dept"]),
          base: Number(pick(r, ["base_amount", "base", "salary_base", "salary"], 0)),
          bonus: Number(pick(r, ["bonus_amount", "bonus"], 0)),
          deduction: Number(pick(r, ["deduction_amount", "deduction"], 0)),
          net: Number(pick(r, ["net_amount", "net"], 0)),
          status: pick(r, ["status", "pay_status"], "pending"),
          paid_at: pick(r, ["paid_at", "paidAt"], null),
          meta: {
            lateMinutes: Number(pick(r, ["late_minutes", "lateMinutes"], 0)),
            absentDays: Number(pick(r, ["absent_days", "absentDays"], 0)),
            paidLeaveDays: Number(pick(r, ["paid_leave_days", "paidLeaveDays"], 0)),
            unpaidLeaveDays: Number(pick(r, ["unpaid_leave_days", "unpaidLeaveDays"], 0)),
            workdayCount: Number(pick(r, ["workday_count", "workdayCount"], 0)),
          },
        }));
        mapped.sort((a, b) =>
          String(a.full_name || "").localeCompare(String(b.full_name || ""), "th")
        );
        setRows(mapped);

        const statsRaw = await fetchServerStats(month).catch(() => null);
        if (statsRaw && typeof statsRaw === "object") {
          setApiStats({
            total: Number(pick(statsRaw, ["total", "sum", "total_net"], 0)),
            paid: Number(pick(statsRaw, ["paid", "paid_count", "count_paid"], 0)),
            pending: Number(pick(statsRaw, ["pending", "pending_count"], 0)),
            avg: Number(pick(statsRaw, ["avg", "average", "avg_net"], 0)),
          });
        } else {
          setApiStats(null);
        }
        setLoading(false);
        return; // ✅ จบที่ DB
      }

      // 2) ถ้า DB ว่าง → คำนวณจาก Attendance/Leave (fallback)
      const { start, end } = monthBounds(month);
      const from = dateOnly(start.toISOString());
      const to = dateOnly(end.toISOString());
      const [emps, attRaw, leavesRaw] = await Promise.all([
        fetchEmployees(),
        fetchAttendanceRange(from, to),
        fetchApprovedLeaves(from, to),
      ]);

      const leaveByUserDate = new Map();
      for (const lv of leavesRaw) {
        const uid = pick(lv, ["user_id", "employee_id", "userId", "employeeId"]);
        const type = (pick(lv, ["type", "leave_type", "reason"]) || "")
          .toString()
          .toLowerCase();
        const isPaid =
          PAID_LEAVE_NAMES.has(type) ||
          [...PAID_LEAVE_NAMES].some((t) => type.includes(t));
        const st = new Date(pick(lv, ["start_date", "startDate", "from_date", "from"]));
        const en = new Date(pick(lv, ["end_date", "endDate", "to_date", "to"]));
        if (isNaN(st) || isNaN(en)) continue;
        eachDate(st, en, (d) => {
          if (d < start || d > end) return;
          const key = `${uid}:${dateOnly(d.toISOString())}`;
          leaveByUserDate.set(key, isPaid ? "paid" : "unpaid");
        });
      }

      const inByUserDate = new Map();
      const attList = Array.isArray(attRaw) ? attRaw : attRaw?.items || attRaw?.data || [];
      for (const a of attList) {
        const uid = a.user_id ?? a.userId ?? a.id ?? pick(a, ["employee_id", "employeeId"]);
        const dstr = dateOnly(pick(a, ["check_in", "clock_in", "created_at", "createdAt"]));
        const checkIn = toHM(pick(a, ["check_in", "clock_in"]));
        if (!uid || !dstr || !checkIn) continue;
        const key = `${uid}:${dstr}`;
        const prev = inByUserDate.get(key);
        if (!prev || toMin(checkIn) < toMin(prev)) inByUserDate.set(key, checkIn);
      }

      const workDates = [];
      eachDate(start, end, (d) => {
        if (isWorkday(d)) workDates.push(dateOnly(d.toISOString()));
      });
      const workdayCount = workDates.length;

      const computed = (Array.isArray(emps) ? emps : []).map((e) => {
        const uid = e.id ?? e.user_id ?? e.userId;
        const base = Number(e.salary_base ?? e.salary ?? 0);
        let lateMinutes = 0,
          absentDays = 0,
          paidLeaveDays = 0,
          unpaidLeaveDays = 0;

        for (const d of workDates) {
          const leaveFlag = leaveByUserDate.get(`${uid}:${d}`);
          const inTime = inByUserDate.get(`${uid}:${d}`);
          if (inTime) {
            const late = Math.max(
              0,
              (toMin(inTime) ?? 0) - (toMin(SHIFT_START) ?? 0)
            );
            lateMinutes += late;
          } else if (leaveFlag === "paid") {
            paidLeaveDays += 1;
          } else if (leaveFlag === "unpaid") {
            unpaidLeaveDays += 1;
          } else {
            absentDays += 1;
          }
        }

        const dailyRate = workdayCount > 0 ? base / workdayCount : 0;
        const hourlyRate = WORK_HOURS_PER_DAY > 0 ? dailyRate / WORK_HOURS_PER_DAY : 0;
        const deduction = Math.round(
          (lateMinutes / 60) * hourlyRate + (absentDays + unpaidLeaveDays) * dailyRate
        );
        const net = Math.max(0, base - deduction);

        return {
          id: uid,
          user_id: uid,
          emp_code: e.emp_code ?? e.employee_code ?? e.code,
          full_name: e.full_name ?? e.name,
          department: e.department,
          base,
          bonus: 0,
          deduction,
          net,
          status: "pending",
          meta: {
            lateMinutes,
            absentDays,
            paidLeaveDays,
            unpaidLeaveDays,
            workdayCount,
          },
        };
      });

      computed.sort((a, b) =>
        String(a.full_name || "").localeCompare(String(b.full_name || ""), "th")
      );
      setRows(computed);
      setApiStats(null);
    } catch (e) {
      setErr(e?.message || "โหลด/คำนวณเงินเดือนไม่สำเร็จ");
      setRows([]);
      setApiStats(null);
    } finally {
      setLoading(false);
    }
  }

  // Generate บน server (ถ้ามี)
  async function generateMonth(m) {
    setBusyGen(true);
    setErr("");
    try {
      if (adminApi?.payroll?.generate) {
        await adminApi.payroll.generate(m);
      } else if (adminApi?.generatePayroll) {
        await adminApi.generatePayroll(m);
      } else {
        const r = await fetch(`/api/admin/payroll/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ month_year: m }),
        });
        if (!r.ok) throw new Error("ไม่สามารถสร้างเงินเดือนได้");
      }
      await load();
    } catch (e) {
      setErr(e?.message || "สร้างเงินเดือนไม่สำเร็จ");
    } finally {
      setBusyGen(false);
    }
  }

  /* -------- NEW: ส่งข้อมูลจ่ายเงินไปยังฐานข้อมูลของ “พนักงานแต่ละคน” -------- */
  async function syncPaidToEmployee(recordId, row, m) {
    const payload = {
      payroll_id: recordId,
      user_id: row.user_id,
      month_year: m,
      emp_code: row.emp_code,
      full_name: row.full_name,
      department: row.department,
      base_amount: row.base,
      bonus_amount: row.bonus,
      deduction_amount: row.deduction,
      net_amount: row.net,
      status: "PAID",
      paid_at: new Date().toISOString(),
      meta: row.meta || {},
    };

    // 1) SDK เสถียรกว่า ถ้ามี
    try {
      if (adminApi?.user?.payroll?.upsert) { await adminApi.user.payroll.upsert(payload); return; }
      if (adminApi?.employee?.payroll?.upsert) { await adminApi.employee.payroll.upsert(row.user_id, payload); return; }
      if (adminApi?.notify?.user?.salaryPaid) { await adminApi.notify.user.salaryPaid(row.user_id, { payroll_id: recordId, month_year: m, net: row.net }); }
    } catch (e) { /* ตกลง fallback */ }

    // 2) REST fallbacks หลายชื่อ endpoint
    const tries = [
      () => postJSON(`/api/admin/users/${row.user_id}/payrolls`, payload, "POST"),
      () => postJSON(`/api/admin/user-salary/upsert`, payload, "POST"),
      () => postJSON(`/api/user/payroll`, payload, "POST"),
      () => postJSON(`/api/employee/payroll/inbox`, payload, "POST"),
      () => postJSON(`/api/notify`, { type: "payroll_paid", ...payload }, "POST"),
    ];
    for (const t of tries) {
      try { await t(); return; } catch { /* try next */ }
    }
  }

  // ทำรายการจ่ายเงิน → บันทึกจริงใน DB + sync ให้พนักงาน
  async function markPaid(row) {
    setPayingId(row.id);
    setErr("");
    try {
      // มี record DB อยู่แล้วหรือยัง?
      let recordId =
        row.payroll_id ??
        (row.id && row.id !== row.user_id ? row.id : null);

      if (recordId && typeof recordId !== "string" && typeof recordId !== "number") {
        recordId = recordId.toString();
      }

      if (recordId) {
        // มี record แล้ว → mark paid
        if (adminApi?.payroll?.pay) {
          await adminApi.payroll.pay(recordId, { month_year: month });
        } else if (adminApi?.payroll?.markPaid) {
          await adminApi.payroll.markPaid(recordId, { month_year: month });
        } else {
          await fetch(`/api/admin/payroll/${recordId}/pay`, {
            method: "POST",
            credentials: "include",
          }).catch(() => null);
        }
      } else {
        // ยังไม่มี record → สร้างใหม่เป็น paid
        const payload = {
          month_year: month,
          user_id: row.user_id,
          full_name: row.full_name,
          department: row.department,
          emp_code: row.emp_code,
          base_amount: row.base,
          bonus_amount: row.bonus,
          deduction_amount: row.deduction,
          net_amount: row.net,
          status: "paid",
          meta: row.meta,
        };
        let created = null;
        if (adminApi?.payroll?.create) {
          created = await adminApi.payroll.create(payload);
        } else {
          const r = await fetch(`/api/admin/payroll`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (r.ok) created = await r.json();
        }
        const newId = created?.id ?? created?.payroll_id ?? created?._id;
        if (newId) recordId = String(newId);

        // บางระบบต้อง publish เพื่อให้ไปโผล่หน้า UserSalary
        try {
          if (adminApi?.payroll?.publish) await adminApi.payroll.publish(recordId);
          else await fetch(`/api/admin/payroll/${recordId}/publish`, { method: "POST", credentials: "include" });
        } catch {;}
      }

      // ✨ ส่งข้อมูลให้ฝั่งพนักงานเห็นที่กล่องเงินเดือนของตน
      try { await syncPaidToEmployee(recordId, row, month); } catch {;}

      // อัปเดต UI ทันที
      setRows((lst) =>
        lst.map((x) =>
          x.id === row.id
            ? { ...x, status: "paid", payroll_id: recordId, paid_at: new Date().toISOString() }
            : x
        )
      );
      setApiStats(null);
    } catch (e) {
      setErr(e?.message || "ทำรายการจ่ายเงินไม่สำเร็จ");
    } finally {
      setPayingId(0);
    }
  }

  // ✅ เรียก load เมื่อเดือนเปลี่ยน
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  /* -------- Filters & Stats (client side) -------- */
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return rows.filter((r) => {
      const byStatus = statusFilter === "all" ? true : r.status === statusFilter;
      const byText =
        !text ||
        String(r.full_name || "").toLowerCase().includes(text) ||
        String(r.department || "").toLowerCase().includes(text) ||
        String(r.emp_code || "").toLowerCase().includes(text);
      return byStatus && byText;
    });
  }, [rows, q, statusFilter]);

  // การ์ดด้านบน = ภาพรวมเดือนจาก rows ปัจจุบัน
  const derivedStats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.net || 0), 0);
    const paid = rows.filter((r) => r.status === "paid").length;
    const pending = rows.length - paid;
    const avg = rows.length ? total / rows.length : 0;
    return { total, paid, pending, avg };
  }, [rows]);

  const showStats = apiStats ?? derivedStats;

  /* ---------------- UI ---------------- */
  return (
    <div className="fade-in space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-3 w-full">
          <label className="text-sm text-gray-600">เดือน-ปี</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />

          <button
            onClick={() => generateMonth(month)}
            disabled={!month || busyGen}
            className="bg-[#054A91] text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {busyGen ? "กำลังสร้าง…" : "สร้างเงินเดือน"}
          </button>

          <button
            onClick={load}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
            title="รีเฟรช"
          >
            รีเฟรช
          </button>

          <div className="ml-auto flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา: ชื่อ / แผนก / รหัส"
              className="border rounded-lg px-3 py-2 w-52"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
              title="กรองสถานะ"
            >
              <option value="all">สถานะ: ทั้งหมด</option>
              <option value="paid">จ่ายแล้ว</option>
              <option value="pending">รอจ่าย</option>
            </select>
          </div>
        </div>

        {err && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-green-600 text-white p-6 rounded-xl">
          <p>ยอดสุทธิรวม</p>
          <p className="text-3xl font-bold">{fmtMoney(showStats.total)}</p>
        </div>
        <div className="bg-blue-600 text-white p-6 rounded-xl">
          <p>จ่ายแล้ว</p>
          <p className="text-3xl font-bold">{showStats.paid} คน</p>
        </div>
        <div className="bg-yellow-500 text-white p-6 rounded-xl">
          <p>รอจ่าย</p>
          <p className="text-3xl font-bold">{showStats.pending} คน</p>
        </div>
        <div className="bg-purple-600 text-white p-6 rounded-xl">
          <p>เฉลี่ย/คน</p>
          <p className="text-3xl font-bold">{fmtMoney(showStats.avg)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">รายการเงินเดือน (เดือน {month})</h3>
          {loading && <span className="text-sm text-gray-500">กำลังโหลด…</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left">พนักงาน</th>
                <th className="px-4 py-2 border-b text-left">แผนก</th>
                <th className="px-4 py-2 border-b text-left">ฐาน</th>
                <th className="px-4 py-2 border-b text-left">โบนัส</th>
                <th className="px-4 py-2 border-b text-left">หักเงิน</th>
                <th className="px-4 py-2 border-b text-left">สุทธิ</th>
                <th className="px-4 py-2 border-b text-left">สถานะ</th>
                <th className="px-4 py-2 border-b text-right w-48">รายละเอียด/ทำงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2">
                    <div className="font-medium leading-tight">{r.full_name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      รหัส: <span className="font-mono">{r.emp_code || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">{r.department || "-"}</td>
                  <td className="px-4 py-2">{fmtMoney(r.base)}</td>
                  <td className="px-4 py-2 text-green-700">+{fmtMoney(r.bonus)}</td>
                  <td className="px-4 py-2 text-red-700">-{fmtMoney(r.deduction)}</td>
                  <td className="px-4 py-2 font-semibold">{fmtMoney(r.net)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${
                        r.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      <i className={`fas ${r.status === "paid" ? "fa-check-circle" : "fa-clock"}`} />
                      {r.status === "paid" ? "จ่ายแล้ว" : "รอจ่าย"}
                    </span>
                    {r.paid_at && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        ชำระเมื่อ: {new Date(r.paid_at).toLocaleString("th-TH")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.meta && (
                      <div className="text-xs text-gray-600 mb-2">
                        <div>สายรวม: <b>{r.meta.lateMinutes ?? 0}</b> นาที</div>
                        <div>ขาดงาน: <b>{r.meta.absentDays ?? 0}</b> วัน</div>
                        <div>ลารับค่าจ้าง: <b>{r.meta.paidLeaveDays ?? 0}</b> วัน • ไม่รับค่าจ้าง: <b>{r.meta.unpaidLeaveDays ?? 0}</b> วัน</div>
                      </div>
                    )}
                    {r.status !== "paid" ? (
                      <button
                        onClick={() => markPaid(r)}
                        disabled={payingId === r.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg
                                   bg-gradient-to-br from-blue-600 to-indigo-600 text-white
                                   shadow-sm hover:shadow-md hover:from-blue-700 hover:to-indigo-700
                                   disabled:opacity-60"
                      >
                        <i className="fas fa-baht-sign" />
                        {payingId === r.id ? "กำลังจ่าย…" : "ทำรายการจ่ายเงิน"}
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {!filtered.length && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    ไม่พบรายการเงินเดือนในเดือนที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          * เมื่อ “ทำรายการจ่ายเงิน” ระบบจะอัปเดตฐานข้อมูลเพย์โรลของเดือนนั้น และพยายามส่งสำเนาไปยัง
          “กล่องเงินเดือนของพนักงาน” โดยอัตโนมัติ (รองรับหลาย endpoint) เพื่อให้พนักงานเห็นได้ทันที
        </p>
      </div>
    </div>
  );
}
