import { Router } from "express";
import { requireAuth } from "../controllers/auth.controller.js";
import { pool } from "../config/database.js";
import { obtenerUsuarioRequest } from "../utils/authz.js";
import { ErrorHttp, responderError } from "../utils/errores.js";

/**
 * Lo que el plano sabe además del estado de cada mesa: cuánto lleva esperando, quién la atiende,
 * quién tiene menos trabajo y qué mesas rinden más. Todo exige sesión del personal.
 */
const router = Router();
router.use(requireAuth);

const SALON = new Set(["admin", "encargado", "cajero", "mozo"]);
const GESTION = new Set(["admin", "encargado", "cajero"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TURNO_HORAS = 8;

function exigir(req, roles) {
  const usuario = obtenerUsuarioRequest(req);
  if (!roles.has(usuario.rol)) throw new ErrorHttp(403, "Tu usuario no puede ver esto");
  return usuario;
}

const minutos = (desde) => (desde ? Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000)) : null);

/** Mesas con gente: desde cuándo esperan, quién las atiende, y la carga de cada mozo. */
router.get("/salon", async (req, res) => {
  try {
    exigir(req, SALON);
    const [mesas, mozos, turno] = await Promise.all([
      pool.query(
        `select m.id as mesa_id, m.estado as mesa_estado, m.asignada_en,
                p.id as pedido_id, p.estado as pedido_estado, p.estado_desde, p.abierto_en, p.comensales, p.usuario_id,
                coalesce(m.mozo_id, case when u.rol = 'mozo' then u.id end) as mozo_id, m.mozo_id is not null as asignada
           from mesas m
           left join lateral (
             select * from pedidos x where x.mesa_id = m.id and x.estado not in ('cerrado', 'cerrada', 'cancelado')
              order by x.abierto_en desc limit 1
           ) p on true
           left join usuarios u on u.id = p.usuario_id
          where m.estado <> 'libre'`,
      ),
      pool.query("select id, nombre from usuarios where rol = 'mozo' and activo order by nombre"),
      pool.query(
        `select mozo_id, count(distinct mesa_id)::int as mesas, max(cuando) as ultima
           from (
             select mozo_id, mesa_id, creada_en as cuando from asignaciones_mesa where creada_en > now() - make_interval(hours => $1)
             union all
             select usuario_id, mesa_id, abierto_en from pedidos where usuario_id is not null and mesa_id is not null and abierto_en > now() - make_interval(hours => $1)
           ) t group by mozo_id`,
        [TURNO_HORAS],
      ),
    ]);
    const nombres = new Map(mozos.rows.map((m) => [m.id, m.nombre]));
    const señales = mesas.rows.map((f) => ({
      mesaId: f.mesa_id,
      pedidoId: f.pedido_id ?? null,
      pedidoEstado: f.pedido_estado ?? null,
      minEnEstado: minutos(f.estado_desde),
      minOcupada: minutos(f.abierto_en ?? f.asignada_en),
      comensales: f.comensales ?? null,
      mozoId: f.mozo_id ?? null,
      mozoNombre: f.mozo_id ? nombres.get(f.mozo_id) ?? null : null,
    }));
    const turnoPor = new Map(turno.rows.map((t) => [t.mozo_id, t]));
    const cargas = mozos.rows.map((m) => {
      const suyas = señales.filter((s) => s.mozoId === m.id);
      const t = turnoPor.get(m.id);
      return {
        id: m.id,
        nombre: m.nombre,
        mesasActivas: suyas.length,
        comensalesActivos: suyas.reduce((s, x) => s + (x.comensales ?? 0), 0),
        asignadasEnTurno: t?.mesas ?? 0,
        ultimaAsignacion: t?.ultima ? new Date(t.ultima).getTime() : null,
        mesas: suyas.map((s) => s.mesaId),
      };
    });
    res.json({ mesas: señales, mozos: cargas });
  } catch (error) {
    responderError(res, error, "No se pudo leer el estado del salón");
  }
});

/** Asigna una mesa a un mozo (o la libera con mozoId null). Queda registrado para el reparto del turno. */
router.post("/asignar", async (req, res) => {
  const client = await pool.connect();
  try {
    const usuario = exigir(req, SALON);
    const mesaId = String(req.body?.mesaId ?? "");
    const mozoId = req.body?.mozoId == null ? null : String(req.body.mozoId);
    if (!UUID.test(mesaId) || (mozoId !== null && !UUID.test(mozoId))) throw new ErrorHttp(400, "Identificador inválido");
    await client.query("begin");
    if (mozoId) {
      const mozo = await client.query("select 1 from usuarios where id = $1 and rol = 'mozo' and activo", [mozoId]);
      if (!mozo.rowCount) throw new ErrorHttp(404, "Ese mozo no existe o está inactivo");
    }
    const r = await client.query("update mesas set mozo_id = $2, asignada_en = case when $2::uuid is null then null else now() end where id = $1 returning id", [mesaId, mozoId]);
    if (!r.rowCount) throw new ErrorHttp(404, "Mesa no encontrada");
    if (mozoId) await client.query("insert into asignaciones_mesa (mesa_id, mozo_id, asignada_por) values ($1, $2, $3)", [mesaId, mozoId, usuario.nombre || usuario.rol]);
    await client.query("commit");
    res.json({ ok: true });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    responderError(res, error, "No se pudo asignar la mesa");
  } finally {
    client.release();
  }
});

/** Cuánto rinde cada mesa: ventas, veces que se usó por día y cuánto se queda la gente. */
router.get("/calor", async (req, res) => {
  try {
    exigir(req, GESTION);
    const dias = Math.min(180, Math.max(1, Math.round(Number(req.query.dias) || 30)));
    const r = await pool.query(
      `select mesa_id, count(*)::int as pedidos, coalesce(sum(total), 0)::float8 as ventas,
              avg(extract(epoch from (cerrado_en - abierto_en)) / 60) filter (where cerrado_en > abierto_en and cerrado_en - abierto_en < interval '8 hours')::float8 as permanencia
         from pedidos
        where estado in ('cerrado', 'cerrada') and mesa_id is not null
          and coalesce(cerrado_en, abierto_en) > now() - make_interval(days => $1)
        group by mesa_id`,
      [dias],
    );
    res.json({
      dias,
      mesas: r.rows.map((f) => ({
        mesaId: f.mesa_id,
        pedidos: f.pedidos,
        ventas: Math.round(f.ventas * 100) / 100,
        rotacion: Math.round((f.pedidos / dias) * 100) / 100,
        permanenciaMin: f.permanencia == null ? null : Math.round(f.permanencia),
      })),
    });
  } catch (error) {
    responderError(res, error, "No se pudo calcular el mapa de calor");
  }
});

export default router;
