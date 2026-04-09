import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { query as dbQuery } from "../db/neon.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const SALT_ROUNDS = 10;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function sanitizeUsuario(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    creadoEn: row.creado_en,
  };
}

function createToken(usuario) {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET no esta configurada.");
  }

  return jwt.sign(
    {
      sub: String(usuario.id),
      email: usuario.email,
      nombre: usuario.nombre,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    }
  );
}

function buildError(code, message, fallbackMessage = "No se pudo procesar la autenticacion.") {
  return {
    ok: false,
    code,
    error: env.nodeEnv === "development" ? message : fallbackMessage,
  };
}

function validateRegistroPayload(payload) {
  const nombre = typeof payload?.nombre === "string" ? payload.nombre.trim() : "";
  const email = normalizeEmail(payload?.email);
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (nombre.length < 2 || nombre.length > 100) {
    return buildError("BAD_REQUEST", "El campo 'nombre' debe tener entre 2 y 100 caracteres.");
  }

  if (!EMAIL_REGEX.test(email)) {
    return buildError("BAD_REQUEST", "El correo electronico no es valido.");
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return buildError("BAD_REQUEST", "La contrasena debe tener al menos 8 caracteres.");
  }

  return {
    ok: true,
    value: {
      nombre,
      email,
      password,
    },
  };
}

function validateLoginPayload(payload) {
  const email = normalizeEmail(payload?.email);
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!EMAIL_REGEX.test(email)) {
    return buildError("BAD_REQUEST", "El correo electronico no es valido.");
  }

  if (!password) {
    return buildError("BAD_REQUEST", "La contrasena es requerida.");
  }

  return {
    ok: true,
    value: {
      email,
      password,
    },
  };
}

export async function registrarUsuario(payload) {
  const validation = validateRegistroPayload(payload);

  if (!validation.ok) {
    return validation;
  }

  const { nombre, email, password } = validation.value;

  try {
    const existente = await dbQuery("SELECT id FROM usuario WHERE email = $1 LIMIT 1", [email]);

    if (existente.rows.length > 0) {
      return buildError("CONFLICT", "El correo ya esta registrado.");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const inserted = await dbQuery(
      `
        INSERT INTO usuario (nombre, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, nombre, email, creado_en
      `,
      [nombre, email, passwordHash]
    );

    const usuario = sanitizeUsuario(inserted.rows[0]);
    const token = createToken(usuario);

    return {
      ok: true,
      usuario,
      token,
      tokenType: "Bearer",
    };
  } catch (error) {
    if (error?.code === "23505") {
      return buildError("CONFLICT", "El correo ya esta registrado.");
    }

    const message = error instanceof Error ? error.message : "Error interno";

    if (message.includes("no esta configurada")) {
      return buildError("DEPENDENCY_ERROR", message);
    }

    return buildError("INTERNAL_ERROR", message);
  }
}

export async function iniciarSesion(payload) {
  const validation = validateLoginPayload(payload);

  if (!validation.ok) {
    return validation;
  }

  const { email, password } = validation.value;

  try {
    const result = await dbQuery(
      `
        SELECT id, nombre, email, password_hash, creado_en
        FROM usuario
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    const row = result.rows[0];

    if (!row) {
      return buildError("UNAUTHORIZED", "Credenciales invalidas.");
    }

    const isValid = await bcrypt.compare(password, row.password_hash || "");

    if (!isValid) {
      return buildError("UNAUTHORIZED", "Credenciales invalidas.");
    }

    const usuario = sanitizeUsuario(row);
    const token = createToken(usuario);

    return {
      ok: true,
      usuario,
      token,
      tokenType: "Bearer",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";

    if (message.includes("no esta configurada")) {
      return buildError("DEPENDENCY_ERROR", message);
    }

    return buildError("INTERNAL_ERROR", message);
  }
}
