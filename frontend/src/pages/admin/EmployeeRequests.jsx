// src/pages/admin/EmployeeRequests.jsx
import React, { useEffect, useRef, useState } from "react";
import { adminApi as api } from "../../data/employees";

export default function EmployeeRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [err, setErr] = useState("");
  const didRun = useRef(false); // กัน useEffect ใน React.StrictMode เรียกซ้ำ

  const toArray = (d) =>
    Array.isArray(d) ? d : d?.items || d?.requests || d?.data || [];

  const thStatus = (s) =>
    s === "approved" ? "อนุมัติแล้ว" : s === "rejected" ? "ปฏิเสธ" : "รออนุมัติ";

  const statusClass = (s) =>
    s === "approved"
      ? "bg-green-100 text-green-800"
      : s === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("th-TH") : "-");

  const diffDays = (s, e, fallback = 1) => {
    try {
      const a = new Date(s);
      const b = new Date(e);
      const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
      return Math.max(1, Math.round(ms / 86400000) + 1);
    } catch {
      return fallback;
    }
  };

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = api.leave?.list
        ? await api.leave.list()
        : await api.listLeaveRequests();
      setRows(toArray(data));
    } catch (e) {
      // เก็บ error ไว้ แต่ถ้ามีข้อมูลเก่าแล้ว จะไม่โชว์ข้อความแดงข้างบน (ลดความรก)
      setErr(e?.message || "โหลดคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    load();
  }, );

  async function act(id, action) {
    // ยืนยันก่อน
    const confirmMsg =
      action === "approve" ? "ยืนยันอนุมัติคำขอนี้?" : "ยืนยันปฏิเสธคำขอนี้?";
    if (!window.confirm(confirmMsg)) return;

    // จำสถานะเดิมไว้เผื่อ rollback
    const prev = rows.find((r) => r.id === id);
    setSavingId(id);
    setErr("");

    // optimistic update
    setRows((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r
      )
    );

    try {
      if (action === "approve") {
        if (api.leave?.approve) await api.leave.approve(id);
        else await api.approveLeave(id);
      } else {
        if (api.leave?.reject) await api.leave.reject(id);
        else await api.rejectLeave(id);
      }
    } catch (e) {
      // rollback ถ้า fail
      setRows((rs) => rs.map((r) => (r.id === id ? prev : r)));
      setErr(e?.message || "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  }

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );

  return (
    <div className="fade-in space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">คำขอลาพนักงาน</h3>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            รีเฟรช
          </button>
        </div>

        {/* โชว์ error เฉพาะตอนที่ยังไม่มีข้อมูลให้ดู */}
        {err && !rows.length && (
          <p className="text-red-600 text-sm mb-3">{err}</p>
        )}

        {loading ? (
          <p>กำลังโหลด...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border-b text-left">พนักงาน</th>
                  <th className="px-4 py-2 border-b text-left">ประเภท</th>
                  <th className="px-4 py-2 border-b text-left">วันที่</th>
                  <th className="px-4 py-2 border-b text-left">จำนวนวัน</th>
                  <th className="px-4 py-2 border-b text-left">สถานะ</th>
                  <th className="px-4 py-2 border-b text-left">เหตุผล</th>
                  <th className="px-4 py-2 border-b text-right w-44">การทำงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((req) => {
                  const type = req.leave_type || req.type || "-";
                  const start = req.start_date || req.startDate;
                  const end = req.end_date || req.endDate;
                  const days = req.days ?? diffDays(start, end, 1);
                  const status = req.status || "pending";
                  const isPending = status === "pending";

                  const empCode = req.emp_code || req.employee_code || "-";
                  const empName = req.full_name || req.name || "";
                  const dept = req.department || "";

                  return (
                    <tr key={req.id}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                            {empCode}
                          </span>
                          <div className="leading-tight">
                            <div className="font-medium text-gray-800">
                              {empName || "-"}
                            </div>
                            {dept ? (
                              <div className="text-xs text-gray-500">{dept}</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">{type}</td>
                      <td className="px-4 py-2">
                        {fmtDate(start)} – {fmtDate(end)}
                      </td>
                      <td className="px-4 py-2">{days}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${statusClass(
                            status
                          )}`}
                        >
                          {thStatus(status)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{req.reason || "-"}</td>
                      <td className="px-4 py-2 text-right">
                        {isPending ? (
                          <div className="inline-flex items-center gap-2">
                            {/* อนุมัติ */}
                            <button
                              onClick={() => act(req.id, "approve")}
                              disabled={savingId === req.id}
                              title="อนุมัติ"
                              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg
                                         border border-green-600/30 text-white
                                         bg-gradient-to-b from-green-500 to-green-600
                                         shadow-sm hover:from-green-600 hover:to-green-700
                                         focus:outline-none focus:ring-2 focus:ring-green-400
                                         disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {savingId === req.id ? (
                                <Spinner />
                              ) : (
                                <i className="fas fa-check" aria-hidden="true" />
                              )}
                              <span className="font-medium">อนุมัติ</span>
                            </button>

                            {/* ปฏิเสธ */}
                            <button
                              onClick={() => act(req.id, "reject")}
                              disabled={savingId === req.id}
                              title="ปฏิเสธ"
                              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg
                                         border border-red-600/30 text-white
                                         bg-gradient-to-b from-red-500 to-red-600
                                         shadow-sm hover:from-red-600 hover:to-red-700
                                         focus:outline-none focus:ring-2 focus:ring-red-400
                                         disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {savingId === req.id ? (
                                <Spinner />
                              ) : (
                                <i className="fas fa-times" aria-hidden="true" />
                              )}
                              <span className="font-medium">ปฏิเสธ</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                      ไม่มีคำขอ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ถ้ามี error แต่มีข้อมูลแล้ว ให้แสดงเล็ก ๆ ใต้ตารางแทน */}
        {err && rows.length > 0 && (
          <p className="text-xs text-red-500 mt-3">หมายเหตุ: {err}</p>
        )}
      </div>
    </div>
  );
}
