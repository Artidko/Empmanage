// src/pages/admin/EmployeeManagement.jsx
import React, { useEffect, useRef, useState } from "react";
import { adminApi } from "../../data/admin";

/* ---------- ปุ่ม action สวย ๆ ---------- */
function ActionButton({ kind = "edit", onClick, disabled }) {
  const isDelete = kind === "delete";
  const color = isDelete
    ? "text-rose-700 ring-rose-200 hover:bg-rose-50 hover:ring-rose-300"
    : "text-sky-700  ring-sky-200  hover:bg-sky-50  hover:ring-sky-300";
  const icon = isDelete ? "fa-trash" : "fa-pen";
  const label = isDelete ? "ลบ" : "แก้ไข";
  const title = isDelete ? "ลบพนักงาน" : "แก้ไขข้อมูลพนักงาน";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full ring-1 transition-colors disabled:opacity-50 ${color}`}
    >
      <i className={`fa-solid ${icon}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function EmployeeManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // --- add form ---
  const [form, setForm] = useState({
    full_name: "",
    emp_code: "",
    position_title: "",
    department: "ปฏิบัติการ",            // 🔧 เปลี่ยนค่าเริ่มต้น
    salary_base: "",
    start_date: "",
    email: "",
    password: "User@123",
  });

  // --- edit modal state ---
  const emptyEdit = {
    id: null,
    full_name: "",
    emp_code: "",
    position_title: "",
    department: "ปฏิบัติการ",            // 🔧 เปลี่ยนค่าเริ่มต้น
    salary_base: "",
    start_date: "",
    email: "",
  };
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editErr, setEditErr] = useState("");
  const editFirstInputRef = useRef(null);

  const fmt = (n) => Number(n ?? 0).toLocaleString();

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await adminApi.listEmployees();
      setItems(Array.isArray(data) ? data : data.items || data.employees || []);
    } catch (e) {
      setErr(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // ---------- create ----------
  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setErr("");
    setSaving(true);
    try {
      await adminApi.createEmployee({
        ...form,
        salary_base: Number(form.salary_base || 0),
      });
      await load();
      setForm((f) => ({
        ...f,
        full_name: "", emp_code: "", position_title: "",
        salary_base: "", start_date: "", email: "",
        department: "ปฏิบัติการ",        // 🔧 คืนค่าเริ่มต้น
        password: "User@123",
      }));
    } catch (e) {
      setErr(e?.message || "เพิ่มพนักงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ---------- edit ----------
  function openEdit(emp) {
    const d = emp.start_date ? String(emp.start_date).slice(0, 10) : "";
    setEditForm({
      id: emp.id,
      full_name: emp.full_name || "",
      emp_code: emp.emp_code || "",
      position_title: emp.position_title || emp.position || "",
      department: emp.department || "ปฏิบัติการ",  // 🔧 fallback เดิม
      salary_base: emp.salary_base ?? emp.salary ?? 0,
      start_date: d,
      email: emp.email || "",
    });
    setEditErr("");
    setEditOpen(true);
  }
  function closeEdit() {
    setEditOpen(false);
    setEditForm(emptyEdit);
  }
  async function submitEdit(e) {
    e.preventDefault();
    if (editSaving || !editForm.id) return;
    setEditErr("");
    setEditSaving(true);
    try {
      await adminApi.updateEmployee(editForm.id, {
        full_name: editForm.full_name,
        emp_code: editForm.emp_code,
        position_title: editForm.position_title,
        department: "ปฏิบัติการ",                    // 🔧 บังคับค่าเดียว
        salary_base: Number(editForm.salary_base || 0),
        start_date: editForm.start_date || null,
        email: editForm.email,
      });
      await load();
      closeEdit();
    } catch (e) {
      setEditErr(e?.message || "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setEditSaving(false);
    }
  }

  // lock scroll + focus + Esc เมื่อ modal เปิด
  useEffect(() => {
    if (!editOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => editFirstInputRef.current?.focus(), 0);
    const onKey = (ev) => { if (ev.key === "Escape") closeEdit(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [editOpen]); // ✅ ใส่ dependency ให้ถูกต้อง

  // ---------- delete ----------
  async function handleDelete(emp) {
    if (!window.confirm(`ลบพนักงาน ${emp.full_name || emp.emp_code} ?`)) return;
    try {
      await adminApi.deleteEmployee(emp.id);
      await load();
    } catch (e) {
      alert(e?.message || "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="fade-in space-y-6">
      {/* Add Employee */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            <i className="fas fa-user-plus mr-2 text-blue-500" />
            เพิ่มพนักงานใหม่
          </h2>
          <button
            onClick={load}
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            disabled={loading}
            title="รีโหลดรายชื่อ"
          >
            รีเฟรช
          </button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <input className="border rounded-lg px-4 py-2" placeholder="ชื่อ-นามสกุล"
                 value={form.full_name} onChange={(e)=>setForm(f=>({...f, full_name:e.target.value}))} required />
          <input className="border rounded-lg px-4 py-2" placeholder="รหัสพนักงาน"
                 value={form.emp_code} onChange={(e)=>setForm(f=>({...f, emp_code:e.target.value}))} required />

          <input className="border rounded-lg px-4 py-2" placeholder="ตำแหน่ง"
                 value={form.position_title} onChange={(e)=>setForm(f=>({...f, position_title:e.target.value}))} required />

          {/* 🔧 เหลือตัวเลือกเดียว */}
          <select className="border rounded-lg px-4 py-2"
                  value={form.department}
                  onChange={(e)=>setForm(f=>({...f, department:e.target.value}))}>
            <option>ปฏิบัติการ</option>
          </select>

          <input type="number" className="border rounded-lg px-4 py-2" placeholder="เงินเดือน"
                 value={form.salary_base} onChange={(e)=>setForm(f=>({...f, salary_base:e.target.value}))}
                 min="0" step="100" required />
          <input type="date" className="border rounded-lg px-4 py-2"
                 value={form.start_date} onChange={(e)=>setForm(f=>({...f, start_date:e.target.value}))} required />

          <input type="email" className="border rounded-lg px-4 py-2" placeholder="อีเมล"
                 value={form.email} onChange={(e)=>setForm(f=>({...f, email:e.target.value}))} required />
          <input type="password" className="border rounded-lg px-4 py-2" placeholder="รหัสผ่านเริ่มต้น"
                 value={form.password} onChange={(e)=>setForm(f=>({...f, password:e.target.value}))} required />

          <button type="submit"
                  className="bg-[#054A91] text-white font-semibold px-4 py-2 rounded-lg col-span-1 md:col-span-2 disabled:opacity-60"
                  disabled={saving}>
            {saving ? "กำลังบันทึก..." : "เพิ่มพนักงาน"}
          </button>
        </form>

        {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-bold mb-4">รายชื่อพนักงาน</h3>
        {loading ? (
          <p>กำลังโหลด...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border-b text-left">รหัส</th>
                  <th className="px-4 py-2 border-b text-left">ชื่อ</th>
                  <th className="px-4 py-2 border-b text-left">ตำแหน่ง</th>
                  <th className="px-4 py-2 border-b text-left">แผนก</th>
                  <th className="px-4 py-2 border-b text-left">เงินเดือน</th>
                  <th className="px-4 py-2 border-b text-right w-44">การทำงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((emp) => (
                  <tr key={emp.id}>
                    <td className="px-4 py-2">{emp.emp_code || `EMP00${emp.id}`}</td>
                    <td className="px-4 py-2">{emp.full_name}</td>
                    <td className="px-4 py-2">{emp.position_title || emp.position}</td>
                    <td className="px-4 py-2">{emp.department || "ปฏิบัติการ"}</td>
                    <td className="px-4 py-2">฿{fmt(emp.salary_base ?? emp.salary)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <ActionButton kind="edit" onClick={() => openEdit(emp)} />
                        <ActionButton kind="delete" onClick={() => handleDelete(emp)} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="px-4 py-6 text-center" colSpan={6}>ไม่พบข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeEdit} />
          <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-xl p-6">
            <h4 className="text-lg font-semibold mb-4">แก้ไขข้อมูลพนักงาน</h4>
            <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input ref={editFirstInputRef} className="border rounded-lg px-3 py-2" placeholder="ชื่อ-นามสกุล"
                     value={editForm.full_name} onChange={e=>setEditForm(f=>({...f, full_name:e.target.value}))} required />
              <input className="border rounded-lg px-3 py-2" placeholder="รหัสพนักงาน"
                     value={editForm.emp_code} onChange={e=>setEditForm(f=>({...f, emp_code:e.target.value}))} required />

              <input className="border rounded-lg px-3 py-2" placeholder="ตำแหน่ง"
                     value={editForm.position_title} onChange={e=>setEditForm(f=>({...f, position_title:e.target.value}))} required />

              {/* 🔧 เหลือตัวเลือกเดียว */}
              <select className="border rounded-lg px-3 py-2"
                      value={editForm.department}
                      onChange={e=>setEditForm(f=>({...f, department:e.target.value}))}>
                <option>ปฏิบัติการ</option>
              </select>

              <input type="number" className="border rounded-lg px-3 py-2" placeholder="เงินเดือน"
                     value={editForm.salary_base} min="0" step="100"
                     onChange={e=>setEditForm(f=>({...f, salary_base:e.target.value}))} required />
              <input type="date" className="border rounded-lg px-3 py-2"
                     value={editForm.start_date} onChange={e=>setEditForm(f=>({...f, start_date:e.target.value}))} />

              <input type="email" className="border rounded-lg px-3 py-2" placeholder="อีเมล"
                     value={editForm.email} onChange={e=>setEditForm(f=>({...f, email:e.target.value}))} required />

              <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-3 mt-2">
                <button type="button" onClick={closeEdit}
                        className="px-4 py-2 rounded-lg border hover:bg-gray-50">ยกเลิก</button>
                <button type="submit" disabled={editSaving}
                        className="px-4 py-2 rounded-lg bg-[#054A91] text-white disabled:opacity-60">
                  {editSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
              {editErr && <p className="text-red-600 text-sm mt-2 md:col-span-2">{editErr}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
