import { pool } from "../config/database.js";
import { enviarAviso, reclamarAviso } from "./push.service.js";

/**
 * Vigila el salón y avisa al celular de quien corresponde. Mira la base cada pocos segundos (en vez
 * de engancharse a cada ruta) para cubrir también los cambios que hace cocina desde otras pantallas.
 * Cada evento avisa una sola vez; los que ya pasaron hace rato se ignoran para no avisar de lo viejo
 * cuando el servidor arranca.
 */
const CADA_MS = 8000;
const VENTANA = "3 minutes";
const PERSONAL_SALON = ["mozo", "encargado", "cajero"];

const dinero = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(n));

/** Quién atiende la mesa: el mozo asignado, o quien abrió el pedido si es mozo; si nadie, todos los mozos. */
function destinatariosMesa(fila) {
  const id = fila.mozo_id ?? (fila.usuario_rol === "mozo" ? fila.usuario_id : null);
  return id ? { usuarios: [id], roles: [] } : { usuarios: [], roles: ["mozo", "encargado"] };
}

async function pedidosListos() {
  const r = await pool.query(
    `select p.id, p.estado_desde, m.numero, m.id as mesa_id, m.mozo_id, p.usuario_id, u.rol::text as usuario_rol
       from pedidos p join mesas m on m.id = p.mesa_id left join usuarios u on u.id = p.usuario_id
      where p.estado = 'listo' and p.estado_desde > now() - interval '${VENTANA}'`,
  );
  for (const f of r.rows) {
    if (!(await reclamarAviso(`listo:${f.id}:${new Date(f.estado_desde).getTime()}`))) continue;
    await enviarAviso({ ...destinatariosMesa(f), titulo: `Mesa ${f.numero} · listo para servir`, cuerpo: "Cocina terminó el pedido. Llevalo antes de que se enfríe.", data: { tipo: "pedido_listo", mesaId: f.mesa_id, mesa: f.numero } });
  }
}

async function solicitudesDeMesa() {
  const r = await pool.query(
    `select s.id, s.tipo, m.numero, m.id as mesa_id, m.mozo_id
       from solicitudes_mesa s join mesas m on m.id = s.mesa_id
      where s.estado = 'pendiente' and s.creada_en > now() - interval '${VENTANA}'`,
  );
  const titulos = { pedido: "quiere pedir", mozo: "llama al mozo", cuenta: "pide la cuenta" };
  for (const f of r.rows) {
    if (!(await reclamarAviso(`sol:${f.id}`))) continue;
    const dest = f.mozo_id ? { usuarios: [f.mozo_id], roles: ["encargado"] } : { usuarios: [], roles: PERSONAL_SALON };
    await enviarAviso({ ...dest, titulo: `Mesa ${f.numero} ${titulos[f.tipo] ?? "te necesita"}`, cuerpo: f.tipo === "pedido" ? "Confirmalo para que pase a cocina." : "Pasá por la mesa.", data: { tipo: "solicitud", mesaId: f.mesa_id, mesa: f.numero } });
  }
}

async function transferenciasPendientes() {
  const r = await pool.query(
    `select q.id, q.monto, q.propina, m.numero, m.id as mesa_id
       from pagos_qr q left join mesas m on m.id = q.mesa_id
      where q.estado = 'pendiente' and q.metodo = 'transferencia' and q.creado_en > now() - interval '${VENTANA}'`,
  );
  for (const f of r.rows) {
    if (!(await reclamarAviso(`pago:${f.id}`))) continue;
    await enviarAviso({ roles: ["cajero", "encargado", "mozo"], titulo: `Mesa ${f.numero ?? "?"} · transferencia por confirmar`, cuerpo: `${dinero(Number(f.monto) + Number(f.propina))}. Confirmá cuando veas la plata en tu cuenta.`, data: { tipo: "pago", mesaId: f.mesa_id, mesa: f.numero } });
  }
}

async function pedidosDeFactura() {
  const r = await pool.query(
    `select f.id, f.tipo_comprobante, m.numero from solicitudes_factura f join pagos_qr q on q.id = f.pago_id left join mesas m on m.id = q.mesa_id
      where f.estado = 'pendiente' and f.creada_en > now() - interval '${VENTANA}'`,
  );
  for (const f of r.rows) {
    if (!(await reclamarAviso(`fac:${f.id}`))) continue;
    await enviarAviso({ roles: ["cajero", "encargado", "admin"], titulo: `Piden factura ${f.tipo_comprobante} · mesa ${f.numero ?? "?"}`, cuerpo: "Emitila en ARCA y anotá el número.", data: { tipo: "factura", mesa: f.numero } });
  }
}

let corriendo = false;
async function vuelta() {
  if (corriendo) return;
  corriendo = true;
  try {
    // Sin celulares registrados no hay a quién avisar: no se gasta ni una consulta más.
    const hay = await pool.query("select 1 from dispositivos_push limit 1");
    if (!hay.rowCount) return;
    await pedidosListos();
    await solicitudesDeMesa();
    await transferenciasPendientes();
    await pedidosDeFactura();
    await pool.query("delete from push_enviados where creado_en < now() - interval '2 days'");
  } catch (error) {
    console.warn("[push] vuelta fallida:", error instanceof Error ? error.message : error);
  } finally {
    corriendo = false;
  }
}

export function iniciarAvisosPush() {
  if (process.env.PUSH_ENABLED === "false") return null;
  const timer = setInterval(() => void vuelta(), CADA_MS);
  timer.unref?.();
  return timer;
}
