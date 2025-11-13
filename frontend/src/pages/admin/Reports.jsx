// src/pages/admin/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../data/admin";

/* ---------- small utils ---------- */
const THB = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null) return o[k]; };
const num  = (v, d = 0) => (v == null || isNaN(+v) ? d : +v);

// HH:mm from timestamp (ISO / DATETIME / HH:mm)
const toHM = (ts) => {
  if (!ts && ts !== 0) return "";
  const s = String(ts);
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) return (s.split(" ")[1] || "").slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s); if (!isNaN(d)) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  try {
    const d = new Date(s); if (!isNaN(d)) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {;}
  return "";
};
const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
const yyyy_mm_dd = (d) => {
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dy = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${m}-${dy}`;
};
const dateOnly = (s) => {
  if (!s) return null;
  const str = String(s);
  if (str.includes("T")) return str.slice(0, 10);
  if (str.includes(" ")) return str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return yyyy_mm_dd(str);
};

/* ---------- fetch attendance (try adminApi then REST) ---------- */
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
  try {
    const r1 = await fetch(`/api/admin/attendance/range?from=${from}&to=${to}`, { credentials: "include" });
    if (r1.ok) return await r1.json();
  } catch {;}
  try {
    const r2 = await fetch(`/api/admin/attendance?from=${from}&to=${to}`, { credentials: "include" });
    if (r2.ok) return await r2.json();
  } catch {;}
  return [];
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [employees, setEmployees] = useState([]);
  const [todayStats, setTodayStats] = useState({ present: 0, late: 0, absent: 0 });
  const [monthStats, setMonthStats] = useState({ totalHours: 0, avgPerPersonPerDay: 0 });

  // date refs
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => yyyy_mm_dd(today), [today]);
  const monthStartStr = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return yyyy_mm_dd(d);
  }, [today]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");

      try {
        // 1) employees
        const emp = await adminApi.listEmployees();
        const emps = Array.isArray(emp) ? emp : emp.items || emp.employees || [];
        // keep original order or sort by name if you like:
        // emps.sort((a,b)=>String(a.full_name||"").localeCompare(String(b.full_name||""),"th"));
        setEmployees(emps);

        // 2) attendance today + month
        const [rawToday, rawMonth] = await Promise.all([
          fetchAttendanceRange(todayStr, todayStr),
          fetchAttendanceRange(monthStartStr, todayStr),
        ]);

        // Normalize records
        const normalize = (list) => {
          const arr = Array.isArray(list) ? list : list?.items || list?.data || [];
          return arr.map((a) => {
            const clockInRaw = pick(a, ["clock_in", "check_in"]);
            const clockOutRaw = pick(a, ["clock_out", "check_out"]);
            const rec = {
              date: dateOnly(clockInRaw || pick(a, ["created_at", "createdAt"]) || todayStr) || todayStr,
              userId: a.user_id ?? a.userId ?? a.id,
              in: toHM(clockInRaw),
              out: toHM(clockOutRaw),
              minutes: a.minutes != null ? Number(a.minutes) : null,
            };
            if (rec.minutes == null && rec.in && rec.out) {
              const diff = toMin(rec.out) - toMin(rec.in);
              rec.minutes = Number.isFinite(diff) ? Math.max(0, diff) : null;
            }
            return rec;
          });
        };

        const todayNorm = normalize(rawToday).filter((r) => r.date === todayStr);
        const monthNorm = normalize(rawMonth);

        // 2.1 Today stats (present / late / absent)
        const presentMap = new Map(todayNorm.map((r) => [r.userId, r]));
        const present = presentMap.size;
        const late = [...presentMap.values()].filter((r) => {
          const min = toMin(r.in);
          return min != null && min > toMin("08:30");
        }).length;
        const absent = Math.max(0, (emps?.length || 0) - present);

        setTodayStats({ present, late, absent });

        // 2.2 Month stats (total hours & avg per person per day)
        const totalMinutes = monthNorm.reduce((sum, r) => sum + (r.minutes || 0), 0);
        const totalHours = totalMinutes / 60;

        // unique person-days for average (fairer than dividing by all emp * days)
        const personDaySet = new Set(monthNorm.map((r) => `${r.userId}|${r.date}`));
        const denom = Math.max(1, personDaySet.size);
        const avgPerPersonPerDay = totalHours / denom;

        setMonthStats({
          totalHours: Number(totalHours.toFixed(1)),
          avgPerPersonPerDay: Number(avgPerPersonPerDay.toFixed(2)),
        });
      } catch (e) {
        console.error("[reports]", e);
        setErr(e?.message || "โหลดข้อมูลรายงานไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [todayStr, monthStartStr]);

  // payroll quick stats from employee_profiles columns if available
  const payroll = useMemo(() => {
    const salaryList = employees.map((e) => num(e.salary_base, 0));
    const withSalary = salaryList.filter((v) => v > 0);
    const sum = withSalary.reduce((s, v) => s + v, 0);
    const avg = withSalary.length ? sum / withSalary.length : 0;
    return {
      count: employees.length,
      withSalaryCount: withSalary.length,
      totalBase: sum,
      avgBase: avg,
    };
  }, [employees]);

  return (
    <div className="fade-in space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h3 className="text-xl font-bold">หมวดรายงาน</h3>
          <div className="text-sm text-gray-500">อัปเดตล่าสุด: {new Date().toLocaleString("th-TH")}</div>
        </div>

        {err && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{err}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Employees */}
          <div className="p-6 rounded-xl border bg-gradient-to-b from-blue-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-blue-100 text-blue-600">
                  <i className="fas fa-users" />
                </span>
                <div>
                  <p className="text-sm text-gray-500">พนักงานทั้งหมด</p>
                  <p className="text-2xl font-bold">{loading ? "…" : employees.length}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">เงินเดือนรวม</p>
                <p className="text-lg font-semibold">{loading ? "…" : THB.format(payroll.totalBase)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-gray-500">มีฐานเงินเดือน</p>
                <p className="font-semibold">{loading ? "…" : payroll.withSalaryCount} คน</p>
              </div>
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-gray-500">ฐานเฉลี่ย/คน</p>
                <p className="font-semibold">{loading ? "…" : THB.format(payroll.avgBase)}</p>
              </div>
            </div>
          </div>

          {/* Time (today + month) */}
          <div className="p-6 rounded-xl border bg-gradient-to-b from-green-50 to-white">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-green-100 text-green-600">
                <i className="fas fa-clock" />
              </span>
              <div>
                <p className="text-sm text-gray-500">สถิติวันนี้ ({todayStr})</p>
                <p className="text-lg font-bold">
                  {loading ? "…" : `${todayStats.present} มาทำงาน • ${todayStats.late} สาย • ${todayStats.absent} ขาด`}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-gray-500">ชั่วโมงรวมเดือนนี้</p>
                <p className="font-semibold">{loading ? "…" : `${monthStats.totalHours} ชม.`}</p>
              </div>
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-gray-500">เฉลี่ยต่อคน-ต่อวัน</p>
                <p className="font-semibold">{loading ? "…" : `${monthStats.avgPerPersonPerDay} ชม.`}</p>
              </div>
            </div>
          </div>

          {/* Payroll quick glance */}
          <div className="p-6 rounded-xl border bg-gradient-to-b from-purple-50 to-white">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-purple-100 text-purple-600">
                <i className="fas fa-money-bill" />
              </span>
              <div>
                <p className="text-sm text-gray-500">งบประมาณเงินเดือน (ฐาน)</p>
                <p className="text-2xl font-bold">{loading ? "…" : THB.format(payroll.totalBase)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-gray-500">พนง.มีฐาน</p>
                <p className="font-semibold">{loading ? "…" : `${payroll.withSalaryCount} คน`}</p>
              </div>
              <div className="p-3 rounded-lg bg-white border">
                <p className="text-gray-500">พนง.ทั้งหมด</p>
                <p className="font-semibold">{loading ? "…" : `${payroll.count} คน`}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Optional: mini footnote */}
        <p className="mt-6 text-xs text-gray-400">
          * ชั่วโมงทำงานเดือนนี้คำนวณจากเข้างาน–ออกงาน/นาทีที่ระบบบันทึกไว้จริง (นับเฉพาะวันที่มีข้อมูล)
        </p>
      </div>
    </div>
  );
}

