import React, { useEffect, useState } from "react";
import { employeeApi } from "../../data/employees";

export default function UserSalary() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [me, setMe] = useState(null);
  const [slips, setSlips] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [profile, payroll] = await Promise.all([
        employeeApi.me(),       // GET /api/employee/me
        employeeApi.payroll(),  // GET /api/employee/payroll
      ]);
      setMe(profile);
      const list =
        Array.isArray(payroll) ? payroll : payroll?.items || payroll?.data || [];
      setSlips(list);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลเงินเดือนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  const money = (n) =>
    Number(n ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });

  const monthTH = (s) => {
    if (!s) return "-";
    const str = String(s);
    const iso = /^\d{4}-\d{2}$/.test(str) ? `${str}-01` : str; // เผื่อเป็น "YYYY-MM"
    const d = new Date(iso);
    return isNaN(d)
      ? str
      : d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  };

  // แปลงสลิปให้เป็นรูปเดียวกัน + ให้คะแนนเวลาไว้เรียง (order)
  const normSlips = slips.map((p) => {
    const month = p.month_year || p.month || p.period || "";
    const base =
      p.base_salary ?? p.salary_base ?? p.base ?? p.salary ?? me?.salary_base ?? 0;
    const plus = p.overtime ?? p.ot ?? p.bonus ?? 0; // รองรับ OT หรือ bonus
    const ded = p.deductions ?? p.deduction ?? p.tax ?? 0;
    const net = p.net_pay ?? p.net ?? p.net_amount ?? p.total_net ?? base + plus - ded;
    const status = (p.status || p.pay_status || "").toString().toLowerCase();
    const paidAt = p.paid_at || p.paidAt || p.updated_at || p.updatedAt || null;

    // order: เอา month ก่อน ถ้าไม่มีค่อยใช้ paidAt/createdAt
    let order = 0;
    const monthStr = /^\d{4}-\d{2}$/.test(String(month)) ? `${month}-01` : month;
    const mDate = new Date(monthStr);
    if (!isNaN(mDate)) order = +mDate;
    else if (paidAt && !isNaN(new Date(paidAt))) order = +new Date(paidAt);
    else if (p.created_at && !isNaN(new Date(p.created_at))) order = +new Date(p.created_at);
    else order = 0;

    return {
      id: p.id || p._id || `${month}-${Math.random()}`,
      month,
      base: Number(base || 0),
      plus: Number(plus || 0),
      ded: Number(ded || 0),
      net: Number(net || 0),
      status,
      paidAt,
      order,
    };
  });

  // เฉพาะสลิปที่ "จ่ายแล้ว"
  const paidSlips = normSlips.filter(
    (s) => s.status === "paid" || s.status === "success" || s.status === "จ่ายแล้ว"
  );

  // เงินเดือนล่าสุดที่ "ได้รับจริง" = สลิปจ่ายแล้วที่ล่าสุด
  const latestPaid =
    paidSlips.sort((a, b) => b.order - a.order)[0] || null;

  // รวมปีนี้ (เฉพาะที่จ่ายแล้ว) ถ้าไม่มีสลิปเลย fallback เป็นฐาน * 12
  const currentYear = new Date().getFullYear();
  const yearPaidTotal =
    paidSlips.length > 0
      ? paidSlips
          .filter((s) => {
            // ตัดสินปีจาก month ถ้ามี ไม่งั้นใช้ paidAt
            let d = null;
            if (s.month) {
              const m = /^\d{4}-\d{2}$/.test(String(s.month))
                ? `${s.month}-01`
                : String(s.month);
              const md = new Date(m);
              if (!isNaN(md)) d = md;
            }
            if (!d && s.paidAt) {
              const pd = new Date(s.paidAt);
              if (!isNaN(pd)) d = pd;
            }
            return (d ? d.getFullYear() : currentYear) === currentYear;
          })
          .reduce((sum, s) => sum + (s.net || 0), 0)
      : Number(me?.salary_base ?? me?.salary ?? 0) * 12;

  return (
    <div className="fade-in">
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-money-bill-wave text-3xl text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">เงินเดือนของฉัน</h2>
          <p className="text-gray-600">ดูข้อมูลเงินเดือนและสลิปเงินเดือน</p>
        </div>

        {/* Loading / Error */}
        {loading ? (
          <p className="text-center">กำลังโหลด…</p>
        ) : err ? (
          <p className="text-center text-red-600">{err}</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-1">
                  เงินเดือนล่าสุดที่ได้รับ
                </h3>
                <p className="text-3xl font-bold text-green-600">
                  ฿{money(latestPaid?.net ?? 0)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {latestPaid
                    ? `รอบเดือน: ${monthTH(latestPaid.month)}`
                    : "ยังไม่มีรายการจ่าย"}
                </p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-1">
                  เงินเดือนรวมปีนี้ (ที่จ่ายแล้ว)
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  ฿{money(yearPaidTotal)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date().toLocaleDateString("th-TH", { year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Payroll table */}
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 border-b text-left">รอบเดือน</th>
                    <th className="px-4 py-2 border-b text-right">ฐาน</th>
                    <th className="px-4 py-2 border-b text-right">เพิ่ม (OT/โบนัส)</th>
                    <th className="px-4 py-2 border-b text-right">หัก</th>
                    <th className="px-4 py-2 border-b text-right">สุทธิ</th>
                    <th className="px-4 py-2 border-b text-left">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {normSlips
                    .sort((a, b) => b.order - a.order)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2">{monthTH(p.month)}</td>
                        <td className="px-4 py-2 text-right">฿{money(p.base)}</td>
                        <td className="px-4 py-2 text-right">฿{money(p.plus)}</td>
                        <td className="px-4 py-2 text-right">฿{money(p.ded)}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          ฿{money(p.net)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              p.status === "paid" ||
                              p.status === "success" ||
                              p.status === "จ่ายแล้ว"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            <i
                              className={`fas ${
                                p.status === "paid" ||
                                p.status === "success" ||
                                p.status === "จ่ายแล้ว"
                                  ? "fa-check-circle"
                                  : "fa-clock"
                              }`}
                            />
                            {p.status === "paid" ||
                            p.status === "success" ||
                            p.status === "จ่ายแล้ว"
                              ? "จ่ายแล้ว"
                              : "รอจ่าย"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {!normSlips.length && (
                    <tr>
                      <td className="px-4 py-6 text-center" colSpan={6}>
                        ยังไม่มีสลิปเงินเดือน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                disabled
                className="bg-yellow-500/70 text-white px-4 py-2 rounded-lg cursor-not-allowed"
                title="เร็ว ๆ นี้"
              >
                <i className="fas fa-file-pdf mr-2" />
                ดาวน์โหลดสลิป
              </button>
              <button
                onClick={load}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                <i className="fas fa-history mr-2" />
                รีเฟรชประวัติ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
