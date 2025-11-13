// src/pages/user/UserLeave.jsx
import React, { useEffect, useMemo, useState } from "react";
import { employeeApi } from "../../data/employees";

export default function UserLeave() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,   setSaving] = useState(false);
  const [err,      setErr] = useState("");
  const [ok,       setOk]  = useState("");

  const [form, setForm] = useState({
    leave_type: "ลาป่วย",     // ลาป่วย | ลากิจ | ลาพักร้อน | ลาคลอด
    start_date: "",
    end_date:   "",
    reason:     "",
  });

  const computedDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return "";
    const a = new Date(form.start_date);
    const b = new Date(form.end_date);
    const diff = Math.round((b - a) / 86400000) + 1; // รวมวันแรก
    return diff > 0 ? diff : 0;
  }, [form.start_date, form.end_date]);

  const load = async () => {
    setLoading(true); setErr(""); setOk("");
    try {
      const rows = await employeeApi.listLeaves(); // GET /employee/leave
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e?.message || "โหลดประวัติการลาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!form.start_date || !form.end_date) {
      setErr("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setErr("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      return;
    }

    setSaving(true);
    try {
      await employeeApi.requestLeave({
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date:   form.end_date,
        reason:     form.reason,
      }); // POST /employee/leave
      setOk("ส่งคำขอเรียบร้อย");
      setForm((f) => ({ ...f, start_date: "", end_date: "", reason: "" }));
      await load();
    } catch (e) {
      setErr(e?.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const toThaiDate = (d) =>
    d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

  const statusBadge = (status) => {
    // backend คาดว่าเก็บ pending/approved/rejected
    const map = {
      pending:   { text: "รออนุมัติ",   cls: "bg-yellow-100 text-yellow-800" },
      approved:  { text: "อนุมัติแล้ว", cls: "bg-green-100  text-green-800"  },
      rejected:  { text: "ปฏิเสธ",      cls: "bg-red-100    text-red-800"    },
    };
    const s = map[status] || { text: status || "-", cls: "bg-gray-100 text-gray-700" };
    return <span className={`px-2 py-1 rounded text-sm ${s.cls}`}>{s.text}</span>;
  };

  return (
    <div className="fade-in space-y-6">
      {/* ฟอร์มขอลา */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          <i className="fas fa-calendar-plus mr-3 text-blue-500" />
          ขอลา
        </h2>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทการลา</label>
            <select
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={form.leave_type}
              onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))}
            >
              <option>ลาป่วย</option>
              <option>ลากิจ</option>
              <option>ลาพักร้อน</option>
              <option>ลาคลอด</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนวัน</label>
            <input
              type="text"
              readOnly
              value={computedDays}
              className="w-full px-4 py-3 border rounded-lg bg-gray-50"
              placeholder="-"
              title="คำนวณอัตโนมัติจากวันที่เริ่ม/สิ้นสุด"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">วันที่เริ่ม</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">วันที่สิ้นสุด</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">เหตุผล</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="กรุณาระบุเหตุผลในการลา"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-60"
            >
              <i className="fas fa-paper-plane mr-2" />
              {saving ? "กำลังส่ง..." : "ส่งคำขอ"}
            </button>
            {err && <span className="text-red-600 text-sm">{err}</span>}
            {ok  && <span className="text-green-600 text-sm">{ok}</span>}
          </div>
        </form>
      </div>

      {/* ประวัติการลา */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-bold text-gray-800 mb-6">
          <i className="fas fa-history mr-3 text-green-500" />
          ประวัติการลา
        </h3>

        {loading ? (
          <p>กำลังโหลด...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-3 px-4 text-left font-semibold">ประเภท</th>
                  <th className="py-3 px-4 text-left font-semibold">วันที่</th>
                  <th className="py-3 px-4 text-left font-semibold">จำนวนวัน</th>
                  <th className="py-3 px-4 text-left font-semibold">สถานะ</th>
                  <th className="py-3 px-4 text-left font-semibold">เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const days =
                    r.start_date && r.end_date
                      ? Math.max(1, Math.round((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1)
                      : 1;
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {r.leave_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {toThaiDate(r.start_date)} {r.end_date ? `- ${toThaiDate(r.end_date)}` : ""}
                      </td>
                      <td className="py-3 px-4 text-center">{days}</td>
                      <td className="py-3 px-4">{statusBadge(r.status)}</td>
                      <td className="py-3 px-4">{r.reason || "-"}</td>
                    </tr>
                  );
                })}
                {!items.length && (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={5}>
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
