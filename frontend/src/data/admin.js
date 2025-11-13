// src/data/admin.js

// ถ้ามี base url จาก .env จะใช้ (เช่น VITE_API_BASE="http://localhost:4000")
// ไม่มีก็เว้นว่างไว้เพื่อให้วิ่งผ่าน Vite proxy /api ได้เลย
const BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";

/** อ่าน response ให้แปลงเป็น JSON ถ้าเป็นไปได้ และโยน error ที่อ่านรู้เรื่อง */
async function http(path, init = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include", // ✅ สำคัญสำหรับ cookie/token
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });

  const text = await res.text(); // อ่านครั้งเดียว
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  // โยงข้อความให้อ่านง่าย กรณี backend ส่งเป็น HTML (เช่น Cannot GET /api/..)
  const plain = typeof data === "string" ? data.replace(/<[^>]*>/g, "").trim() : null;

  if (!res.ok) {
    const fallback =
      res.status === 401 ? "ยังไม่ได้เข้าสู่ระบบ" :
      res.status === 403 ? "คุณไม่มีสิทธิ์เข้าถึง" :
      res.statusText;

    const message =
      (typeof data === "object" && (data.message || data.error)) ||
      plain || fallback;

    const err = new Error(message);
    err.status = res.status;
    err.raw = data;
    throw err;
  }

  // คืนค่าเป็น object เสมอ
  return typeof data === "string" ? { message: plain || data } : data;
}

// ทำให้ list ใช้ได้ทั้ง {items:[]}, {employees:[]}, [] ตรง ๆ
const normalizeList = (obj) => {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object") return [];
  return obj.items || obj.employees || obj.data || [];
};

// map ฟอร์ม → payload สำหรับสร้างพนักงานใหม่
function toEmployeeCreate(input) {
  const emp_code = (input.emp_code || "").trim();
  return {
    full_name: (input.full_name || "").trim(),
    emp_code,
    department: input.department || "IT",
    position_title: input.position_title ?? input.position ?? "",
    start_date: input.start_date || null,
    salary_base: Number(input.salary_base ?? 0),
    // ถ้าไม่ส่ง email จะสร้างจาก emp_code
    email: input.email || (emp_code ? `${emp_code.toLowerCase()}@company.local` : undefined),
    // default password ถ้าไม่ส่งมา
    password: input.password || "User@123",
  };
}

// map patch → payload สำหรับอัปเดต (ส่งเฉพาะฟิลด์ที่แก้)
function toEmployeePatch(patch) {
  const out = {};
  if ("full_name" in patch) out.full_name = (patch.full_name || "").trim();
  if ("emp_code" in patch) out.emp_code = (patch.emp_code || "").trim();
  if ("department" in patch) out.department = patch.department;
  if ("position_title" in patch || "position" in patch) {
    out.position_title = patch.position_title ?? patch.position ?? "";
  }
  if ("start_date" in patch) out.start_date = patch.start_date || null;
  if ("salary_base" in patch) out.salary_base = Number(patch.salary_base ?? 0);
  if ("email" in patch) out.email = patch.email;
  if ("password" in patch) out.password = patch.password;

  // ตัดค่าว่างและ undefined
  Object.keys(out).forEach((k) => (out[k] === "" || out[k] === undefined) && delete out[k]);
  return out;
}

export const adminApi = {
  /* ===================== Employees ===================== */

  /** ดึงรายชื่อพนักงานทั้งหมด (array) */
  async listEmployees(query = {}) {
    const qs = new URLSearchParams(query).toString();
    const data = await http(`/api/admin/users${qs ? `?${qs}` : ""}`);
    return normalizeList(data);
  },

  /** เพิ่มพนักงานใหม่ */
  createEmployee(form) {
    const payload = toEmployeeCreate(form);
    return http("/api/admin/users", { method: "POST", body: JSON.stringify(payload) });
  },

  /** อ่านพนักงานทีละคน */
  getEmployee(id) {
    return http(`/api/admin/users/${id}`);
  },

  /** อัปเดตข้อมูลพนักงานแบบ partial */
  updateEmployee(id, patch) {
    const payload = toEmployeePatch(patch);
    return http(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  /** เปลี่ยนสถานะใช้งานของ user: 'active' | 'inactive' */
  setUserStatus(id, status) {
    return http(`/api/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  /** ลบพนักงาน */
  deleteEmployee(id) {
    return http(`/api/admin/users/${id}`, { method: "DELETE" });
  },

  /* ===================== Leave ===================== */

  /** คำขอลา */
  listLeaveRequests() {
    return http("/api/admin/leave/requests");
  },
  approveLeave(id) {
    return http(`/api/admin/leave/${id}/approve`, { method: "POST" });
  },
  rejectLeave(id) {
    return http(`/api/admin/leave/${id}/reject`, { method: "POST" });
  },

  /* ===================== Attendance (สำหรับ TimeTracking) ===================== */
  attendance: {
    /** ช่วงวันที่: พยายามเรียก /range ก่อน ถ้าไม่มีค่อย fallback ไป /attendance */
    async range(from, to) {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      try {
        const r = await http(`/api/admin/attendance/range${qs}`);
        return normalizeList(r);
      } catch (e) {
        // ถ้า 404/501 ให้ลอง endpoint สำรอง
        try {
          const r2 = await http(`/api/admin/attendance${qs}`);
          return normalizeList(r2);
        } catch {
          throw e;
        }
      }
    },
    /** list แบบอิสระ (รองรับจาก backend ถ้ามี) */
    async list(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const r = await http(`/api/admin/attendance${qs ? `?${qs}` : ""}`);
      return normalizeList(r);
    },
  },

  /* ===================== Payroll ===================== */
  payroll: {
    /** รายการเงินเดือนของเดือนนั้น */
    async list(month_year /* 'YYYY-MM' */) {
      return http(`/api/admin/payroll?month_year=${encodeURIComponent(month_year)}`);
    },

    /** ค่าสรุปของเดือนนั้น { total, paid, pending, avg } */
    async stats(month_year) {
      return http(`/api/admin/payroll/stats?month_year=${encodeURIComponent(month_year)}`);
    },

    /** สร้าง/อัปเดตเอนทรีเงินเดือนของเดือนนั้นทั้งหมด แล้วคืน list */
    async generate(month_year) {
      return http(`/api/admin/payroll/generate`, {
        method: "POST",
        body: JSON.stringify({ month_year }),
      });
    },

    /** อัปเดตรายการเงินเดือนรายคน (เช่น bonus/deduction/status) */
    async update(id, payload) {
      return http(`/api/admin/payroll/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },

    /** มาร์คจ่ายแล้ว */
    async pay(id) {
      return http(`/api/admin/payroll/${id}/pay`, { method: "POST" });
    },
  },

  // ❗️คงเมธอดเก่าไว้เป็น alias เพื่อไม่ให้โค้ดเดิมพัง
  generatePayroll(month_year) {
    return this.payroll.generate(month_year);
  },
};

export default adminApi;
