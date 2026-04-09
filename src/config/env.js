import dotenv from "dotenv";
import { readPositiveInt } from "../utils/helpers.js";

dotenv.config();

const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  googleApiKey: process.env.GOOGLE_API_KEY || "",
  embeddingModel: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  embeddingDimensions: readPositiveInt(process.env.EMBEDDING_DIMENSIONS, 3072),
  llmModel: process.env.LLM_MODEL || "gemini-2.5-flash-lite",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  neonDatabaseUrl: process.env.NEON_DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  ragChunkSize: readPositiveInt(process.env.RAG_CHUNK_SIZE, 900),
  ragChunkOverlap: readPositiveInt(process.env.RAG_CHUNK_OVERLAP, 120),
  ragTopK: readPositiveInt(process.env.RAG_TOP_K, 4),
  ragTopKDocumentos: readPositiveInt(process.env.RAG_TOP_K_DOCUMENTOS, 2),
  ragTopKRegistros: readPositiveInt(process.env.RAG_TOP_K_REGISTROS, 2),
  ragRecordsTable: process.env.RAG_RECORDS_TABLE || "",
  ragRecordsIdColumn: process.env.RAG_RECORDS_ID_COLUMN || "id",
  ragRecordsTextColumn: process.env.RAG_RECORDS_TEXT_COLUMN || "contenido",
  ragRecordsMetadataColumn: process.env.RAG_RECORDS_METADATA_COLUMN || "metadata",
  ragRecordsSourceLabel: process.env.RAG_RECORDS_SOURCE_LABEL || "registros",
  maxUploadBytes: readPositiveInt(process.env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
};

export default env;
