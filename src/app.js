import { Hono } from "hono";
import { cors } from "hono/cors";
import healthRouter from "./routes/health.routes.js";
import ragRouter from "./routes/rag.routes.js";
import authRouter from "./routes/auth.routes.js";
import env from "./config/env.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: env.corsOrigin,
  })
);

app.get("/", (c) => {
  return c.json({
    message: "Backend RAG",
    docs: {
      health: "/health",
      ragIngest: "POST /api/ingest",
      ragIngestFile: "POST /api/ingest/archivo (multipart/form-data)",
      ragQuery: "POST /api/query",
      ragStats: "GET /api/stats",
      ragDeleteDocs: "POST /api/documentos/eliminar",
      authRegistro: "POST /api/auth/registro",
      authLogin: "POST /api/auth/login",
    },
  });
});

app.route("/health", healthRouter);
app.route("/api", ragRouter);
app.route("/api/auth", authRouter);

export default app;
