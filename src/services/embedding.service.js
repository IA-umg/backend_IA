import { GoogleGenerativeAI } from "@google/generative-ai";
import env from "../config/env.js";

let client = null;
let embeddingModel = null;

function getClient() {
  if (!env.googleApiKey) {
    throw new Error("GOOGLE_API_KEY no esta configurada.");
  }

  if (!client) {
    client = new GoogleGenerativeAI(env.googleApiKey);
  }

  return client;
}

function getEmbeddingModel() {
  if (!embeddingModel) {
    embeddingModel = getClient().getGenerativeModel({ model: env.embeddingModel });
  }

  return embeddingModel;
}

export async function embedText(text) {
  const normalized = typeof text === "string" ? text.trim() : "";

  if (!normalized) {
    return [];
  }

  const model = getEmbeddingModel();
  const response = await model.embedContent({
    content: { parts: [{ text: normalized }] },
    outputDimensionality: env.embeddingDimensions,
  });

  return response?.embedding?.values || [];
}

