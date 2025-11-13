import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import { auth } from "@/data/auth";

export default function LoginPage({ onLoggedIn }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async ({ username, password, type }) => {
    try {
      setLoading(true);
      setErr("");
      const { user } = await auth.login({ username, password });
      // ส่ง role/user กลับไปให้ App ตัดสินใจ route / layout ต่อ
      onLoggedIn?.(user.role || type, user);
    } catch {
      setErr("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoginForm onSubmit={handleSubmit} />
      {loading && <p className="text-center mt-2 text-sm">กำลังเข้าสู่ระบบ...</p>}
      {err && <p className="text-center mt-2 text-sm text-red-600">{err}</p>}
    </>
  );
}
