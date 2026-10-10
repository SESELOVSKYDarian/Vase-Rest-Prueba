import { Router } from "express";
import { pool } from "../config/database.js";

/**
 * Endpoints públicos (sin sesión) para la carta que ve el cliente desde el QR de la mesa.
 * Solo exponen lo que ya está impreso en una carta: nombres, descripciones, precios y fotos.
 */
const router = Router();

router.get("/carta", async (_req, res) => {
  try {
    const [categorias, productos] = await Promise.all([
      pool.query("select id, nombre, orden from categorias where coalesce(activo, true) order by orden nulls last, nombre"),
      pool.query(`select id, categoria_id, nombre, descripcion, precio, imagen_url, disponible
                  from productos where coalesce(activo, true) order by nombre`),
    ]);
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({
      categorias: categorias.rows.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden ?? 0 })),
      productos: productos.rows.map((p) => ({
        id: p.id,
        categoriaId: p.categoria_id,
        nombre: p.nombre,
        descripcion: p.descripcion ?? "",
        precio: Number(p.precio),
        imagenUrl: p.imagen_url ?? null,
        disponible: p.disponible !== false,
      })),
    });
  } catch (error) {
    console.error("Error al obtener la carta pública:", error);
    res.status(500).json({ error: "No se pudo cargar la carta" });
  }
});

export default router;
