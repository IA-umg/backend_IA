-- Agrega columna metadata a documentos_rag para filtros/citas/gestion de archivos.
-- Ejecutar una sola vez en Neon SQL Editor.

BEGIN;

ALTER TABLE documentos_rag
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_documentos_rag_metadata_gin
ON documentos_rag USING GIN (metadata);

COMMIT;
