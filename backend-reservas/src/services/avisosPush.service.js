import { pool } from "../config/database.js";
import { enviarAviso, reclamarAviso } from "./push.service.js";
import { enviarTexto } from "./whatsapp/whatsapp.service.js";

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

async function reservasNuevas() {
  const r = await pool.query(
    `select r.id, r.nombre_cliente, r.cantidad_personas, r.fecha_hora_inicio, m.numero from reservas r left join mesas m on m.id = r.mesa_id
      where r.estado::text = 'pendiente' and r.creado_en > now() - interval '${VENTANA}'`,
  );
  for (const f of r.rows) {
    if (!(await reclamarAviso(`res:${f.id}`))) continue;
    const hora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(f.fecha_hora_inicio));
    await enviarAviso({ roles: ["encargado", "cajero", "mozo"], titulo: `Reserva nueva · ${f.cantidad_personas} p. · ${hora}`, cuerpo: `${f.nombre_cliente}${f.numero ? ` · mesa ${f.numero}` : ""}. Confirmala para avisarle.`, data: { tipo: "reserva" } });
  }
}

async function pedidosParaLlevar() {
  const r = await pool.query(
    `select p.id, p.estado, p.estado_desde, p.cliente_nombre, p.cliente_telefono, p.origen, p.total, p.retiro_para
       from pedidos p where p.tipo = 'llevar' and p.estado in ('pendiente', 'listo') and p.estado_desde > now() - interval '${VENTANA}'`,
  );
  for (const f of r.rows) {
    const codigo = String(f.id).slice(-4).toUpperCase();
    if (f.estado === "pendiente" && (await reclamarAviso(`llevar:${f.id}`))) {
      const hora = f.retiro_para ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(f.retiro_para)) : "";
      await enviarAviso({ roles: ["encargado", "cajero", "mozo"], titulo: `Pedido para llevar #${codigo}${hora ? ` · retira ${hora}` : ""}`, cuerpo: `${f.cliente_nombre ?? "Cliente"} · ${dinero(f.total)}. Ya está en cocina.`, data: { tipo: "llevar" } });
    }
    // Cuando cocina lo marca listo, la persona se entera por el mismo chat.
    if (f.estado === "listo" && f.origen === "whatsapp" && f.cliente_telefono && (await reclamarAviso(`llevar-listo:${f.id}`))) {
      await enviarTexto(f.cliente_telefono, `¡Tu pedido #${codigo} está listo para retirar! 🙌 Te esperamos${f.cliente_nombre ? `, ${f.cliente_nombre}` : ""}. Se paga en el local (${dinero(f.total)}).`);
    }
  }
}

let corriendo = false;
async function vuelta() {
  if (corriendo) return;
  corriendo = true;
  try {
    // Los avisos al celular del personal solo corren si hay celulares registrados.
    const hay = await pool.query("select 1 from dispositivos_push limit 1");
    if (hay.rowCount) {
      await pedidosListos();
      await solicitudesDeMesa();
      await transferenciasPendientes();
      await pedidosDeFactura();
      await reservasNuevas();
    }
    // Pedidos para llevar: aviso al personal y, cuando están listos, al cliente por WhatsApp.
    await pedidosParaLlevar();
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
