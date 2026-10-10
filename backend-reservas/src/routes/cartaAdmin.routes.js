import { Router } from "express";
import { requireAuth } from "../controllers/auth.controller.js";
import { pool } from "../config/database.js";
import { guardarConfig, leerConfig } from "../services/cartaConfig.service.js";
import { ETIQUETAS, leerCatalogo } from "../services/carta.service.js";
import { crearIndice } from "../services/ia/indice.js";
import { pedirJson, proveedorLlm } from "../services/ia/llm.js";
import { interpretarComando, interpretarPedido } from "../services/ia/nlu.local.js";
import { redondearPrecio } from "../services/ia/texto.js";
import { mpConfigurado } from "../services/mercadopago.service.js";
import { obtenerUsuarioRequest } from "../utils/authz.js";
import { ErrorHttp, responderError } from "../utils/errores.js";

/** Ajustes de la carta, etiquetas y asistente del personal. Exige sesión; los cambios son de admin y encargado. */
const router = Router();
router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigir(req, ...roles) {
  const usuario = obtenerUsuarioRequest(req);
  if (!roles.includes(usuario.rol)) throw new ErrorHttp(403, "Tu usuario no puede hacer este cambio");
  return usuario;
}
const GESTION = ["admin", "encargado"];
const SALON = ["admin", "encargado", "cajero", "mozo"];

router.get("/config", async (req, res) => {
  try {
    exigir(req, ...SALON);
    res.json({ config: await leerConfig(), integraciones: { mercadopago: mpConfigurado(), ia: proveedorLlm() }, etiquetas: ETIQUETAS });
  } catch (error) {
    responderError(res, error, "No se pudieron cargar los ajustes");
  }
});

router.put("/config", async (req, res) => {
  try {
    exigir(req, ...GESTION);
    res.json({ config: await guardarConfig(req.body?.config ?? req.body) });
  } catch (error) {
    responderError(res, error, "No se pudieron guardar los ajustes");
  }
});

router.put("/productos/:id/etiquetas", async (req, res) => {
  try {
    exigir(req, ...GESTION);
    if (!UUID.test(req.params.id)) throw new ErrorHttp(400, "Identificador inválido");
    const etiquetas = [...new Set((Array.isArray(req.body?.etiquetas) ? req.body.etiquetas : []).filter((e) => ETIQUETAS.includes(e)))];
    // Vegano implica vegetariano; así el filtro de la carta no deja afuera a nadie.
    if (etiquetas.includes("vegano") && !etiquetas.includes("vegetariano")) etiquetas.push("vegetariano");
    const r = await pool.query("update productos set etiquetas = $2::text[] where id = $1 returning id", [req.params.id, etiquetas]);
    if (!r.rowCount) throw new ErrorHttp(404, "Plato no encontrado");
    res.json({ ok: true, etiquetas });
  } catch (error) {
    responderError(res, error, "No se pudieron guardar las etiquetas");
  }
});

router.get("/resenas", async (req, res) => {
  try {
    exigir(req, ...GESTION);
    const r = await pool.query("select r.estrellas, r.comentario, r.creada_en, m.numero as mesa from resenas r left join mesas m on m.id = r.mesa_id order by r.creada_en desc limit 100");
    const promedio = r.rows.length ? r.rows.reduce((s, f) => s + f.estrellas, 0) / r.rows.length : null;
    res.json({ promedio, total: r.rows.length, resenas: r.rows.map((f) => ({ estrellas: f.estrellas, comentario: f.comentario ?? "", mesa: f.mesa, creadaEn: f.creada_en })) });
  } catch (error) {
    responderError(res, error, "No se pudieron cargar las reseñas");
  }
});

async function indiceDeLaCarta() {
  const catalogo = await leerCatalogo();
  return { catalogo, indice: crearIndice(catalogo) };
}

/**
 * "Marcá agotado el bife", "subí 8 % las bebidas": se entiende y se muestra el antes y el después.
 * No cambia nada: eso pasa recién en /asistente/ejecutar cuando la persona confirma.
 */
router.post("/asistente/comando", async (req, res) => {
  try {
    exigir(req, ...GESTION);
    const texto = String(req.body?.texto ?? "").trim().slice(0, 400);
    if (!texto) throw new ErrorHttp(400, "Escribí o dictá qué querés hacer");
    const { indice } = await indiceDeLaCarta();
    let resultado = interpretarComando(texto, indice);
    let fuente = "local";
    // Si las reglas no alcanzan y hay IA gratuita, ella solo reescribe la orden en frases simples
    // y esas frases pasan por el mismo intérprete: la IA nunca toca ids ni precios directamente.
    if (!resultado.acciones.length && !resultado.respuesta && proveedorLlm()) {
      const ia = await pedirJson({
        sistema: 'Reescribís órdenes de un encargado de restaurante en comandos simples, uno por línea, solo de estos tipos: "marcar agotado <plato>", "marcar disponible <plato>", "subir <n>% <plato o categoría>", "bajar <n>% <plato o categoría>", "precio <plato> a <importe>". Usá los nombres como los dijo la persona. Formato: {"comandos": string[]}',
        usuario: texto,
        maxTokens: 300,
      });
      const comandos = Array.isArray(ia?.comandos) ? ia.comandos.slice(0, 6).map(String) : [];
      const acciones = [];
      for (const c of comandos) acciones.push(...interpretarComando(c, indice).acciones);
      if (acciones.length) { resultado = { acciones, respuesta: null, noEntendido: [] }; fuente = "ia"; }
    }
    res.json({ ...resultado, fuente });
  } catch (error) {
    responderError(res, error, "No se pudo interpretar la orden");
  }
});

/** Aplica lo que la persona confirmó. Los precios se recalculan acá sobre los valores actuales de la base. */
router.post("/asistente/ejecutar", async (req, res) => {
  const client = await pool.connect();
  try {
    const usuario = exigir(req, ...GESTION);
    const acciones = Array.isArray(req.body?.acciones) ? req.body.acciones.slice(0, 10) : [];
    if (!acciones.length) throw new ErrorHttp(400, "No hay nada para aplicar");
    const cambios = [];
    await client.query("begin");
    for (const a of acciones) {
      const ids = [...new Set((Array.isArray(a?.productos) ? a.productos : []).map((p) => String(p?.id)).filter((id) => UUID.test(id)))].slice(0, 200);
      if (!ids.length) continue;
      const actuales = (await client.query("select id, nombre, precio, disponible from productos where id = any($1::uuid[]) and coalesce(activo, true) for update", [ids])).rows;
      for (const p of actuales) {
        if (a.tipo === "agotado" || a.tipo === "disponible") {
          const disponible = a.tipo === "disponible";
          if (p.disponible === disponible) continue;
          await client.query("update productos set disponible = $2 where id = $1", [p.id, disponible]);
          cambios.push({ id: p.id, nombre: p.nombre, tipo: a.tipo });
        } else if (a.tipo === "precio_pct") {
          const pct = Number(a.pct);
          if (!(pct >= -90 && pct <= 200) || pct === 0) throw new ErrorHttp(400, "Porcentaje fuera de rango");
          const nuevo = Math.max(10, redondearPrecio(Number(p.precio) * (1 + pct / 100)));
          await client.query("update productos set precio = $2 where id = $1", [p.id, nuevo]);
          cambios.push({ id: p.id, nombre: p.nombre, tipo: a.tipo, antes: Number(p.precio), despues: nuevo });
        } else if (a.tipo === "precio_fijo") {
          const nuevo = Number(a.precio);
          if (!(nuevo > 0 && nuevo < 10_000_000)) throw new ErrorHttp(400, "Precio inválido");
          await client.query("update productos set precio = $2 where id = $1", [p.id, nuevo]);
          cambios.push({ id: p.id, nombre: p.nombre, tipo: a.tipo, antes: Number(p.precio), despues: nuevo });
        } else {
          throw new ErrorHttp(400, "Acción desconocida");
        }
      }
    }
    await client.query("commit");
    console.log(`[asistente] ${usuario.nombre || usuario.rol} aplicó ${cambios.length} cambios`);
    res.json({ ok: true, cambios });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    responderError(res, error, "No se pudieron aplicar los cambios");
  } finally {
    client.release();
  }
});

/** Pedido dictado por el mozo: devuelve líneas de la carta para revisar antes de enviar. */
router.post("/asistente/pedido", async (req, res) => {
  try {
    exigir(req, ...SALON);
    const texto = String(req.body?.texto ?? "").trim().slice(0, 600);
    if (!texto) throw new ErrorHttp(400, "No escuché ningún pedido");
    const { indice } = await indiceDeLaCarta();
    const resultado = interpretarPedido(texto, indice);
    res.json(resultado);
  } catch (error) {
    responderError(res, error, "No se pudo entender el pedido");
  }
});

export default router;
