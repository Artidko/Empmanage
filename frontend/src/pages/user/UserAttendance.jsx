// src/pages/user/UserAttendance.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { employeeApi } from "../../data/employees";

/**
 * หน้าเข้าออกงาน (ของพนักงาน)
 * - โหลดประวัติจาก /api/employee/attendance
 * - ปุ่ม "เข้างาน/ออกงาน" ขอพิกัดจาก browser แล้วส่ง {lat,lng,accuracy}
 * - แสดงสถานะ "ปกติ/สาย" (เข้า > 08:30 = สาย)
 * - แผนที่โฟกัส "บันทึกของวันนี้" และเลือกแท็บเข้างาน/ออกงานให้อัตโนมัติ
 */
export default function UserAttendance() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null); // "in" | "out" | null
  const [now, setNow] = useState(new Date());
  const [err, setErr] = useState("");
  const [mapType, setMapType] = useState("in"); // "in" | "out"
  const didRun = useRef(false);

  // ใช้สำหรับเลื่อนจอไปที่ "แถวของวันนี้"
  const todayRowRef = useRef(null);

  /* ---------- helpers ---------- */
  const fmtTime = (dt) =>
    dt ? new Date(dt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-";
  const fmtDate = (dt) => (dt ? new Date(dt).toLocaleDateString("th-TH") : "-");

  const computeStatus = (clockIn) => {
    if (!clockIn) return "-";
    const t = new Date(clockIn);
    const late = t.getHours() > 8 || (t.getHours() === 8 && t.getMinutes() > 30);
    return late ? "สาย" : "ปกติ";
  };

  // เปรียบวันตามเวลาท้องถิ่น
  function isSameLocalDay(a, b) {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  // ขอพิกัดจาก browser (ถ้าไม่ได้สิทธิ์จะคืน null)
  function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          resolve({ lat: latitude, lng: longitude, accuracy });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // wrapper fetch (ต้องส่ง body)
  async function callAttendance(action, payload = {}) {
    const res = await fetch(`/api/employee/attendance/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg =
        typeof data === "string"
          ? data.replace(/<[^>]*>/g, "").trim() || res.statusText
          : data.message || data.error || res.statusText;
      throw new Error(msg);
    }
    return data;
  }

  /* ---------- load & clock ---------- */
  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await employeeApi.attendance.list();
      setRows(Array.isArray(data) ? data : data?.items || data?.data || []);
    } catch (e) {
      setErr(e?.message || "โหลดประวัติไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    load();
  }, []);

  // นาฬิกาปัจจุบัน
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function submit(action) {
    if (sending) return;
    setSending(action);
    setErr("");
    try {
      const geo = await getLocation(); // อาจเป็น null ได้
      await callAttendance(action === "in" ? "clock-in" : "clock-out", geo || {});
      await load(); // refresh list
    } catch (e) {
      setErr(e?.message || "บันทึกเวลาไม่สำเร็จ");
    } finally {
      setSending(null);
    }
  }

  /* ---------- “รายการวันนี้” + โฟกัสแผนที่ ---------- */
  // กรองเฉพาะรายการที่เป็น "วันนี้" แล้วเอาเวลาใหม่สุด
  const todayEntry = useMemo(() => {
    if (!rows.length) return null;
    const todays = rows.filter((r) => isSameLocalDay(r.clock_in || r.created_at, now));
    if (!todays.length) return null;
    todays.sort(
      (a, b) =>
        new Date(b.clock_in || b.created_at || 0) - new Date(a.clock_in || a.created_at || 0)
    );
    return todays[0];
  }, [rows, now]);

  // ถ้าในวันนี้มีพิกัดเฉพาะ "ออกงาน" ให้สลับแท็บ map ไปที่ out อัตโนมัติ (และกลับกัน)
  useEffect(() => {
    if (!todayEntry) return;
    const hasIn =
      todayEntry.clock_in_lat != null && todayEntry.clock_in_lng != null;
    const hasOut =
      todayEntry.clock_out_lat != null && todayEntry.clock_out_lng != null;

    if (!hasIn && hasOut && mapType !== "out") setMapType("out");
    if (hasIn && !hasOut && mapType !== "in") setMapType("in");
  }, [todayEntry, mapType]);

  // เลื่อนจอให้ “แถวของวันนี้” อยู่กลางจอ
  useEffect(() => {
    if (todayRowRef.current) {
      todayRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [todayEntry, rows.length]);

  // จุดสำหรับแผนที่ (ของวันนี้)
  const point = useMemo(() => {
    if (!todayEntry) return null;
    const lat = mapType === "in" ? todayEntry.clock_in_lat : todayEntry.clock_out_lat;
    const lng = mapType === "in" ? todayEntry.clock_in_lng : todayEntry.clock_out_lng;
    if (lat == null || lng == null) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }, [todayEntry, mapType]);

  const mapUrl = point
    ? `https://www.google.com/maps?q=${point.lat},${point.lng}&z=17&output=embed`
    : null;
  const mapLink = point
    ? `https://www.google.com/maps?q=${point.lat},${point.lng}&z=18`
    : null;

  async function copyCoord() {
    if (!point || !navigator.clipboard) return;
    await navigator.clipboard.writeText(`${point.lat}, ${point.lng}`);
  }

  /* ---------- UI ---------- */
  return (
    <div className="fade-in">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">การเข้าออกงาน</h2>
            <p className="text-gray-600">ประวัติการเข้าออกงานของคุณ</p>
          </div>
          <div className="text-right">
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
              <i className="fas fa-clock mr-2" />
              <span className="font-semibold">เวลาปัจจุบัน: {now.toLocaleTimeString("th-TH")}</span>
            </div>
          </div>
        </div>

        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}

        {/* ปุ่มเข้างาน / ออกงาน */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => submit("in")}
            disabled={sending === "in"}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg
                       hover:from-green-600 hover:to-green-700 transform hover:scale-105 transition
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="fas fa-sign-in-alt text-3xl mb-2" />
            <p className="text-lg font-semibold">
              {sending === "in" ? "กำลังบันทึก..." : "เข้างาน"}
            </p>
            <p className="text-sm opacity-90">กดเพื่อบันทึกเวลาเข้างาน</p>
          </button>

          <button
            onClick={() => submit("out")}
            disabled={sending === "out"}
            className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-lg
                       hover:from-red-600 hover:to-red-700 transform hover:scale-105 transition
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="fas fa-sign-out-alt text-3xl mb-2" />
            <p className="text-lg font-semibold">
              {sending === "out" ? "กำลังบันทึก..." : "ออกงาน"}
            </p>
            <p className="text-sm opacity-90">กดเพื่อบันทึกเวลาออกงาน</p>
          </button>
        </div>

        {/* ตารางแสดงประวัติการเข้างาน */}
        <div className="overflow-x-auto">
          {loading ? (
            <p>กำลังโหลด...</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">วันที่</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">เข้างาน</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">ออกงาน</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isToday = isSameLocalDay(r.clock_in || r.created_at, now);
                  return (
                    <tr
                      key={r.id}
                      ref={isToday ? todayRowRef : undefined}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        isToday ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span>{fmtDate(r.clock_in || r.created_at)}</span>
                          {isToday && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                              วันนี้
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            {fmtTime(r.clock_in)}
                          </span>
                          {r.clock_in_lat != null && r.clock_in_lng != null && (
                            <span className="text-xs text-gray-500">
                              <i className="fas fa-map-marker-alt mr-1 text-red-400" />
                              {Number(r.clock_in_lat).toFixed(5)}, {Number(r.clock_in_lng).toFixed(5)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {fmtTime(r.clock_out)}
                          </span>
                          {r.clock_out_lat != null && r.clock_out_lng != null && (
                            <span className="text-xs text-gray-500">
                              <i className="fas fa-map-marker-alt mr-1 text-red-400" />
                              {Number(r.clock_out_lat).toFixed(5)}, {Number(r.clock_out_lng).toFixed(5)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            computeStatus(r.clock_in) === "ปกติ"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {computeStatus(r.clock_in)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!rows.length && (
                  <tr>
                    <td className="py-6 px-4 text-center text-gray-500" colSpan={4}>
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ---------- แผนที่ + พิกัด (โฟกัส "วันนี้") ---------- */}
        <div className="mt-8 bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">
              แผนที่ตำแหน่ง{mapType === "in" ? "เข้างาน" : "ออกงาน"} (วันนี้)
            </h3>
            <div className="inline-flex rounded-lg overflow-hidden border">
              <button
                className={`px-3 py-1 text-sm ${
                  mapType === "in" ? "bg-green-600 text-white" : "bg-white text-gray-700"
                }`}
                onClick={() => setMapType("in")}
              >
                จุดเข้างาน
              </button>
              <button
                className={`px-3 py-1 text-sm border-l ${
                  mapType === "out" ? "bg-blue-600 text-white" : "bg-white text-gray-700"
                }`}
                onClick={() => setMapType("out")}
              >
                จุดออกงาน
              </button>
            </div>
          </div>

          {!todayEntry ? (
            <p className="text-gray-500">
              ยังไม่มีบันทึกของวันนี้
              <br />
              <span className="text-xs">* กดปุ่มเข้างาน/ออกงาน และอนุญาตการเข้าถึงตำแหน่งเพื่อบันทึกพิกัด</span>
            </p>
          ) : !point ? (
            <p className="text-gray-500">
              วันนี้ยังไม่พบพิกัดของจุด{mapType === "in" ? "เข้างาน" : "ออกงาน"}
              <br />
              <span className="text-xs">* กรุณาอนุญาตการเข้าถึงตำแหน่งตอนกดบันทึกเวลา</span>
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-700">
                  พิกัด:{" "}
                  <span className="font-mono">
                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyCoord}
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    title="คัดลอกพิกัด"
                  >
                    คัดลอกพิกัด
                  </button>
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    title="เปิดในแผนที่"
                  >
                    เปิดในแผนที่
                  </a>
                </div>
              </div>
              <div className="w-full rounded-lg overflow-hidden border">
                <iframe
                  title="attendance-location-map"
                  src={mapUrl}
                  style={{ width: "100%", height: 360, border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </>
          )}
        </div>
        {/* ---------- /แผนที่ ---------- */}
      </div>
    </div>
  );
}
