import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.uid, role_id: payload.role_id };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
