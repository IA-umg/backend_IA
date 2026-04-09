import { Hono } from "hono";
import { iniciarSesion, registrarUsuario } from "../services/auth.service.js";
import { statusFromCode } from "../utils/helpers.js";

const authRouter = new Hono();

authRouter.post("/registro", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      {
        error: "Invalid request",
        message: "Debes enviar un JSON valido.",
      },
      400
    );
  }

  const result = await registrarUsuario(body);
  return c.json(result, result.ok ? 201 : statusFromCode(result.code));
});

authRouter.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      {
        error: "Invalid request",
        message: "Debes enviar un JSON valido.",
      },
      400
    );
  }

  const result = await iniciarSesion(body);
  return c.json(result, result.ok ? 200 : statusFromCode(result.code));
});

export default authRouter;
