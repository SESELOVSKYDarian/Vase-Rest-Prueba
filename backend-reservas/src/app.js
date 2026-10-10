import express from "express";
import cors from "cors";

import mesasRoutes from "./routes/mesas.routes.js";
import reservasRoutes from "./routes/reservas.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";
import facturasRoutes from "./routes/facturas.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import categoriasRoutes from "./routes/categorias.routes.js";
import { checkDatabase } from "./config/database.js";
import dataRoutes from "./routes/data.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { attachAuth, requireAuth } from "./controllers/auth.controller.js";
import { cabecerasSeguras, esProduccion, escribenSolo, sinCache, soloRoles } from "./utils/seguridad.js";
import archivosRoutes, { UPLOADS_DIR } from "./routes/archivos.routes.js";
import publicoRoutes from "./routes/publico.routes.js";
import planoRoutes from "./routes/plano.routes.js";
import avisosRoutes from "./routes/avisos.routes.js";
import inteligenciaRoutes from "./routes/inteligencia.routes.js";
import pushRoutes from "./routes/push.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import cartaAdminRoutes from "./routes/cartaAdmin.routes.js";
import integracionesRoutes from "./routes/integraciones.routes.js";

const app = express();
app.disable("x-powered-by");
// Detrás de un proxy (Cloudflare, nginx) hay que decirle cuántos saltos confiar para ver la IP real.
if (process.env.TRUST_PROXY) app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
app.use(cabecerasSeguras);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = String(process.env.CORS_ORIGINS || "http://localhost:3000")
      .split(",").map((value) => value.trim()).filter(Boolean);
    // localhost solo se acepta fuera de producción (desarrollo).
    if (!origin || (!esProduccion() && /^http:\/\/localhost(:\d+)?$/.test(origin)) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// El plano de mesas (salon_layouts) embebe la imagen de fondo como data URL en el
// payload JSON; el límite por defecto de express (100kb) la rechaza con 413.
// El cuerpo crudo de WhatsApp hace falta para verificar la firma de Meta.
app.use(express.json({ limit: "12mb", verify: (req, _res, buf) => { if (req.originalUrl.startsWith("/api/whatsapp")) req.rawBody = buf; } }));
app.use(attachAuth);

// Imágenes subidas: nombres aleatorios e inmutables → caché larga. "cross-origin" para que
// la app (otro puerto/dominio) pueda mostrarlas.
app.use("/uploads", express.static(UPLOADS_DIR, {
  immutable: true,
  maxAge: "365d",
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
  },
}));
app.use("/api/archivos", archivosRoutes);
app.use("/api/public", publicoRoutes);
app.use("/api/plano", planoRoutes);
app.use("/api/avisos", avisosRoutes);
app.use("/api/inteligencia", inteligenciaRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/carta-admin", cartaAdminRoutes);

app.get("/health", async (_req, res) => {
  try {
    const database = await checkDatabase();
    res.json({ status: "ok", database: database.database, timestamp: database.now });
  } catch (error) {
    res.status(503).json({ status: "error", error: error.message });
  }
});

// Monta los modulos principales de NOCTUA bajo /api.
// Todo lo que no es público exige sesión; lo que modifica datos delicados, además, el rol que corresponde.
const SALON = ["admin", "encargado", "cajero", "mozo", "cocina", "delivery"];
app.use("/api", (req, res, next) => (req.path.startsWith("/public") || req.path.startsWith("/auth") || req.path.startsWith("/whatsapp") ? next() : sinCache(req, res, next)));
app.use("/api/mesas", requireAuth, escribenSolo("admin", "encargado"), mesasRoutes);
app.use("/api/reservas", soloRoles("admin", "encargado", "cajero", "mozo"), reservasRoutes);
// Cocina y mozos pueden marcar un plato como agotado; el resto de los cambios son de quien maneja la carta y el stock.
app.use("/api/productos", requireAuth, (req, res, next) => (/\/disponibilidad$/.test(req.path) ? escribenSolo("admin", "encargado", "stock", "cocina", "mozo")(req, res, next) : escribenSolo("admin", "encargado", "stock")(req, res, next)), productosRoutes);
app.use("/api/pedidos", soloRoles(...SALON), (req, res, next) => (req.method === "DELETE" ? soloRoles("admin", "encargado", "cajero")[1](req, res, next) : next()), pedidosRoutes);
app.use("/api/facturas", soloRoles("admin", "encargado", "cajero", "mozo"), facturasRoutes);
app.use("/api/usuarios", requireAuth, usuariosRoutes);
app.use("/api/categorias", requireAuth, escribenSolo("admin", "encargado"), categoriasRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/integraciones", integracionesRoutes);

export default app;
