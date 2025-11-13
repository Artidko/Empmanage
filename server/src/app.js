// server/src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import adminRoutes from './routes/admin.routes.js';
import commonRoutes from './routes/common.routes.js';
import userDocsRoutes from './routes/user.documents.routes.js';
import payrollSyncRoutes from './routes/payroll.routes.js';

import { requireAuth } from './middleware/auth.js';
import { only } from './middleware/role.js';

const app = express();
const PORT = process.env.PORT || 4000;

/* -------------------------------------------------------
   ✅ CORS — รองรับทั้ง dev (Vite) และ deploy (Render/GitHub Pages)
-------------------------------------------------------- */
const FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "https://artidko.github.io",
  "https://artidko.github.io/Empmanage"
];

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  })
);

/* -------------------------------------------------------
   Parsers
-------------------------------------------------------- */
app.use(express.json());
app.use(cookieParser());

/* -------------------------------------------------------
   Static (uploads)
   - Render: โฟลเดอร์หายทุก deploy, ใช้ได้เฉพาะไฟล์ที่อัปชั่วคราว
-------------------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

app.use('/uploads', express.static(uploadsDir));
app.use('/static', express.static(uploadsDir));

/* -------------------------------------------------------
   Healthcheck
-------------------------------------------------------- */
app.get('/api/health', (_, res) => res.json({ ok: true }));

/* -------------------------------------------------------
   Routes
-------------------------------------------------------- */

// เอกสารพนักงาน
app.use('/api/user/documents', requireAuth, userDocsRoutes);

// Payroll (admin เท่านั้น)
app.use('/api/admin/payroll', requireAuth, only('admin'), payrollSyncRoutes);

// Auth
app.use('/api/auth', authRoutes);

// ฝั่ง employee
app.use('/api/employee', requireAuth, only('employee'), employeeRoutes);

// ฝั่ง admin
app.use('/api/admin', requireAuth, only('admin'), adminRoutes);

// Common ใช้ได้ทั้ง employee/admin
app.use('/api/common', requireAuth, commonRoutes);

/* -------------------------------------------------------
   Start Server
-------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
