import { serve } from "@hono/node-server";
import app from "./app.js";
import env from "./config/env.js";

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`[backend-rag] Running on http://localhost:${info.port} (${env.nodeEnv})`);
  }
);
