-- Agrega columna vectorial para retrieval semantico en BD.
-- Mantiene columna legacy embedding para rollback durante la transicion.

BEGIN;

ALTER TABLE documentos_rag
ADD COLUMN IF NOT EXISTS embedding_vector halfvec(3072);

-- Intenta backfill desde el embedding legacy serializado como texto/json.
UPDATE documentos_rag
SET embedding_vector = embedding::text::halfvec
WHERE embedding_vector IS NULL
  AND embedding IS NOT NULL
  AND embedding::text <> '';

CREATE INDEX IF NOT EXISTS idx_documentos_rag_embedding_vector_hnsw
ON documentos_rag USING hnsw (embedding_vector halfvec_cosine_ops);

COMMIT;
