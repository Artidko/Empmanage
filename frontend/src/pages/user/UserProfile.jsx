// src/pages/user/UserProfile.jsx
import React, { useEffect, useState } from "react";
import { getMyProfileCard } from "../../data/employees";

export default function UserProfile() {
  const [card, setCard] = useState(null);     // { name, position, department, employeeId, salary, avatar, raw }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // คืนข้อมูลในรูปแบบเดียวกับ mockUserData เดิม + raw = โปรไฟล์ดิบจาก backend
      const c = await getMyProfileCard();
      setCard(c);
    } catch (e) {
      setErr(e.message || "โหลดโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  // helpers
  const fmtMoney = (n) =>
    Number(n ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
  const fmtThaiDate = (s) => {
    if (!s) return "-";
    try {
      return new Date(s).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };

  const startDate = card?.raw?.start_date || null;
  const workHours = card?.raw?.work_hours_per_day ?? 8;
  const level = card?.raw?.level_title || "—";

  return (
    <div className="fade-in">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm disabled:opacity-50"
            disabled={loading}
            title="รีเฟรช"
          >
            รีเฟรช
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse">
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-24 h-24 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-5 w-48 bg-gray-200 rounded" />
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-24 bg-gray-100 rounded" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        ) : err ? (
          <p className="text-red-600">{err}</p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center space-x-6 mb-8">
              <div className="relative">
                <img
                  src={card?.avatar}
                  alt="Profile"
                  className="w-24 h-24 rounded-full border-4 border-indigo-200 object-cover"
                />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                  <i className="fas fa-check text-white text-xs" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">{card?.name}</h2>
                <p className="text-indigo-600 font-medium text-lg">{card?.position}</p>
                <p className="text-gray-500">{card?.department}</p>
              </div>
            </div>

            {/* Main stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-700 mb-2">รหัสพนักงาน</h3>
                <p className="text-2xl font-bold text-indigo-600">
                  {card?.employeeId || "—"}
                </p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500">
                <h3 className="font-semibold text-gray-700 mb-2">เงินเดือน</h3>
                <p className="text-2xl font-bold text-green-600">
                  ฿{fmtMoney(card?.salary)}
                </p>
              </div>
            </div>

            {/* Extra info */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <i className="fas fa-calendar-check text-2xl text-blue-500 mb-2" />
                <p className="text-sm text-gray-600">วันที่เริ่มงาน</p>
                <p className="font-semibold">{fmtThaiDate(startDate)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <i className="fas fa-clock text-2xl text-green-500 mb-2" />
                <p className="text-sm text-gray-600">ชั่วโมงทำงาน</p>
                <p className="font-semibold">{workHours} ชม./วัน</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <i className="fas fa-award text-2xl text-yellow-500 mb-2" />
                <p className="text-sm text-gray-600">ระดับ</p>
                <p className="font-semibold">{level}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
