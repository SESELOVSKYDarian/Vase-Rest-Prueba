import { Router } from "express";
import { requireAuth } from "../controllers/auth.controller.js";
import { listIntegrations, removeIntegration, saveIntegration } from "../services/integraciones.service.js";
const router = Router();
router.use(requireAuth);
router.get("/:tipo", async (req, res) => { try { res.json({ integraciones: await listIntegrations(req.params.tipo) }); } catch (error) { res.status(500).json({ error: error.message }); } });
router.put("/:tipo/:proveedor", async (req, res) => { try { await saveIntegration(req.params.tipo, req.params.proveedor, req.body.pais, req.body.config || {}); res.json({ ok: true }); } catch (error) { res.status(500).json({ error: error.message }); } });
router.delete("/:tipo/:proveedor", async (req, res) => { try { await removeIntegration(req.params.tipo, req.params.proveedor); res.json({ ok: true }); } catch (error) { res.status(500).json({ error: error.message }); } });
export default router;
