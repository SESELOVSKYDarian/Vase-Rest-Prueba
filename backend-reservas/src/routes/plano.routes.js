import { Router } from "express";
import { requireAuth } from "../controllers/auth.controller.js";
import { analizarPlano, ErrorPlanoIA } from "../services/planoIA.service.js";

const router = Router();

/** POST /api/plano/analizar { url: "/uploads/..." } → mesas, zonas y elementos detectados. */
router.post("/analizar", requireAuth, async (req, res) => {
  try {
    const resultado = await analizarPlano(req.body?.url);
    res.json(resultado);
  } catch (error) {
    if (error instanceof ErrorPlanoIA) return res.status(error.status).json({ error: error.message });
    console.error("Error al analizar plano:", error);
    res.status(500).json({ error: "No se pudo analizar el plano" });
  }
});

export default router;
