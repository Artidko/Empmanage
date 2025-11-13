// src/pages/user/UserDocuments.jsx
import React, { useEffect, useMemo, useState } from "react";

/** ปรับ base ได้ผ่าน .env → VITE_USER_DOCS_BASE (เช่น /api/user/documents) */
const DOCS_BASE = import.meta.env?.VITE_USER_DOCS_BASE || "/api/user/documents";

/* ---------------- Helpers ---------------- */
const pick = (o, keys, d = undefined) => { for (const k of keys) if (o && o[k] != null) return o[k]; return d; };
const toThaiDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
};
const normType = (s) => {
  const t = String(s || "").toLowerCase();
  if (t.includes("contract") || t.includes("สัญญ")) return "employment_contract";
  if (t.includes("salary") || t.includes("certificate") || t.includes("เงินเดือน") || t.includes("ใบรับรอง"))
    return "salary_certificate";
  return "other";
};
const normalizeDoc = (r) => ({
  id: String(r.id ?? r._id ?? r.doc_id ?? r.document_id ?? ""),
  type: normType(pick(r, ["type", "doc_type", "category", "kind"], "other")),
  title:
    pick(r, ["title", "name", "display_name"]) ||
    (normType(r.type) === "employment_contract" ? "สัญญาจ้างงาน" :
     normType(r.type) === "salary_certificate" ? "ใบรับรองเงินเดือน" : "เอกสาร"),
  signedAt: pick(r, ["signed_at", "sign_date", "start_date", "issue_date", "issued_at"]),
  expiresAt: pick(r, ["expires_at", "expiry_date", "end_date"]),
  updatedAt: pick(r, ["updated_at", "updatedAt", "modified_at"]),
  url: pick(r, ["file_url", "url", "download_url", "downloadUrl", "public_url"]) || null,
  status: String(pick(r, ["status", "state"], "ready")).toLowerCase(),
  raw: r,
});

/* ---------------- Upload settings ---------------- */
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.zip,.heic";
const MAX_SIZE_MB = 25;

/* ============================================================
 *                        Main Component
 * ============================================================ */
export default function UserDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  /* --------- fetchers --------- */
  async function fetchDocuments() {
    const urls = [
      `${DOCS_BASE}`,                           // /api/user/documents
      `/api/employee/documents`,               // อีกชื่อที่พบบ่อย
      `/api/documents?owner=self`,             // generic
      `/api/user/files?type=document`,         // บางระบบแยก files
    ];
    for (const u of urls) {
      try {
        const res = await fetch(u, { credentials: "include" });
        if (!res.ok) continue;
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : data?.items || data?.data || [];
        if (arr.length) return arr;
      } catch {;}
    }
    return [];
  }

  async function getDownloadUrl(d) {
    if (d.url) return d.url;
    const tries = [
      `${DOCS_BASE}/${d.id}/download`,
      `/api/employee/documents/${d.id}/download`,
      `/api/documents/${d.id}/download`,
    ];
    for (const u of tries) {
      try {
        const r = await fetch(u, { credentials: "include" });
        if (!r.ok) continue;
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await r.json();
          const url = j?.url || j?.download_url || j?.file_url;
          if (url) return url;
        } else {
          const blob = await r.blob();
          return URL.createObjectURL(blob);
        }
      } catch {;}
    }
    return null;
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const raw = await fetchDocuments();
      const normalized = raw.map(normalizeDoc).sort((a, b) => {
        const order = { employment_contract: 0, salary_certificate: 1, other: 2 };
        return (order[a.type] ?? 99) - (order[b.type] ?? 99);
      });
      setDocs(normalized);
    } catch (e) {
      setErr(e?.message || "โหลดเอกสารไม่สำเร็จ");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const contractDoc = useMemo(() => docs.find(d => d.type === "employment_contract"), [docs]);
  const salaryDoc   = useMemo(() => docs.find(d => d.type === "salary_certificate"), [docs]);

  return (
    <div className="fade-in">
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Header แบบในภาพ */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#054A91] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-file-contract text-3xl text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">เอกสารสัญญา</h2>
          <p className="text-gray-600">ดูและจัดการเอกสารสัญญาการทำงาน</p>
        </div>

        {err && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">{err}</div>}

        {/* สองการ์ดบน (ตามภาพ) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <DocCard
            theme="blue"
            heading="สัญญาจ้างงาน"
            sub1={`ลงนาม: ${toThaiDate(contractDoc?.signedAt)}`}
            sub2={`หมดอายุ: ${toThaiDate(contractDoc?.expiresAt)}`}
            icon="fa-file-signature"
            disabled={!contractDoc && !loading}
            onDownload={async () => {
              if (!contractDoc) return;
              const u = await getDownloadUrl(contractDoc);
              if (!u) return alert("ไม่พบลิงก์ดาวน์โหลด");
              const a = document.createElement("a");
              a.href = u; a.target = "_blank"; a.rel = "noopener"; a.click();
            }}
          />

          <DocCard
            theme="green"
            heading="ใบรับรองเงินเดือน"
            sub1={`อัพเดท: ${toThaiDate(salaryDoc?.updatedAt)}`}
            sub2={`สถานะ: ${salaryDoc ? (salaryDoc.status === "ready" ? "ใช้งานได้" : salaryDoc.status) : "-"}`}
            icon="fa-certificate"
            disabled={!salaryDoc && !loading}
            onDownload={async () => {
              if (!salaryDoc) return;
              const u = await getDownloadUrl(salaryDoc);
              if (!u) return alert("ไม่พบลิงก์ดาวน์โหลด");
              const a = document.createElement("a");
              a.href = u; a.target = "_blank"; a.rel = "noopener"; a.click();
            }}
          />
        </div>

        {/* แถบสีเหลือง + ปุ่มตามภาพ */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <h4 className="font-semibold text-gray-700 mb-1">ฟีเจอร์กำลังพัฒนา</h4>
          <p className="text-sm text-gray-600 mb-4">ระบบอัพโหลดเอกสาร, การขอเอกสารใหม่, และการติดตามสถานะ</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 bg-[#054A91] text-white font-semibold px-4 py-2 rounded-lg shadow"
            >
              <i className="fas fa-upload" /> อัพโหลดเอกสาร
            </button>
            <button
              onClick={() => setRequestOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg shadow hover:bg-indigo-700"
            >
              <i className="fas fa-file-circle-plus" /> ขอเอกสารใหม่
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={async () => { setUploadOpen(false); await load(); }}
        />
      )}

      {/* Request Modal */}
      {requestOpen && (
        <RequestModal
          onClose={() => setRequestOpen(false)}
          onRequested={() => setRequestOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
 *                         Subcomponents
 * ============================================================ */

function DocCard({ theme = "blue", heading, sub1, sub2, icon, onDownload, disabled }) {
  const themeMap = {
    blue:  { box: "bg-blue-50 border-l-4 border-blue-500",  icon: "text-blue-300"  },
    green: { box: "bg-green-50 border-l-4 border-green-500", icon: "text-green-300" },
  };
  const t = themeMap[theme] || themeMap.blue;
  return (
    <div className={`${t.box} p-6 rounded-lg`}>
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h3 className="font-semibold text-gray-700 mb-2">{heading}</h3>
          <p className="text-sm text-gray-500">{sub1}</p>
          <p className="text-sm text-gray-500">{sub2}</p>
        </div>
        <i className={`fas ${icon} text-3xl ${t.icon}`} />
      </div>
      <button
        onClick={onDownload}
        disabled={disabled}
        className="mt-4 w-full bg-[#0b3b74] text-white font-semibold px-4 py-2 rounded-lg shadow disabled:opacity-50"
      >
        <i className="fas fa-download mr-2" />
        ดาวน์โหลด
      </button>
    </div>
  );
}

/* ---------------- Upload Modal ---------------- */
function UploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [dtype, setDtype] = useState("employment_contract");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const validateFile = (f) => {
    if (!f) return "กรุณาเลือกไฟล์";
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_SIZE_MB) return `ไฟล์ใหญ่เกินไป (จำกัด ${MAX_SIZE_MB} MB)`;
    return "";
  };

  async function uploadDocument(f, meta) {
    // (1) multipart/form-data เป็นหลัก
    const form = new FormData();
    form.append("file", f);
    form.append("filename", f.name);
    form.append("content_type", f.type || "application/octet-stream");
    form.append("title", meta.title || f.name);
    form.append("type", meta.type || "other");

    const endpoints = [
      `${DOCS_BASE}`,
      `/api/employee/documents`,
      `/api/documents`,
    ];
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { method: "POST", body: form, credentials: "include" });
        if (!r.ok) continue;
        const j = await r.json().catch(() => ({}));
        if (j && (j.id || j._id || j.doc_id || j.document_id || j.url || j.file_url)) return j;
      } catch {;}
    }

    // (2) presigned: init → upload → complete
    const inits = [
      `${DOCS_BASE}/init`,
      `/api/employee/documents/init`,
      `/api/documents/init`,
    ];
    for (const url of inits) {
      try {
        const initRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filename: f.name,
            contentType: f.type || "application/octet-stream",
            title: meta.title || f.name,
            type: meta.type || "other",
          }),
        });
        if (!initRes.ok) continue;
        const init = await initRes.json();
        const uploadUrl = init.upload_url || init.url;
        const fields = init.fields;
        const method = (init.method || "PUT").toUpperCase();
        const docId = init.id || init.document_id || init.doc_id;

        if (!uploadUrl) continue;

        if (fields && typeof fields === "object") {
          const fd = new FormData();
          Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
          fd.append("file", f);
          const up = await fetch(uploadUrl, { method: "POST", body: fd });
          if (!up.ok) continue;
        } else {
          const up = await fetch(uploadUrl, { method, headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
          if (!up.ok) continue;
        }

        const finals = [
          init.finalize_url,
          docId && `${DOCS_BASE}/${docId}/complete`,
          docId && `/api/employee/documents/${docId}/complete`,
          docId && `/api/documents/${docId}/complete`,
        ].filter(Boolean);

        for (const fu of finals) {
          try {
            const fin = await fetch(fu, { method: "POST", credentials: "include" });
            if (!fin.ok) continue;
            return await fin.json().catch(() => ({}));
          } catch {;}
        }
      } catch {;}
    }
    throw new Error("อัปโหลดไม่สำเร็จ (ไม่พบ endpoint ที่รองรับ)");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const msg = validateFile(file);
    if (msg) return setErr(msg);
    setBusy(true);
    try {
      await uploadDocument(file, { title: title || file.name, type: dtype });
      await onUploaded();
    } catch (e2) {
      setErr(e2?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl rounded-xl shadow-xl p-6">
        <h4 className="text-lg font-semibold mb-4">อัพโหลดเอกสาร</h4>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="file" accept={ACCEPT} onChange={(e)=>setFile(e.target.files?.[0] || null)} className="block w-full" />
          <input type="text" className="border rounded-lg px-3 py-2 w-full" placeholder="ชื่อเอกสาร (ไม่ระบุก็ใช้ชื่อไฟล์)"
                 value={title} onChange={(e)=>setTitle(e.target.value)} />
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">ประเภท</label>
            <select value={dtype} onChange={(e)=>setDtype(e.target.value)} className="border rounded-lg px-3 py-2">
              <option value="employment_contract">สัญญาจ้างงาน</option>
              <option value="salary_certificate">ใบรับรองเงินเดือน</option>
              <option value="other">อื่น ๆ</option>
            </select>
          </div>

          {err && <p className="text-sm text-rose-700">{err}</p>}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" disabled={busy || !file}
                    className="px-4 py-2 rounded-lg bg-[#054A91] text-white disabled:opacity-60">
              {busy ? "กำลังอัปโหลด…" : "อัปโหลด"}
            </button>
          </div>
          <p className="text-xs text-gray-500">รองรับ: pdf, png, jpg/jpeg, webp, heic, doc/docx, xls/xlsx, zip • สูงสุด {MAX_SIZE_MB} MB</p>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Request Modal ---------------- */
function RequestModal({ onClose, onRequested }) {
  const [dtype, setDtype] = useState("salary_certificate");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function createRequest(type, note) {
    const payload = { type, note };
    const endpoints = [
      `${DOCS_BASE}/requests`,
      `/api/employee/documents/requests`,
      `/api/documents/requests`,
    ];
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) return await r.json().catch(()=> ({}));
      } catch {;}
    }
    throw new Error("ไม่สามารถส่งคำขอเอกสารได้");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await createRequest(dtype, note);
      onRequested();
      alert("ส่งคำขอเรียบร้อย");
    } catch (e2) {
      setErr(e2?.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl rounded-xl shadow-xl p-6">
        <h4 className="text-lg font-semibold mb-4">ขอเอกสารใหม่</h4>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">ประเภท</label>
            <select value={dtype} onChange={(e)=>setDtype(e.target.value)} className="border rounded-lg px-3 py-2">
              <option value="salary_certificate">ใบรับรองเงินเดือน</option>
              <option value="employment_contract">สัญญาจ้างงาน</option>
              <option value="other">อื่น ๆ</option>
            </select>
          </div>
          <textarea className="border rounded-lg px-3 py-2 w-full min-h-[100px]"
                    placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" value={note} onChange={(e)=>setNote(e.target.value)} />
          {err && <p className="text-sm text-rose-700">{err}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
              {busy ? "กำลังส่ง…" : "ส่งคำขอ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
