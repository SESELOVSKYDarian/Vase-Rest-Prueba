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
import integracionesRoutes from "./routes/integraciones.routes.js";

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = String(process.env.CORS_ORIGINS || "http://localhost:3000")
      .split(",").map((value) => value.trim()).filter(Boolean);
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    const database = await checkDatabase();
    res.json({ status: "ok", database: database.database, timestamp: database.now });
  } catch (error) {
    res.status(503).json({ status: "error", error: error.message });
  }
});

// Monta los modulos principales de NOCTUA bajo /api.
app.use("/api/mesas", mesasRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/facturas", facturasRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/integraciones", integracionesRoutes);

export default app;
