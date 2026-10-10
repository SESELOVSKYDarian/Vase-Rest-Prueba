import { Router } from "express";
import { login } from "../controllers/auth.controller.js";
import { limitar } from "../utils/limitar.js";

const router = Router();
// Por IP; el bloqueo por usuario está en el controlador.
router.post("/login", limitar({ nombre: "login", ventanaMs: 60_000, max: 15 }), login);
export default router;
