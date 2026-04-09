import { Hono } from "hono";
import env from "../config/env.js";
import { query as dbQuery } from "../db/neon.js";

const healthRouter = new Hono();

healthRouter.get("/", async (c) => {
  let neon = {
    status: "no-funcional",
  };

  if (!env.neonDatabaseUrl) {
    neon = {
      status: "no-funcional",
      message: "NEON_DATABASE_URL no esta configurada",
    };
  } else {
    try {
      await dbQuery("SELECT 1");
      neon = {
        status: "funcional",
      };
    } catch (error) {
      neon = {
        status: "no-funcional",
        message:
          env.nodeEnv === "development"
            ? error.message
            : "No se pudo verificar la conexion con Neon",
      };
    }
  }

  return c.json({
    status: neon.status === "funcional" ? "ok" : "degradado",
    service: "backend-rag",
    timestamp: new Date().toISOString(),
    neon,
  });
});

export default healthRouter;
