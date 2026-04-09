# Backend RAG

Backend para un sistema RAG usando Hono, Google AI y Neon Postgres.

## Requisitos

- Node.js 20+

## Instalación

```bash
npm install
```

## Variables de entorno

1. Copia `.env.example` a `.env`
2. Ajusta valores si lo necesitas

Variables clave:

- `PORT`
- `GOOGLE_API_KEY`
- `EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`
- `LLM_MODEL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `NEON_DATABASE_URL`
- `CORS_ORIGIN`
- `RAG_CHUNK_SIZE`
- `RAG_CHUNK_OVERLAP`
- `RAG_TOP_K`
- `RAG_TOP_K_DOCUMENTOS`
- `RAG_TOP_K_REGISTROS`
- `RAG_RECORDS_TABLE`
- `RAG_RECORDS_ID_COLUMN`
- `RAG_RECORDS_TEXT_COLUMN`
- `RAG_RECORDS_METADATA_COLUMN`
- `RAG_RECORDS_SOURCE_LABEL`
- `MAX_UPLOAD_BYTES`

Valores sugeridos:

- `EMBEDDING_MODEL=gemini-embedding-001`
- `EMBEDDING_DIMENSIONS=3072`  
- `LLM_MODEL=gemini-2.5-flash-lite`
- `GROQ_MODEL=llama-3.3-70b-versatile`

Fallback LLM y Pruebas A/B:

- Por defecto, la ruta de búsqueda de RAG (`POST /api/query`) utilizará Gemini.
- Si Gemini falla, automáticamente se hará fallback al modelo configurado de Groq.
- Puedes solicitar explícitamente a un proveedor mediante el campo `provider: "groq"` ó `"google"` en tu payload body.

## Endpoints base

- `GET /`
- `GET /health`
- `GET /api/stats` (Métricas de uso del sistema RAG)
- `POST /api/ingest`
- `POST /api/ingest/archivo` (multipart/form-data)
- `POST /api/query` 
- `POST /api/documentos/eliminar`
- `POST /api/auth/registro`
- `POST /api/auth/login`

## Autenticación Básica

Registro (`POST /api/auth/registro`):

```json
{
	"nombre": "Ana Lopez",
	"email": "ana@correo.com",
	"password": "ana123"
}
```

Login (`POST /api/auth/login`):

```json
{
	"email": "ana@correo.com",
	"password": "ana123"
}
```

Ambos endpoints devuelven el `usuario` y un `token` JWT con `tokenType` Bearer.

## Métricas del Sistema (`GET /api/stats`)

Devuelve información útil sobre los documentos ingeridos, el vector search y la configuración en tiempo de ejecución. 

```json
{
  "ok": true,
  "totalDocumentos": 25,
  "totalFuentes": 3,
  "vectorSearchEnabled": true,
  "config": {
    "embeddingModel": "gemini-embedding-001",
    "embeddingDimensions": 3072,
    "chunkSize": 1000,
    "topK": 5,
    "vectorIndexMethod": "hnsw"
  }
}
```

## Búsqueda y Consultas (`POST /api/query`)

La ruta de consultas al sistema permite recuperar y sintetizar resultados provenientes del esquema documental (Documentos o archivos ingeridos) y del esquema de base de datos relacional (Registros SQL inmersivos).

Ejemplo de query completa con LLM Selector y filtros:

```json
{
	"question": "Que temas se evaluan en el parcial?",
	"provider": "google",
	"filtrosMetadata": {
		"curso": "Bases de Datos"
	},
	"incluirRegistros": true,
	"topK": 4
}
```

**Respuesta de la consulta (Contrato API):**

El API Backend devuelve todo lo pedido en la rúbrica del curso, unificado bajo `context` y `fragmentosUsados`.

- `answer`: la respuesta generada por el LLM.
- `context` y `fragmentosUsados` (alias explícito): referencias procesadas de la DB (tipo `documento` o `base_datos`).
- `metadata.latencyMs`: Cuánto tardó el retrieval+generación en ms.
- `metadata.provider`: el motor que dio la respuesta (`google` o `groq`).

## Ingesta de Archivos RAG  (`POST /api/ingest/archivo`)

Acepta formatos `.pdf`, `.docx`, `.txt`, `.md`. Se procesa usando LangChain `RecursiveCharacterTextSplitter`.

Ejemplo con FormData:

```powershell
$form = @{ 
	curso = "Bases de Datos"
	reemplazar = "true"
	file = Get-Item "C:\\material\\unidad-1.pdf"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/ingest/archivo" -Method Post -Form $form
```

Si envías `reemplazar=true`, se eliminan fragmentos previos de ese mismo origen. 

## Base de Datos y PgVector

El sistema integra de manera robusta la vectorización mediante `pgvector`, utilizando el formato `halfvec` si superas las 2000 dimensiones (ej. el default de Gemini 3072) en un índice optimizado **HNSW** calibrado para `cosine distance` (m=16, ef_construction=64).

1. El sistema corre los migrations o añade el vector nativamente en el startup de `ensureDocumentosRagSchema()`. 
2. Si PgVector falla, o tus embeddings no logran indexar por problemas del cluster de Neon, el Backend no cae; en su lugar, implementa un fallback a evaluar distancia del coseno directo en JavaScript en memoria. 
