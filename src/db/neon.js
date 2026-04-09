import pg from "pg";
import env from "../config/env.js";

const { Pool } = pg;

export const pool = env.neonDatabaseUrl
  ? new Pool({
      connectionString: env.neonDatabaseUrl,
      ssl: { rejectUnauthorized: false },
    })
  : null;

export async function query(sql, params = []) {
  if (!pool) {
    throw new Error("NEON_DATABASE_URL no esta configurada.");
  }

  return pool.query(sql, params);
}
