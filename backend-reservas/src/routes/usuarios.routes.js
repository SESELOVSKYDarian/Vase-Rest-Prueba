import { Router } from "express";

import { administrarUsuario, obtenerUsuarios } from "../controllers/usuarios.controller.js";
import { requireAuth } from "../controllers/auth.controller.js";

const router = Router();

router.get("/", obtenerUsuarios);
router.post("/admin", requireAuth, administrarUsuario);

export default router;
