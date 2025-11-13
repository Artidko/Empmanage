// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { adminApi } from "../../data/admin";

/* ---------------- Helpers ---------------- */
const money = (n) => "฿" + Number(n || 0).toLocaleString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const ymNow = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
};
const inMonth = (dateStr, ym) => {
  if (!dateStr) return false;
  const s = String(dateStr);
  const d = new Date(/^\d{4}-\d{2}$/.test(s) ? `${s}-01` : s);
  if (isNaN(d)) return false;
  const [y, m] = ym.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m;
};
const pick = (o, keys, d = undefined) => {
  for (const k of keys) if (o && o[k] != null) return o[k];
  return d;
};
const parseList = (x) => (Array.isArray(x) ? x : x?.items || x?.data || x?.employees || []);

/* ---------- network utils with timeout ---------- */
function withTimeout(promise, ms = 6000, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return Promise.race([
    promise,
    new Promise((_, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), ms);
      signal?.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
    }),
  ]);
}
async function fetchJSON(url, { method = "GET", body, headers, credentials = "include", timeout = 6000, signal } = {}) {
  const ac = new AbortController();
  signal?.addEventListener("abort", () => ac.abort(), { once: true });
  const res = await withTimeout(fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    credentials,
    body: body ? JSON.stringify(body) : undefined,
    signal: ac.signal,
  }), timeout, ac.signal);
  if (!res?.ok) return null;
  try { return await res.json(); } catch { return null; }
}

export default function AdminDashboard() {
  // ไม่ใช้ loading สำหรับโชว์ “…” บนการ์ดอีกแล้ว
  const [err, setErr] = useState("");

  // entities
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  // stats
  const [presentToday, setPresentToday] = useState(null);
  const [payrollStats, setPayrollStats] = useState({ total: 0, paid: 0, pending: 0, avg: 0, count: 0 });

  const month = ymNow();

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    async function loadEmployees() {
      try {
        let emp = [];
        try {
          emp = parseList(await withTimeout(adminApi.listEmployees(), 5000, ac.signal));
        } catch {
          const d = await fetchJSON(`/api/admin/employees`, { timeout: 5000, signal: ac.signal });
          emp = parseList(d);
        }
        if (alive) setEmployees(emp);
      } catch { if (alive) setEmployees([]); }
    }

    async function loadLeaves() {
      try {
        let arr = [];
        try {
          arr = parseList(await withTimeout(adminApi.listLeaveRequests(), 5000, ac.signal));
        } catch {
          const d = await fetchJSON(`/api/admin/leave`, { timeout: 5000, signal: ac.signal });
          arr = parseList(d);
        }
        const pending = arr.filter((x) =>
          String(x.status || x.approval_status || "").toLowerCase().includes("pend")
        );
        if (alive) setLeaveRequests(pending);
      } catch { if (alive) setLeaveRequests([]); }
    }

    async function loadAttendanceToday() {
      try {
        let count = null;
        try {
          if (adminApi?.attendanceToday) {
            const { count: c } = await withTimeout(adminApi.attendanceToday(), 5000, ac.signal);
            count = Number(c || 0);
          } else if (adminApi?.attendance?.today) {
            const { count: c } = await withTimeout(adminApi.attendance.today(), 5000, ac.signal);
            count = Number(c || 0);
          }
        } catch { /* fallback */ }
        if (count == null) {
          const t = todayStr();
          const data = await fetchJSON(`/api/admin/attendance?from=${t}&to=${t}`, { timeout: 5000, signal: ac.signal });
          if (data) {
            const arr = parseList(data);
            const uniq = new Set(arr.map(a => a.user_id ?? a.userId ?? a.employee_id ?? a.employeeId).filter(Boolean));
            count = uniq.size;
          }
        }
        if (alive) setPresentToday(count);
      } catch { if (alive) setPresentToday(null); }
    }

    async function loadPayroll() {
      try {
        let s = null;
        try {
          if (adminApi?.payroll?.stats) s = await withTimeout(adminApi.payroll.stats(month), 6000, ac.signal);
        } catch { /* noop */ }
        if (s) {
          const total = Number(pick(s, ["total", "sum", "total_net"], 0));
          const paid = Number(pick(s, ["paid", "paid_count", "count_paid"], 0));
          const pending = Number(pick(s, ["pending", "pending_count"], 0));
          const count = Number(pick(s, ["count", "total_count"], paid + pending));
          const avg = Number(pick(s, ["avg", "average", "avg_net"], count ? total / count : 0));
          if (alive) setPayrollStats({ total, paid, pending, avg, count });
          return;
        }
        // fallback list + compute
        let arr = [];
        try {
          if (adminApi?.payroll?.list) {
            const r = await withTimeout(adminApi.payroll.list(month), 6000, ac.signal);
            arr = parseList(r);
          }
        } catch {;}
        if (!arr.length) {
          const d = await fetchJSON(`/api/admin/payroll?month_year=${encodeURIComponent(month)}`, { timeout: 6000, signal: ac.signal });
          arr = parseList(d);
        }
        const total = arr.reduce((s, x) => {
          const net = pick(x, ["net_amount", "net"], null);
          if (net != null) return s + Number(net || 0);
          const b = Number(pick(x, ["base_amount", "base", "salary_base", "salary"], 0));
          const bo = Number(pick(x, ["bonus_amount", "bonus"], 0));
          const d = Number(pick(x, ["deduction_amount", "deduction"], 0));
          return s + (b + bo - d);
        }, 0);
        const paid = arr.filter((x) =>
          String(pick(x, ["status", "pay_status"], "pending")).toLowerCase().includes("paid")
        ).length;
        const count = arr.length;
        const pending = Math.max(0, count - paid);
        const avg = count ? total / count : 0;
        if (alive) setPayrollStats({ total, paid, pending, avg, count });
      } catch {
        if (alive) setPayrollStats({ total: 0, paid: 0, pending: 0, avg: 0, count: 0 });
      }
    }

    (async () => {
      setErr("");
      await Promise.allSettled([
        loadEmployees(),
        loadLeaves(),
        loadAttendanceToday(),
        loadPayroll(),
      ]);
    })().catch((e) => {
      if (alive) setErr(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    });

    return () => { alive = false; ac.abort(); };
  }, []); // โหลดครั้งเดียวตอนเมานต์

  const monthStr = ymNow();
  const totalEmployees = employees.length;
  const totalDepartments = new Set(employees.map((e) => (e.department || "").trim()).filter(Boolean)).size;

  const newHires = employees
    .filter((e) => inMonth(e.start_date || e.hired_at || e.joined_at, monthStr))
    .slice(0, 5);

  const leaveLatest = leaveRequests
    .sort((a, b) => new Date(b.created_at || b.requested_at || 0) - new Date(a.created_at || a.requested_at || 0))
    .slice(0, 5);

  return (
    <div className="fade-in space-y-6">
      {err && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{err}</div>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-md">
          <p>พนักงานทั้งหมด</p>
          <p className="text-3xl font-bold">{totalEmployees}</p>
          <p className="text-sm opacity-80">ข้อมูลจากระบบ</p>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-xl shadow-md">
          <p>เข้างานวันนี้</p>
          <p className="text-3xl font-bold">{presentToday ?? "–"}</p>
          <p className="text-sm opacity-80">{presentToday == null ? "ยังไม่เชื่อมต่อข้อมูลเข้างาน" : todayStr()}</p>
        </div>

        <div className="bg-yellow-500 text-white p-6 rounded-xl shadow-md">
          <p>คำขอลา (รออนุมัติ)</p>
          <p className="text-3xl font-bold">{leaveRequests.length}</p>
          <p className="text-sm opacity-80">สถานะรอดำเนินการ</p>
        </div>

        <div className="bg-purple-600 text-white p-6 rounded-xl shadow-md">
          <p>แผนกทั้งหมด</p>
          <p className="text-3xl font-bold">{totalDepartments}</p>
          <p className="text-sm opacity-80">นับจากข้อมูลพนักงาน</p>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-emerald-600 text-white p-6 rounded-xl shadow-md">
          <p>ยอดเพย์โรลรวม ({monthStr})</p>
          <p className="text-3xl font-bold">{money(payrollStats.total)}</p>
          <p className="text-sm opacity-80">รวมสุทธิ</p>
        </div>
        <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-md">
          <p>จ่ายแล้ว</p>
          <p className="text-3xl font-bold">{payrollStats.paid} คน</p>
          <p className="text-sm opacity-80">บนฐานข้อมูลจริง</p>
        </div>
        <div className="bg-orange-500 text-white p-6 rounded-xl shadow-md">
          <p>รอจ่าย</p>
          <p className="text-3xl font-bold">{payrollStats.pending} คน</p>
          <p className="text-sm opacity-80">ยังไม่ทำจ่าย</p>
        </div>
        <div className="bg-fuchsia-600 text-white p-6 rounded-xl shadow-md">
          <p>เฉลี่ย/คน</p>
          <p className="text-3xl font-bold">{money(payrollStats.avg)}</p>
          <p className="text-sm opacity-80">จาก {payrollStats.count} รายการ</p>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">คำขอลาล่าสุด (รออนุมัติ)</h3>
            <span className="text-sm text-gray-500">{leaveRequests.length} รายการ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">พนักงาน</th>
                  <th className="px-3 py-2 text-left">ประเภท</th>
                  <th className="px-3 py-2 text-left">ช่วงวัน</th>
                  <th className="px-3 py-2 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaveLatest.map((lv, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{lv.full_name || lv.employee_name || "-"}</td>
                    <td className="px-3 py-2">{lv.type || lv.leave_type || "-"}</td>
                    <td className="px-3 py-2">
                      {(lv.start_date || lv.from_date || lv.from || "-")} → {(lv.end_date || lv.to_date || lv.to || "-")}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
                        {lv.status || lv.approval_status || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!leaveLatest.length && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>ไม่มีคำขอลารออนุมัติ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">พนักงานใหม่ในเดือนนี้</h3>
            <span className="text-sm text-gray-500">
              {employees.filter((e) => inMonth(e.start_date || e.hired_at || e.joined_at, monthStr)).length} คน
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">ชื่อ</th>
                  <th className="px-3 py-2 text-left">แผนก</th>
                  <th className="px-3 py-2 text-left">เริ่มงาน</th>
                  <th className="px-3 py-2 text-left">เงินเดือน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {newHires.map((e) => (
                  <tr key={e.id || e.emp_code}>
                    <td className="px-3 py-2">{e.full_name || e.name || "-"}</td>
                    <td className="px-3 py-2">{e.department || "-"}</td>
                    <td className="px-3 py-2">{e.start_date || e.hired_at || e.joined_at || "-"}</td>
                    <td className="px-3 py-2">{money(e.salary_base ?? e.salary ?? 0)}</td>
                  </tr>
                ))}
                {!newHires.length && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>ไม่มีพนักงานใหม่ในเดือนนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
