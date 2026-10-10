import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "../controllers/auth.controller.js";

/**
 * Subida de imágenes (fotos de platos, dibujo del plano). Se valida el tipo por la firma
 * binaria del archivo —no por el nombre ni por lo que diga el cliente— y el tamaño real.
 * Los archivos quedan en UPLOADS_DIR (volumen persistente en Docker) y se sirven en /uploads.
 */
export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
const MAX_BYTES = 6 * 1024 * 1024;

function detectarTipo(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { base64 } = req.body || {};
    if (typeof base64 !== "string" || base64.length < 16) {
      return res.status(400).json({ error: "Falta la imagen" });
    }
    // Acepta "data:image/png;base64,...." o solo el base64.
    const limpio = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(limpio, "base64");
    if (buffer.length > MAX_BYTES) return res.status(413).json({ error: "La imagen supera los 6 MB" });
    const tipo = detectarTipo(buffer);
    if (!tipo) return res.status(415).json({ error: "Formato no admitido: usá JPG, PNG o WebP" });

    const ahora = new Date();
    const carpeta = path.join(String(ahora.getFullYear()), String(ahora.getMonth() + 1).padStart(2, "0"));
    await mkdir(path.join(UPLOADS_DIR, carpeta), { recursive: true });
    const nombre = `${randomUUID()}.${tipo.ext}`;
    await writeFile(path.join(UPLOADS_DIR, carpeta, nombre), buffer);
    const ruta = `/uploads/${carpeta}/${nombre}`;
    res.status(201).json({ url: ruta, mime: tipo.mime, bytes: buffer.length });
  } catch (error) {
    console.error("Error al guardar imagen:", error);
    res.status(500).json({ error: "No se pudo guardar la imagen" });
  }
});

export default router;
