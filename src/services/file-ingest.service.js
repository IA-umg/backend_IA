import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import env from "../config/env.js";
import { isFileLike, normalizeMetadata } from "../utils/helpers.js";

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md"]);

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildFileError(message, code = "BAD_REQUEST") {
  return {
    ok: false,
    code,
    error: message,
  };
}

function inferPage(metadata) {
  const value = metadata?.loc?.pageNumber ?? metadata?.pageNumber ?? metadata?.page;
  return Number.isInteger(value) ? value : null;
}

function buildSourceName(fileName, chunkIndex, metadata, fuenteBase) {
  const base = fuenteBase ? `${fuenteBase} | ${fileName}` : fileName;
  const page = inferPage(metadata);
  const pageInfo = page ? ` - pagina ${page}` : "";
  return `${base}${pageInfo} - fragmento ${chunkIndex + 1}`;
}

async function writeTempFile(fileLike, extension) {
  const tempName = `rag-${Date.now()}-${crypto.randomUUID()}${extension}`;
  const tempPath = path.join(os.tmpdir(), tempName);
  const buffer = Buffer.from(await fileLike.arrayBuffer());
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

async function loadDocumentsFromPath(filePath, extension, fileName) {
  if (extension === ".pdf") {
    const loader = new PDFLoader(filePath);
    return loader.load();
  }

  if (extension === ".docx") {
    const loader = new DocxLoader(filePath);
    return loader.load();
  }

  if (extension === ".txt" || extension === ".md") {
    const rawText = await fs.readFile(filePath, "utf8");
    return [
      new Document({
        pageContent: rawText,
        metadata: { source: fileName },
      }),
    ];
  }

  throw new Error(`Formato no soportado: ${extension}`);
}

export async function extractChunksFromFiles(files, options = {}) {
  const sourcePrefix =
    typeof options.fuenteBase === "string" && options.fuenteBase.trim().length > 0
      ? options.fuenteBase.trim()
      : "";
  const metadataBase = normalizeMetadata(options.metadataBase ?? options.metadatosBase);

  if (!Array.isArray(files) || files.length === 0) {
    return buildFileError("Debes enviar al menos un archivo en el campo 'files' o 'file'.");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: env.ragChunkSize,
    chunkOverlap: env.ragChunkOverlap,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  try {
    const allChunks = [];
    const report = [];

    for (const entry of files) {
      if (!isFileLike(entry)) {
        return buildFileError("Se detecto un archivo invalido en la carga.");
      }

      const fileName = entry.name || "archivo-sin-nombre";
      const extension = path.extname(fileName).toLowerCase();

      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        return buildFileError(
          `Formato no soportado para '${fileName}'. Usa PDF, DOCX, TXT o MD.`
        );
      }

      if (typeof entry.size === "number" && entry.size > env.maxUploadBytes) {
        return buildFileError(
          `El archivo '${fileName}' supera el limite permitido (${env.maxUploadBytes} bytes).`
        );
      }

      const tempPath = await writeTempFile(entry, extension);

      try {
        const rawDocs = await loadDocumentsFromPath(tempPath, extension, fileName);

        const normalizedDocs = rawDocs
          .map((doc) =>
            new Document({
              pageContent: normalizeText(doc.pageContent),
              metadata: doc.metadata || {},
            })
          )
          .filter((doc) => doc.pageContent.length > 0);

        if (!normalizedDocs.length) {
          return buildFileError(`No se encontro texto util en '${fileName}'.`);
        }

        const splitDocs = await splitter.splitDocuments(normalizedDocs);

        const chunks = splitDocs
          .map((doc, index) => {
            const contenido = normalizeText(doc.pageContent);
            const pagina = inferPage(doc.metadata);

            if (!contenido) {
              return null;
            }

            const metadata = {
              ...metadataBase,
              archivo: fileName,
              extension,
              fragmento: index + 1,
            };

            if (pagina) {
              metadata.pagina = pagina;
            }

            if (sourcePrefix) {
              metadata.fuenteBase = sourcePrefix;
            }

            return {
              fuente: buildSourceName(fileName, index, doc.metadata, sourcePrefix),
              contenido,
              metadata,
            };
          })
          .filter(Boolean);

        if (!chunks.length) {
          return buildFileError(`No se pudieron generar fragmentos para '${fileName}'.`);
        }

        allChunks.push(...chunks);
        report.push({
          archivo: fileName,
          extension,
          fragmentos: chunks.length,
        });
      } finally {
        await fs.unlink(tempPath).catch(() => undefined);
      }
    }

    return {
      ok: true,
      documents: allChunks,
      archivos: report,
      totalFragmentos: allChunks.length,
      config: {
        chunkSize: env.ragChunkSize,
        chunkOverlap: env.ragChunkOverlap,
      },
    };
  } catch (error) {
    return buildFileError(
      env.nodeEnv === "development"
        ? error.message
        : "No se pudieron leer los archivos para ingesta.",
      "INTERNAL_ERROR"
    );
  }
}
