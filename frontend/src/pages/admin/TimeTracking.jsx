// src/pages/admin/TimeTracking.jsx
import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../data/admin";

/* ---------- time/format utils ---------- */
const toHM = (ts) => {
  if (!ts && ts !== 0) return "";
  const s = String(ts);
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const t = s.split(" ")[1] || "";
    return t.slice(0, 5);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }
  try {
    const d = new Date(s);
    if (!isNaN(d)) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  } catch {;}
  return "";
};
const toMin = (hhmm) => { if (!hhmm) return null; const [h,m]=String(hhmm).split(":").map(Number); return h*60+m; };
const num = (v,d=0)=> (v==null||isNaN(+v)?d:+v);
const pick = (o,keys)=>{ for(const k of keys) if(o?.[k]!=null) return o[k]; };
const fmtDateTH = (d)=> new Date(d).toLocaleDateString("th-TH",{weekday:"short",day:"2-digit",month:"2-digit"});
const yyyy_mm_dd = (d)=>{ const dt=new Date(d); const m=String(dt.getMonth()+1).padStart(2,"0"); const dy=String(dt.getDate()).padStart(2,"0"); return `${dt.getFullYear()}-${m}-${dy}`; };
const addDays=(d,n)=>{const t=new Date(d); t.setDate(t.getDate()+n); return t;};
const dateOnly=(s)=>{ if(!s) return null; const str=String(s); if(str.includes("T"))return str.slice(0,10); if(str.includes(" "))return str.slice(0,10); if(/^\d{4}-\d{2}-\d{2}$/.test(str))return str; return yyyy_mm_dd(str); };

export default function TimeTracking(){
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");

  const today=useMemo(()=>new Date(),[]);
  const [rangeStart,setRangeStart]=useState(addDays(today,-6));
  const [rangeEnd,setRangeEnd]=useState(today);
  const [activeDate,setActiveDate]=useState(yyyy_mm_dd(today));

  const [employees,setEmployees]=useState([]);
  const [attendanceByDate,setAttendanceByDate]=useState(new Map());
  const [rows,setRows]=useState([]);
  const [summary,setSummary]=useState({onTime:0,late:0,absent:0,avgHours:"0.0"});

  const [sel,setSel]=useState(null);
  const [mapType,setMapType]=useState("in");

  async function fetchAttendanceRange(from,to){
    try{
      if (adminApi?.attendance?.range){
        const r=await adminApi.attendance.range(from,to);
        const arr=Array.isArray(r)?r:r?.items||r?.data||[];
        if(arr.length) return arr;
      }
      if (adminApi?.attendance?.list){
        const r=await adminApi.attendance.list({from,to});
        const arr=Array.isArray(r)?r:r?.items||r?.data||[];
        if(arr.length) return arr;
      }
    }catch{;}
    try{ const r1=await fetch(`/api/admin/attendance/range?from=${from}&to=${to}`,{credentials:"include"}); if(r1.ok) return await r1.json(); }catch{;}
    try{ const r2=await fetch(`/api/admin/attendance?from=${from}&to=${to}`,{credentials:"include"}); if(r2.ok) return await r2.json(); }catch{;}
    return [];
  }

  useEffect(()=>{(async()=>{
    setLoading(true); setErr("");
    try{
      const emp=await adminApi.listEmployees();
      const emps=(Array.isArray(emp)?emp:emp.items||emp.employees||[]).sort((a,b)=>
        String(a.full_name||"").localeCompare(String(b.full_name||""),"th")
      );
      setEmployees(emps);

      const from=yyyy_mm_dd(rangeStart); const to=yyyy_mm_dd(rangeEnd);
      const data=await fetchAttendanceRange(from,to);

      const group=new Map();
      const list=Array.isArray(data)?data:data?.items||data?.data||[];
      for(const a of list){
        const clockInRaw=pick(a,["clock_in","check_in"]);
        const createdRaw=pick(a,["created_at","createdAt"]);
        const dstr=dateOnly(clockInRaw||createdRaw||from)||from;
        const rec={
          userId: a.user_id ?? a.userId ?? a.id,
          checkIn: toHM(clockInRaw),
          checkOut: toHM(pick(a,["clock_out","check_out"])),
          minutes: a.minutes!=null?Number(a.minutes):null,
          inLat: isFinite(num(pick(a,["clock_in_lat","in_lat"]),NaN)) ? num(pick(a,["clock_in_lat","in_lat"])) : null,
          inLng: isFinite(num(pick(a,["clock_in_lng","in_lng"]),NaN)) ? num(pick(a,["clock_in_lng","in_lng"])) : null,
          outLat: isFinite(num(pick(a,["clock_out_lat","out_lat"]),NaN)) ? num(pick(a,["clock_out_lat","out_lat"])) : null,
          outLng: isFinite(num(pick(a,["clock_out_lng","out_lng"]),NaN)) ? num(pick(a,["clock_out_lng","out_lng"])) : null,
        };
        const arr=group.get(dstr)||[]; arr.push(rec); group.set(dstr,arr);
      }
      setAttendanceByDate(group);
    }catch(e){
      setErr(e?.message||"โหลดข้อมูลไม่สำเร็จ"); setAttendanceByDate(new Map());
    }finally{ setLoading(false); }
  })();},[rangeStart,rangeEnd]);

  useEffect(()=>{
    const attList=attendanceByDate.get(activeDate)||[];
    const byUser=new Map(attList.map(a=>[a.userId,a]));
    const final=(employees||[]).map(e=>{
      const a=byUser.get(e.id);
      const empCode = e.emp_code ?? e.employee_code ?? e.code ?? (e.id?`U${e.id}`:null);
      const checkIn=a?.checkIn||"-"; const checkOut=a?.checkOut||"-";
      const hours = a?.minutes!=null ? (Number(a.minutes)/60).toFixed(1) :
                    (a?.checkIn && a?.checkOut) ? ((toMin(a.checkOut)-toMin(a.checkIn))/60).toFixed(1) : "0.0";
      const inMin=toMin(a?.checkIn);
      const status=a ? (inMin!=null && inMin<=toMin("08:30") ? "ปกติ":"สาย") : "ขาด";
      return {
        id:e.id, name:e.full_name, empCode, department:e.department,
        checkIn, checkOut, hours, status,
        inLat:a?.inLat??null, inLng:a?.inLng??null, outLat:a?.outLat??null, outLng:a?.outLng??null
      };
    });
    const onTime=final.filter(r=>r.status==="ปกติ").length;
    const late=final.filter(r=>r.status==="สาย").length;
    const absent=final.filter(r=>r.status==="ขาด").length;
    const avgHours=final.length>0 ? (final.reduce((s,r)=>s+Number(r.hours||0),0)/final.length).toFixed(1) : "0.0";
    setRows(final); setSummary({onTime,late,absent,avgHours});
  },[activeDate,attendanceByDate,employees]);

  const daysInRange = useMemo(()=>{ const arr=[]; let d=new Date(rangeStart); while(d<=rangeEnd){arr.push(yyyy_mm_dd(d)); d=addDays(d,1);} return arr; },[rangeStart,rangeEnd]);

  

  const [mapPoint,setMapPoint] = useState(null);
  useEffect(()=>{ // derive point
    if(!sel){ setMapPoint(null); return; }
    const lat = mapType==="in" ? sel.inLat : sel.outLat;
    const lng = mapType==="in" ? sel.inLng : sel.outLng;
    setMapPoint(lat==null||lng==null ? null : {lat:Number(lat),lng:Number(lng)});
  },[sel,mapType]);

  const mapUrl = mapPoint ? `https://www.google.com/maps?q=${mapPoint.lat},${mapPoint.lng}&z=17&output=embed` : null;
  const mapLink = mapPoint ? `https://www.google.com/maps?q=${mapPoint.lat},${mapPoint.lng}&z=18` : null;

  return (
    <div className="fade-in space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={()=>{ setRangeStart(addDays(rangeStart,-7)); setRangeEnd(addDays(rangeEnd,-7)); setActiveDate(yyyy_mm_dd(addDays(new Date(activeDate),-7))); }}
            className="inline-flex h-10 items-center gap-2 px-3 rounded-lg border bg-white hover:bg-gray-50 active:translate-y-px
                       transition shadow-sm ring-1 ring-gray-100 text-gray-700"
          >
            <i className="fas fa-chevron-left" /> สัปดาห์ก่อน
          </button>
          <button
            onClick={()=>{ const ns=addDays(rangeStart,7); const ne=addDays(rangeEnd,7); const capE=ne>today?today:ne; const capS=ne>today?addDays(today,-6):ns; setRangeStart(capS); setRangeEnd(capE); setActiveDate(yyyy_mm_dd(addDays(new Date(activeDate),7))); }}
            className="inline-flex h-10 items-center gap-2 px-3 rounded-lg border bg-white hover:bg-gray-50 active:translate-y-px
                       transition shadow-sm ring-1 ring-gray-100 text-gray-700"
          >
            สัปดาห์ถัดไป <i className="fas fa-chevron-right" />
          </button>
        </div>

        {/* Date pills */}
        <div className="overflow-x-auto">
          <div className="inline-flex gap-2">
            {daysInRange.map((d)=>(
              <button
                key={d}
                onClick={()=>setActiveDate(d)}
                className={`h-10 px-3 rounded-xl text-sm whitespace-nowrap transition
                ${d===activeDate
                  ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow ring-1 ring-blue-500/30 font-semibold"
                  : "bg-white border hover:bg-gray-50 text-gray-700 ring-1 ring-gray-100"}`}
              >
                {fmtDateTH(d)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{err}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl p-6 text-white bg-green-600 shadow-sm"><p>เข้างานตรงเวลา</p><p className="text-3xl font-bold">{loading?"…":summary.onTime}</p></div>
        <div className="rounded-xl p-6 text-white bg-yellow-500 shadow-sm"><p>เข้างานสาย</p><p className="text-3xl font-bold">{loading?"…":summary.late}</p></div>
        <div className="rounded-xl p-6 text-white bg-red-500 shadow-sm"><p>ขาดงาน</p><p className="text-3xl font-bold">{loading?"…":summary.absent}</p></div>
        <div className="rounded-xl p-6 text-white bg-blue-600 shadow-sm"><p>ชั่วโมงเฉลี่ย</p><p className="text-3xl font-bold">{loading?"…":`${summary.avgHours} ชม./วัน`}</p></div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-bold mb-4">การเข้างาน {fmtDateTH(activeDate)}</h3>
        {loading ? (
          <p>กำลังโหลด...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border-b text-left">พนักงาน</th>
                  <th className="px-4 py-2 border-b text-left">แผนก</th>
                  <th className="px-4 py-2 border-b text-left">เข้างาน</th>
                  <th className="px-4 py-2 border-b text-left">ออกงาน</th>
                  <th className="px-4 py-2 border-b text-left">ชั่วโมง</th>
                  <th className="px-4 py-2 border-b text-left">สถานะ</th>
                  {/* ⬇️ กว้างขั้นต่ำเพื่อกันปุ่มโดนบีบ */}
                  <th className="px-4 py-2 border-b text-right min-w-[10rem]">พิกัด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r)=>(
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2">
                      <div className="font-medium leading-tight">{r.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px] font-mono">
                          <i className="fas fa-id-card-alt" /> ID: {r.empCode ?? "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{r.department}</td>
                    <td className="px-4 py-2 font-mono">{r.checkIn || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 font-mono">{r.checkOut || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 font-mono">{r.hours}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1
                        ${r.status==="ปกติ" ? "bg-green-100 text-green-700" :
                          r.status==="สาย" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-700"}`}>
                        <i className={`fas ${r.status==="ปกติ"?"fa-check-circle": r.status==="สาย"?"fa-clock":"fa-times-circle"}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(r.inLat!=null&&r.inLng!=null)||(r.outLat!=null&&r.outLng!=null) ? (
                        <button
                          onClick={()=>{ setSel(r); setMapType(r.inLat!=null&&r.inLng!=null ? "in" : "out"); }}
                          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg
                                     bg-gradient-to-br from-blue-600 to-indigo-600 text-white
                                     shadow-sm hover:shadow-md hover:from-blue-700 hover:to-indigo-700
                                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300
                                     active:translate-y-px transition whitespace-nowrap"
                          aria-label="ดูพิกัด"
                          title="ดูพิกัด"
                        >
                          <span className="grid h-5 w-5 place-items-center rounded-md bg-white/20">
                            <i className="fas fa-map-marker-alt text-white text-[11px]" />
                          </span>
                          <span className="font-medium">ดูพิกัด</span>
                          <i className="fas fa-chevron-right text-[11px] opacity-80 group-hover:opacity-100" />
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="px-4 py-6 text-center" colSpan={7}>ไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {sel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <div className="text-xl font-semibold tracking-tight">{sel.name}</div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 text-gray-700 px-2 py-0.5">
                    <i className="fas fa-building" /> {sel.department || "-"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 text-gray-700 px-2 py-0.5 font-mono">
                    <i className="fas fa-id-card-alt" /> ID: {sel.empCode ?? "-"}
                  </span>
                </div>
              </div>
              {/* ปุ่มปิดที่ดูโปรขึ้น */}
              <button
                onClick={()=>setSel(null)}
                aria-label="ปิดแผนที่"
                className="size-9 p-0 flex items-center justify-center rounded-full
             border border-gray-200 bg-white text-gray-600
             hover:bg-gray-50 hover:text-gray-800
             active:scale-95 transition shadow-sm"
                title="ปิด"
              >
                <i className="fas fa-times text-base" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  เข้างาน: <b className="font-mono">{sel.checkIn}</b> • ออกงาน: <b className="font-mono">{sel.checkOut}</b>
                </div>

                {/* segmented toggle */}
                <div className="inline-flex rounded-xl overflow-hidden border shadow-sm">
                  <button
                    className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 transition
                      ${mapType==="in" ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    onClick={()=>setMapType("in")}
                    disabled={sel.inLat==null||sel.inLng==null}
                    title={sel.inLat==null?"ไม่มีพิกัดเข้างาน":"จุดเข้างาน"}
                  >
                    <i className="fas fa-sign-in-alt" /> จุดเข้างาน
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 border-l transition
                      ${mapType==="out" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    onClick={()=>setMapType("out")}
                    disabled={sel.outLat==null||sel.outLng==null}
                    title={sel.outLat==null?"ไม่มีพิกัดออกงาน":"จุดออกงาน"}
                  >
                    <i className="fas fa-sign-out-alt" /> จุดออกงาน
                  </button>
                </div>
              </div>

              {mapPoint ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-700">
                      พิกัด: <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono">{mapPoint.lat.toFixed(6)}, {mapPoint.lng.toFixed(6)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async()=>{ if(navigator.clipboard){ await navigator.clipboard.writeText(`${mapPoint.lat}, ${mapPoint.lng}`); } }}
                        className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 ring-1 ring-gray-100"
                      >
                        คัดลอกพิกัด
                      </button>
                      <a
                        href={mapLink} target="_blank" rel="noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 ring-1 ring-gray-100"
                      >
                        เปิดในแผนที่
                      </a>
                    </div>
                  </div>
                  <div className="w-full rounded-lg overflow-hidden border">
                    <iframe
                      title="attendance-employee-map"
                      src={mapUrl}
                      style={{width:"100%",height:360,border:0}}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </>
              ) : (
                <p className="text-gray-500">{mapType==="in"?"ไม่มีพิกัดจุดเข้างาน":"ไม่มีพิกัดจุดออกงาน"}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
