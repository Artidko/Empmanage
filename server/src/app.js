import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pool } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ----- CORS -----
const FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'https://artidko.github.io',
  'https://artidko.github.io/Empmanage'
];

app.use(cors({ origin: FRONTEND_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// health
app.get('/api/health', (_, res) => res.json({ ok: true }));

// test DB
app.get("/api/db-test", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS result");
    res.json({ ok: true, db: rows[0].result });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on ${PORT}`);
});

export default app;
