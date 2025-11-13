// index.js
import "dotenv/config";
import http from "http";
import app from "./src/app.js";

const DEFAULT_PORT = 4000;

function normalizePort(val) {
  const p = parseInt(val, 10);
  if (Number.isNaN(p)) return val; // named pipe
  if (p >= 0) return p;
  return DEFAULT_PORT;
}

const port = normalizePort(process.env.PORT || DEFAULT_PORT);
const host = process.env.HOST || "0.0.0.0";

app.set("port", port);

const server = http.createServer(app);

server.listen(port, host, () => {
  const shownHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`API listening on http://${shownHost}:${port}`);
});

server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;
  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;
  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on("close", () => {
  console.log("HTTP server closed");
});

function shutdown(signal) {
  console.log(`${signal} received: closing HTTP server...`);
  server.close((err) => {
    if (err) {
      console.error("Error while closing server:", err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
