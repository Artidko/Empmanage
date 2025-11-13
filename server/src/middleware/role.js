// server/src/middleware/role.js
export function only(roleName) {
  // map ชื่อ role เป็น role_id ของคุณ
  const map = { admin: 1, employee: 2 };
  const want = map[roleName];

  return (req, res, next) => {
    const rid = req.user?.role_id;
    if (!rid) return res.status(401).json({ message: "Unauthorized" });
    if (want && rid !== want) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
