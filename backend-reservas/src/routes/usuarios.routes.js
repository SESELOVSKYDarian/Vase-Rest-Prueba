import { Router } from "express";

import { administrarUsuario, obtenerUsuarios } from "../controllers/usuarios.controller.js";
import { soloRoles } from "../utils/seguridad.js";

const router = Router();

// Datos de personas (emails y roles): solo quien administra. Alta, baja y cambios de rol, solo admin (el controlador lo vuelve a verificar).
router.get("/", soloRoles("admin", "encargado"), obtenerUsuarios);
router.post("/admin", soloRoles("admin"), administrarUsuario);

export default router;
