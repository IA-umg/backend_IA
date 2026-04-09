-- Habilita extension pgvector en Neon.
-- Ejecutar una sola vez en Neon SQL Editor o via migrador.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

COMMIT;
