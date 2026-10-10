import { Router } from "express";
import { firmaValida, mensajesDeWebhook, normalizarTelefono, procesarEntrante, whatsappConfigurado } from "../services/whatsapp/whatsapp.service.js";
import { limitar } from "../utils/limitar.js";

/**
 * Entrada de WhatsApp Business (Cloud API). Meta llama a este webhook por cada mensaje; hay que
 * contestarle 200 enseguida y procesar aparte. Sin credenciales no hace nada; para probar sin cuenta
 * de WhatsApp está el simulador (solo fuera de producción).
 */
const router = Router();

router.get("/webhook", (req, res) => {
  const { "hub.mode": modo, "hub.verify_token": token, "hub.challenge": desafio } = req.query;
  if (modo === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(String(desafio ?? ""));
  res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  if (!whatsappConfigurado()) return res.sendStatus(404);
  if (!firmaValida(req.rawBody ?? Buffer.from(""), req.headers["x-hub-signature-256"])) return res.sendStatus(401);
  res.sendStatus(200);
  // Se procesan de a uno: así dos mensajes seguidos de la misma persona no se pisan.
  for (const m of mensajesDeWebhook(req.body)) {
    try {
      await procesarEntrante({ ...m, texto: m.texto });
    } catch (error) {
      console.error("[whatsapp] no se pudo procesar el mensaje:", error);
    }
  }
});

const simulador = limitar({ nombre: "wa-simulador", ventanaMs: 60_000, max: 60 });

/** Conversar con el asistente sin WhatsApp: devuelve lo que se habría respondido. Solo para desarrollo. */
router.post("/simular", simulador, async (req, res) => {
  if (process.env.NODE_ENV === "production" || whatsappConfigurado()) return res.sendStatus(404);
  const telefono = normalizarTelefono(req.body?.telefono) || "5491100000000";
  const texto = String(req.body?.texto ?? "").slice(0, 600);
  const capturadas = [];
  try {
    const r = await procesarEntrante({ telefono, texto, nombrePerfil: String(req.body?.nombre ?? "").slice(0, 60) }, { enviar: async (_t, msg) => { capturadas.push(msg); return { simulado: true }; } });
    res.json({ respuestas: capturadas, estado: r.estado ?? null });
  } catch (error) {
    console.error("[whatsapp] simulador:", error);
    res.status(500).json({ mensaje: "Falló la simulación" });
  }
});

export default router;
