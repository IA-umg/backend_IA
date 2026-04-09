/**
 * Centraliza lógica repetida entre rutas y servicios.
 */

export function isFileLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.name === "string"
  );
}

export function statusFromCode(code) {
  const map = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    CONFLICT: 409,
    DEPENDENCY_ERROR: 503,
    DATASTORE_ERROR: 503,
  };

  return map[code] || 500;
}

export function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeMetadata(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, metadataValue]) => metadataValue !== undefined)
  );
}

export function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "si" || normalized === "yes";
}

export function parseMetadataInput(value) {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: {} };
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return { ok: true, value };
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ok: true, value: parsed };
      }
    } catch {
      return {
        ok: false,
        message: "El campo 'metadata' debe ser un JSON valido de tipo objeto.",
      };
    }
  }

  return {
    ok: false,
    message: "El campo 'metadata' debe ser un objeto.",
  };
}
