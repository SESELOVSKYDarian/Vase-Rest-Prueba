import { Router } from "express";
import { requireAuth } from "../controllers/auth.controller.js";
import { quitarDispositivo, registrarDispositivo } from "../services/push.service.js";
import { obtenerUsuarioRequest } from "../utils/authz.js";
import { ErrorHttp, responderError } from "../utils/errores.js";

/** Registro del celular para recibir avisos con la pantalla bloqueada. */
const router = Router();
router.use(requireAuth);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post("/registrar", async (req, res) => {
  try {
    const usuario = obtenerUsuarioRequest(req);
    if (!UUID.test(usuario.id)) throw new ErrorHttp(400, "No se reconoce tu usuario");
    await registrarDispositivo(usuario.id, req.body?.token, req.body?.plataforma);
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo registrar el dispositivo");
  }
});

router.post("/quitar", async (req, res) => {
  try {
    await quitarDispositivo(req.body?.token);
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo quitar el dispositivo");
  }
});

export default router;
