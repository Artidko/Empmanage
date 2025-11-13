import React, { useState } from "react";
import LoginForm from "./components/LoginForm";
import MainLayout from "./layouts/MainLayout";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState("user");
  const [activeMenu, setActiveMenu] = useState("profile");
  const [authError, setAuthError] = useState("");

  // ยิงไปหลังบ้าน (ผ่าน Vite proxy -> http://localhost:4000)
  async function loginWithApi({ identifier, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    // ✅ ส่งทั้งสองฟิลด์ไว้เลย (หลังบ้านจะเลือกใช้เอง)
    body: JSON.stringify({ email: identifier, username: identifier, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { token?, user }
}


  async function logoutApi() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (_) {}
  }

  const handleSubmitLogin = async ({ username, password, type }) => {
  setAuthError("");
  try {
    const { user } = await loginWithApi({ identifier: username, password });

    // รองรับทั้ง role(string) และ role_id(number)
    const resolvedRole =
      user?.role ?? (user?.role_id === 1 ? "admin" : "user") ?? type ?? "user";

    setIsLoggedIn(true);
    setUserType(resolvedRole === "admin" ? "admin" : "user");
    setActiveMenu(resolvedRole === "admin" ? "dashboard" : "profile");
  } catch (e) {
    setAuthError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
};

  // fallback: ถ้า LoginForm เก่ายังเรียก onLogin(type)
  const handleLoginLegacy = (type) => {
    setIsLoggedIn(true);
    setUserType(type);
    setActiveMenu(type === "admin" ? "dashboard" : "profile");
  };

  const handleLogout = async () => {
    await logoutApi();
    setIsLoggedIn(false);
    setUserType("user");
    setActiveMenu("profile");
    setAuthError("");
  };

  return (
    <div className="min-h-screen">
      {!isLoggedIn ? (
        <>
          <LoginForm onSubmit={handleSubmitLogin} onLogin={handleLoginLegacy} />
          {authError && (
            <p className="text-center text-sm text-red-600 mt-2">{authError}</p>
          )}
        </>
      ) : (
        <MainLayout
          userType={userType}
          activeMenu={activeMenu}
          onMenuClick={setActiveMenu}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
