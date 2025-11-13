// src/data/employees.js
// ใช้งาน API จริง + ใส่ wrappers ให้เรียกชื่อเดิมได้ (requestLeave/listLeaves)

const BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";
const EMP_BASE = "/api/employee";
const ADMIN_BASE = "/api/admin";

/* ---------- fetch helper ---------- */
async function http(path, init = {}) {
  const url = `${BASE}${path}`;
  const headers = {
    ...(init.body && !(init.headers || {})["Content-Type"]
      ? { "Content-Type": "application/json" }
      : {}),
    ...(init.headers || {}),
  };

  const res = await fetch(url, {
    credentials: "include",
    headers,
    ...init,
  });

  if (res.status === 204 || res.status === 205) return {};

  const ct = res.headers.get("content-type") || "";
  let data;
  try {
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = text; }
    }
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const msg =
      typeof data === "string"
        ? data.replace(/<[^>]*>/g, "").trim() || res.statusText
        : (data && (data.message || data.error)) || res.statusText;
    throw new Error(msg);
  }

  return data ?? {};
}

/* ---------- normalizers ---------- */
function normalizeProfileCard(p) {
  return {
    name: p.full_name ?? p.name ?? "",
    position: p.position_title ?? p.position ?? "",
    department: p.department ?? "",
    employeeId: p.emp_code ?? p.employeeId ?? "",
    salary: Number(p.salary_base ?? p.salary ?? 0),
    avatar:
      p.avatar_url ||
      `https://via.placeholder.com/100x100/4F46E5/FFFFFF?text=${encodeURIComponent(
        (p.full_name || p.name || "U").slice(0, 2)
      )}`,
    raw: p,
  };
}

function normalizeEmployeesList(arr) {
  return (arr || []).map((r) => ({
    id: r.id ?? r.user_id ?? r._id,
    name: r.full_name ?? r.name,
    position: r.position_title ?? r.position ?? "",
    department: r.department ?? "",
    salary: Number(r.salary_base ?? r.salary ?? 0),
    status: r.status ?? "active",
  }));
}

const normalizeList = (obj) =>
  Array.isArray(obj) ? obj : obj?.items || obj?.data || obj?.slips || [];

/* ================================
 * Employee Portal API
 * ================================ */
export const employeeApi = {
  // โปรไฟล์ของฉัน
  async me() {
    // เผื่อบางระบบห่อใน {profile: {...}}
    const data = await http(`${EMP_BASE}/me`);
    return data.profile ?? data;
  },

  updateMe(payload) {
    return http(`${EMP_BASE}/me`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // เวลาเข้า–ออกงาน
  attendance: {
    list(params) {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return http(`${EMP_BASE}/attendance${qs}`);
    },
    clockIn()  { return http(`${EMP_BASE}/attendance/clock-in`,  { method: "POST" }); },
    clockOut() { return http(`${EMP_BASE}/attendance/clock-out`, { method: "POST" }); },
  },

  // การลา
  leave: {
    list() {
      return http(`${EMP_BASE}/leave`);
    },
    create(payload) {
      return http(`${EMP_BASE}/leave`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },
};

/* ---------- payroll ฟังก์ชัน + alias .list ---------- */
// ทำเป็นฟังก์ชัน (เรียกแบบ employeeApi.payroll()) และผูก .list ไว้ด้วย
const payrollFn = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const suffix = qs ? `?${qs}` : "";

  const candidates = [
    `${EMP_BASE}/payroll${suffix}`,
    `/api/payroll/me${suffix}`,
    `${EMP_BASE}/salary/slips${suffix}`,
    `${EMP_BASE}/slips${suffix}`,
  ];

  for (const p of candidates) {
    try {
      const data = await http(p);
      const list = normalizeList(data);
      if (Array.isArray(list)) return list;
    } catch {
      // try next
    }
  }
  return [];
};

// optional: stats ของฉัน ถ้า backend มี
payrollFn.stats = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const tries = [
    `${EMP_BASE}/payroll/stats${qs ? `?${qs}` : ""}`,
    `/api/payroll/me/stats${qs ? `?${qs}` : ""}`,
  ];
  for (const p of tries) {
    try { return await http(p); } catch {;}
  }
  return null;
};

// ให้เรียกได้ทั้ง employeeApi.payroll() และ employeeApi.payroll.list()
employeeApi.payroll = payrollFn;
employeeApi.payroll.list = payrollFn;

/* ----- Wrappers (ชื่อเดิม ให้โค้ดเก่าใช้ต่อได้) ----- */
employeeApi.listAttendance = (params) => employeeApi.attendance.list(params);
employeeApi.clockIn  = () => employeeApi.attendance.clockIn();
employeeApi.clockOut = () => employeeApi.attendance.clockOut();

employeeApi.listLeaves   = () => employeeApi.leave.list();
employeeApi.requestLeave = (payload) => employeeApi.leave.create(payload);

employeeApi.listPayroll = (params) => employeeApi.payroll(params);

/* ================================
 * Admin API (อนุมัติ/ปฏิเสธคำขอลา + รายชื่อผู้ใช้)
 * ================================ */
export const adminApi = {
  users: {
    list() {
      return http(`${ADMIN_BASE}/users`);
    },
  },
  leave: {
    list() {
      return http(`${ADMIN_BASE}/leave/requests`);
    },
    approve(id) {
      return http(`${ADMIN_BASE}/leave/${id}/approve`, { method: "POST" });
    },
    reject(id) {
      return http(`${ADMIN_BASE}/leave/${id}/reject`, { method: "POST" });
    },
  },
};

/* ================================
 * Adapters สำหรับโค้ดเดิม
 * ================================ */
export async function getMyProfileCard() {
  const p = await employeeApi.me();
  return normalizeProfileCard(p);
}

export async function getEmployeesList() {
  const data = await adminApi.users.list();
  const arr = normalizeList(data);
  return normalizeEmployeesList(arr);
}

export async function fetchEmployeesForAdmin() {
  return getEmployeesList();
}
