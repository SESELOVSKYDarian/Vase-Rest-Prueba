import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "../routes/archivos.routes.js";

/**
 * Lee la imagen de un plano (dibujo, plano de arquitecto o foto desde arriba) y devuelve las
 * mesas, zonas y elementos que ve. Las posiciones vuelven NORMALIZADAS (0–1000 sobre el ancho y
 * alto de la imagen) junto con una estimación del tamaño real del local; la app las pasa a cm.
 */
const MODELO = "claude-opus-5-5";

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["es_plano", "local", "zonas", "mesas", "elementos", "notas"],
  properties: {
    es_plano: { type: "boolean", description: "false si la imagen no muestra un plano o vista de un salón" },
    local: {
      type: "object",
      additionalProperties: false,
      required: ["ancho_m", "largo_m"],
      properties: {
        ancho_m: { type: "number", description: "Ancho real estimado del espacio dibujado, en metros (eje horizontal de la imagen)" },
        largo_m: { type: "number", description: "Largo real estimado, en metros (eje vertical de la imagen)" },
      },
    },
    zonas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "x", "y", "w", "h"],
        properties: {
          nombre: { type: "string" },
          x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
        },
      },
    },
    mesas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["forma", "lugares", "x", "y", "rot", "numero"],
        properties: {
          forma: { type: "string", enum: ["circular", "cuadrada", "rectangular"] },
          lugares: { type: "integer" },
          x: { type: "number" }, y: { type: "number" },
          rot: { type: "number", description: "Rotación en grados (0 = lado largo horizontal)" },
          numero: { type: ["integer", "null"], description: "Número escrito en la mesa, si se ve" },
        },
      },
    },
    elementos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "x", "y", "w", "h", "rot", "etiqueta"],
        properties: {
          tipo: { type: "string", enum: ["barra", "pared", "puerta", "ventana", "planta", "columna", "cocina", "bano", "caja", "escalera", "pasillo"] },
          x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
          rot: { type: "number" },
          etiqueta: { type: ["string", "null"] },
        },
      },
    },
    notas: { type: "string", description: "Dudas o supuestos, en una o dos oraciones, en español" },
  },
};

const INSTRUCCIONES = `Analizás planos de restaurantes para cargar el salón en un sistema de gestión.
Devolvé lo que realmente se ve en la imagen; no inventes mesas que no están.

Coordenadas: normalizadas de 0 a 1000 sobre la imagen, origen arriba a la izquierda.
- Mesas: x, y = centro de la mesa. "lugares" = sillas dibujadas alrededor (si no hay sillas, estimalo por el tamaño: una mesa de 2 ≈ 70 cm, de 4 ≈ 90 cm, rectangulares de 6 ≈ 180 × 80 cm). "numero" solo si está escrito.
- Zonas (salón, terraza, patio, barra, VIP…): x, y = esquina superior izquierda; w, h = ancho y alto. Usá los nombres escritos en el plano; si no hay, nombres simples como "Salón" o "Terraza".
- Elementos: x, y = centro; w = largo, h = espesor o ancho; rot en grados. Paredes interiores, puertas, ventanas, barra, columnas, plantas, cocina, baños, caja, escaleras y pasillos de circulación.
Tamaño real: si el plano tiene cotas o escala, usalas; si no, estimalo con el tamaño típico de las mesas.
Si la imagen no es un plano o vista de un salón, devolvé es_plano = false y listas vacías.`;

export class ErrorPlanoIA extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

/** Ruta /uploads/... → archivo real, sin permitir salir de la carpeta de subidas. */
async function leerSubida(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) throw new ErrorPlanoIA("Imagen inválida", 400);
  const relativa = decodeURIComponent(url.slice("/uploads/".length));
  const absoluta = path.resolve(UPLOADS_DIR, relativa);
  if (!absoluta.startsWith(UPLOADS_DIR + path.sep)) throw new ErrorPlanoIA("Imagen inválida", 400);
  const buffer = await readFile(absoluta).catch(() => null);
  if (!buffer) throw new ErrorPlanoIA("No se encontró la imagen", 404);
  const ext = path.extname(absoluta).toLowerCase();
  const media = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { data: buffer.toString("base64"), media };
}

export async function analizarPlano(url) {
  // El SDK toma la clave de ANTHROPIC_API_KEY (u otras credenciales del entorno).
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new ErrorPlanoIA("El análisis con IA no está configurado: falta ANTHROPIC_API_KEY en el servidor.", 503);
  }
  const imagen = await leerSubida(url);
  const client = new Anthropic();

  let respuesta;
  try {
    respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      // Si el modelo declina por política, el servidor reintenta con el modelo de respaldo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: ESQUEMA } },
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imagen.media, data: imagen.data } },
            { type: "text", text: "Analizá este plano y devolvé las mesas, zonas y elementos." },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ErrorPlanoIA("La clave de Anthropic del servidor no es válida.", 503);
    if (error instanceof Anthropic.RateLimitError) throw new ErrorPlanoIA("Demasiadas solicitudes a la IA. Probá de nuevo en un minuto.", 429);
    if (error instanceof Anthropic.BadRequestError) throw new ErrorPlanoIA("La IA no pudo procesar esta imagen.", 422);
    if (error instanceof Anthropic.APIError) throw new ErrorPlanoIA("El servicio de IA no respondió. Probá de nuevo.", 502);
    throw error;
  }

  if (respuesta.stop_reason === "refusal") throw new ErrorPlanoIA("La IA no pudo analizar esta imagen.", 422);
  if (respuesta.stop_reason === "max_tokens") throw new ErrorPlanoIA("El plano es demasiado grande para analizarlo de una vez. Probá con una sola sala.", 422);
  const texto = respuesta.content.find((b) => b.type === "text")?.text;
  if (!texto) throw new ErrorPlanoIA("La IA no devolvió resultado.", 502);
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorPlanoIA("La respuesta de la IA no tuvo el formato esperado.", 502);
  }
}
