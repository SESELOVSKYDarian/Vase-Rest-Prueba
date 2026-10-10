import { interpretarPedido } from "../ia/nlu.local.js";
import { plegar } from "../ia/texto.js";
import { entenderFecha, entenderHora, entenderNo, entenderPersonas, entenderRetiro, entenderSi, fechaArgentina, fechaLegible, hhmm } from "./entender.js";

/**
 * Conversación de WhatsApp: reservar una mesa y pedir para llevar. Es una máquina de estados pura:
 * recibe lo que escribió la persona y lo que ya se sabe, y devuelve qué contestar y cómo sigue.
 * Todo lo que toca la base (mesas libres, crear la reserva o el pedido) entra por `ctx`, así se prueba sin red.
 */
const dinero = (n) => `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(Number(n)))}`;
const pluralPersonas = (n) => `${n} ${n === 1 ? "persona" : "personas"}`;

export const SESION_VACIA = { estado: "inicio", datos: {} };

const MENU = (ctx, saludo = true) =>
  `${saludo ? `¡Hola! 👋 Soy el asistente de ${ctx.config.nombreLocal || "acá"}.` : "Te cuento qué puedo hacer:"}\n\n` +
  `1️⃣ Reservar una mesa\n2️⃣ Pedir para llevar\n3️⃣ Ver la carta\n\n` +
  `Podés escribirme directo, por ejemplo: *mesa para 4 mañana a las 21* o *quiero 2 milanesas para llevar*.`;

const limpiarNombre = (texto) => {
  const n = String(texto ?? "").trim().replace(/[^\p{L}\p{M}'’. -]/gu, "").replace(/\s+/g, " ").slice(0, 60).trim();
  return n.length >= 2 ? n.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase()) : null;
};

// ── Reserva ──────────────────────────────────────────────────────────────────
const PREGUNTA = {
  fecha: "¿Para qué día? Podés decirme *hoy*, *mañana*, *sábado* o una fecha como *17/10*.",
  hora: "¿A qué hora? Por ejemplo *21:00* o *a las 9 de la noche*.",
  personas: "¿Para cuántas personas?",
};

function leerSlots(texto, datos, esperando, hoy) {
  const r = { ...(datos.reserva ?? {}) };
  const f = entenderFecha(texto, hoy);
  const h = entenderHora(texto, { sola: esperando === "hora" });
  const p = entenderPersonas(texto, { sola: esperando === "personas" });
  if (f) r.fechaIso = f;
  if (h) r.hora = h;
  if (p) r.personas = p;
  return { reserva: r, entendio: Boolean(f || h || p) };
}

async function avanzarReserva(sesion, ctx, hoy, prefijo = []) {
  const r = sesion.datos.reserva ?? {};
  const falta = !r.fechaIso ? "fecha" : !r.hora ? "hora" : !r.personas ? "personas" : null;
  if (falta) return { sesion: { estado: `res_${falta}`, datos: sesion.datos }, respuestas: [...prefijo, PREGUNTA[falta]] };

  const problema = ctx.problemaDeHorario(r);
  if (problema) {
    const nuevo = { ...r };
    if (problema.campo === "cerrado") return { sesion: { estado: "inicio", datos: { ...sesion.datos, reserva: undefined } }, respuestas: [...prefijo, problema.mensaje] };
    delete nuevo[problema.campo];
    return { sesion: { estado: `res_${problema.campo}`, datos: { ...sesion.datos, reserva: nuevo } }, respuestas: [...prefijo, `${problema.mensaje}\n\n${PREGUNTA[problema.campo]}`] };
  }
  const { libres, alternativas } = await ctx.disponibilidad(r);
  const cuando = `${fechaLegible(r.fechaIso, hoy)} a las ${r.hora}`;
  if (!libres.length) {
    const nuevo = { ...r };
    delete nuevo.hora;
    const alt = alternativas.length
      ? `Ese día tengo lugar a las ${alternativas.join(", ")}. Decime una hora y la busco, o escribime otro día.`
      : "Ese día no me queda lugar cerca de esa hora. ¿Probamos otro día?";
    if (!alternativas.length) delete nuevo.fechaIso;
    return { sesion: { estado: alternativas.length ? "res_hora" : "res_fecha", datos: { ...sesion.datos, reserva: nuevo } }, respuestas: [...prefijo, `Uy, para ${pluralPersonas(r.personas)} ${cuando} no me queda mesa. 😕\n\n${alt}`] };
  }
  const mejor = libres[0];
  const link = await ctx.enlacePlano(r);
  return {
    sesion: { estado: "res_confirmar", datos: { ...sesion.datos, reserva: r } },
    respuestas: [
      ...prefijo,
      `¡Tengo mesa! 🎉 Sería la *mesa ${mejor.numero}* (${mejor.zona}, para ${mejor.capacidad}) ${cuando} para ${pluralPersonas(r.personas)}.\n\n` +
        `Respondé *sí* para reservarla, o elegí tu mesa mirando el plano del local:\n${link}\n\n` +
        `Si querés cambiar el día, la hora o la cantidad, escribímelo.`,
    ],
  };
}

function pedirNombre(ctx, datos) {
  const sugerido = ctx.nombrePerfil || datos.nombreGuardado;
  return sugerido ? `¿A nombre de quién? Respondé *sí* para dejarlo a nombre de ${sugerido}, o escribime otro nombre.` : "¿A nombre de quién lo dejo?";
}

function nombreDe(texto, ctx, datos) {
  const sugerido = ctx.nombrePerfil || datos.nombreGuardado;
  if (entenderSi(texto) && sugerido) return sugerido;
  if (/^\d+$/.test(texto.trim())) return null;
  return limpiarNombre(texto);
}

// ── Pedido para llevar ───────────────────────────────────────────────────────
function resumenCarrito(items, total) {
  const lineas = items.map((i) => `• ${i.cantidad} × ${i.nombre}${i.notas ? ` (${i.notas})` : ""} — ${dinero(i.subtotal)}`);
  return `${lineas.join("\n")}\n*Total: ${dinero(total)}*`;
}

function agregarAlCarrito(carrito, lineas) {
  const nuevo = carrito.map((l) => ({ ...l }));
  for (const l of lineas) {
    const igual = nuevo.find((x) => x.productoId === l.productoId && (x.notas || "") === (l.notas || ""));
    if (igual) igual.cantidad += l.cantidad;
    else nuevo.push({ productoId: l.productoId, cantidad: l.cantidad, notas: l.notas || "" });
  }
  return nuevo;
}

const unidades = (carrito) => carrito.reduce((s, l) => s + l.cantidad, 0);

async function recibirItems(sesion, texto, ctx) {
  const carrito = sesion.datos.carrito ?? [];
  const { lineas, noEntendido } = interpretarPedido(texto, ctx.indice);
  const avisos = [];
  const buenas = [];
  for (const l of lineas) {
    if (l.agotado) { avisos.push(`😕 *${l.nombre}* está agotado por hoy.`); continue; }
    if (l.ambiguo && l.alternativas.length) avisos.push(`Anoté *${l.nombre}*. Si querías ${l.alternativas.map((a) => `*${a.nombre}*`).join(" o ")}, decímelo.`);
    buenas.push(l);
  }
  if (noEntendido.length) avisos.push(`No encontré «${noEntendido.join("», «")}» en la carta. Probá con otro nombre o mirá la carta: ${ctx.linkCarta}`);
  const nuevo = agregarAlCarrito(carrito, buenas);
  if (unidades(nuevo) > ctx.config.llevar.maxUnidades) {
    return { sesion, respuestas: [`Para pedidos de más de ${ctx.config.llevar.maxUnidades} unidades coordinamos directo con el local. 🙏`] };
  }
  if (!buenas.length) {
    return { sesion: { estado: "llevar_items", datos: { ...sesion.datos, carrito } }, respuestas: [avisos.join("\n\n") || "No entendí qué querés pedir. Escribilo así: *2 milanesas napolitanas y una cerveza*."] };
  }
  const { items, total } = await ctx.precios(nuevo);
  return {
    sesion: { estado: "llevar_items", datos: { ...sesion.datos, carrito: nuevo } },
    respuestas: [`${resumenCarrito(items, total)}\n\n¿Algo más? Escribilo, o decime *listo* para seguir. *borrar* para empezar de nuevo.`, ...(avisos.length ? [avisos.join("\n\n")] : [])],
  };
}

function enterarRetiro(texto, ctx, hoy) {
  const minimo = hoy.minutos + ctx.config.llevar.demoraMin;
  const pedido = entenderRetiro(texto, hoy.minutos);
  if (pedido == null) return { error: "No te entendí la hora. Probá con *en 30 minutos* o *21:15*." };
  if (pedido > hoy.minutos + 8 * 60) return { error: "Tomamos pedidos para retirar dentro de las próximas 8 horas. ¿A qué hora te queda bien?" };
  return pedido < minimo ? { minutos: minimo, ajustado: true } : { minutos: pedido, ajustado: false };
}

// ── Entrada ──────────────────────────────────────────────────────────────────
/**
 * @param {{estado: string, datos: object}} sesion
 * @param {string} texto lo que escribió la persona
 * @param {object} ctx dependencias (config, indice, ahora, disponibilidad, reservar, precios, pedirLlevar…)
 */
export async function responder(sesion, texto, ctx) {
  const entrada = String(texto ?? "").trim().slice(0, 600);
  const plano = plegar(entrada);
  const hoy = fechaArgentina(ctx.ahora);
  let datos = sesion.datos ?? {};
  let estado = sesion.estado ?? "inicio";
  // Si en medio de un trámite pide claramente otra cosa, se cambia de tema en vez de insistir con la pregunta.
  const cambiaDeTema = (estado.startsWith("res_") && /\b(para llevar|para retirar|take ?away)\b/.test(plano)) || (estado.startsWith("llevar_") && /\b(reservar|quiero una mesa|mesa para|una reserva)\b/.test(plano));
  if (cambiaDeTema) { estado = "inicio"; datos = { nombreGuardado: datos.nombreGuardado }; sesion = { estado, datos }; }
  const base = (extra = {}) => ({ estado: "inicio", datos: { nombreGuardado: datos.nombreGuardado, ...extra } });

  if (!entrada) return { sesion, respuestas: ["Solo puedo leer mensajes de texto por ahora. Escribime lo que necesitás. 🙂"] };

  // Comandos que valen en cualquier momento.
  if (/^(menu|inicio|volver|empezar|reiniciar|salir)\b/.test(plano) || (estado === "inicio" && /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ayuda|help)\b/.test(plano))) {
    return { sesion: base(), respuestas: [MENU(ctx, !/^(menu|ayuda|help)/.test(plano))] };
  }
  if (/^cancelar\s+(mi\s+)?reserva/.test(plano)) {
    const n = await ctx.cancelarReservas();
    return { sesion: base(), respuestas: [n ? `Listo, cancelé ${n === 1 ? "tu reserva" : `tus ${n} reservas`}. Gracias por avisar. 🙏` : "No encontré reservas a tu nombre para cancelar."] };
  }
  if (estado !== "inicio" && /^(cancelar|cancela|cancelalo|dejalo|olvidalo|no quiero)\b/.test(plano) && !["res_confirmar", "llevar_confirmar"].includes(estado)) {
    return { sesion: base(), respuestas: ["Listo, lo dejamos acá. Escribí *menu* cuando quieras volver a empezar. 🙂"] };
  }
  if (/^(carta|menu del dia|ver carta)\b/.test(plano) || (estado === "inicio" && plano === "3")) {
    return { sesion: sesion.estado === "inicio" ? base() : sesion, respuestas: [`Esta es nuestra carta: ${ctx.linkCarta}`] };
  }

  // Elegir qué hacer.
  if (estado === "inicio") {
    const quiereLlevar = plano === "2" || /\b(llevar|retirar|retiro|take ?away|para llevar|delivery|envio)\b/.test(plano);
    const quiereReservar = plano === "1" || /\b(reserv\w*|mesa|lugar para|somos)\b/.test(plano);
    if (quiereLlevar && !quiereReservar) {
      if (!ctx.config.llevar.activo) return { sesion: base(), respuestas: ["Por ahora no tomamos pedidos para llevar por acá. Escribí *1* si querés reservar una mesa. 🙂"] };
      if (/\b(delivery|envio)\b/.test(plano) && !/\b(llevar|retirar|retiro)\b/.test(plano)) {
        return { sesion: base(), respuestas: ["Por ahora no hacemos envíos: el pedido se retira en el local. ¿Querés armarlo igual? Escribí *2*."] };
      }
      const arranque = { sesion: { estado: "llevar_items", datos: { ...base().datos, carrito: [] } }, respuestas: [] };
      const intro = `Dale, armemos tu pedido para retirar. 🛍️ Escribime lo que querés, por ejemplo: *2 milanesas napolitanas y una cerveza*.\nLa carta está acá: ${ctx.linkCarta}`;
      const sinFrase = entrada.replace(/\b(quiero|quisiera|necesito|me das|dame|pedir|hacer|un pedido|el pedido|para llevar|para retirar|llevar|retirar|take ?away)\b/gi, " ");
      if (plano !== "2" && interpretarPedido(sinFrase, ctx.indice).lineas.length) return recibirItems(arranque.sesion, sinFrase, ctx);
      return { sesion: arranque.sesion, respuestas: [intro] };
    }
    if (quiereReservar) {
      if (!ctx.config.reservas.activas) return { sesion: base(), respuestas: ["Por ahora no tomamos reservas por este medio. Llamanos o pasá por el local. 🙏"] };
      const { reserva } = leerSlots(plano === "1" ? "" : entrada, base(), null, hoy);
      const sesionRes = { estado: "res_fecha", datos: { ...base().datos, reserva } };
      return avanzarReserva(sesionRes, ctx, hoy, [Object.keys(reserva).length ? "¡Perfecto! Vamos con tu reserva. 📅" : "¡Dale! Vamos con tu reserva. 📅"]);
    }
    return { sesion: base(), respuestas: [`No estoy seguro de qué necesitás. 🤔\n\n${MENU(ctx, false)}`] };
  }

  // Reserva en curso.
  if (["res_fecha", "res_hora", "res_personas", "res_cambiar"].includes(estado) || (estado === "res_confirmar" && !entenderSi(entrada) && !entenderNo(entrada))) {
    const esperando = estado.startsWith("res_") ? estado.slice(4) : null;
    const { reserva, entendio } = leerSlots(entrada, sesion.datos, esperando, hoy);
    if (!entendio) {
      const pregunta = PREGUNTA[esperando] ?? "Decime el día, la hora o cuántas personas.";
      return { sesion, respuestas: [`No te entendí. ${pregunta}`] };
    }
    return avanzarReserva({ estado, datos: { ...datos, reserva } }, ctx, hoy);
  }
  if (estado === "res_confirmar") {
    if (entenderNo(entrada)) {
      return { sesion: { estado: "res_cambiar", datos }, respuestas: ["Sin problema. Decime el nuevo día, hora o cantidad de personas, o escribí *menu* para salir."] };
    }
    return { sesion: { estado: "res_nombre", datos }, respuestas: [pedirNombre(ctx, datos)] };
  }
  if (estado === "res_nombre") {
    const nombre = nombreDe(entrada, ctx, datos);
    if (!nombre) return { sesion, respuestas: ["No pude leer el nombre. Escribilo de nuevo, por favor."] };
    try {
      const { mesa, reserva } = await ctx.reservar({ ...datos.reserva, nombre });
      return {
        sesion: base({ nombreGuardado: nombre }),
        respuestas: [
          `¡Listo, ${nombre}! ✅ Pedí tu reserva: *mesa ${mesa.numero}*, ${fechaLegible(datos.reserva.fechaIso, hoy)} a las ${datos.reserva.hora}, ${pluralPersonas(datos.reserva.personas)}.\n\n` +
            `El local la confirma en breve y te aviso por acá. Si no podés venir, escribime *cancelar reserva*. (Código ${String(reserva.id).slice(0, 4).toUpperCase()})`,
        ],
      };
    } catch (error) {
      const mensaje = error?.status ? error.message : "No pude guardar la reserva. Probá de nuevo en un rato.";
      return avanzarReserva({ estado: "res_hora", datos: { ...datos, reserva: { ...datos.reserva, hora: undefined } } }, ctx, hoy, [mensaje]);
    }
  }

  // Pedido para llevar en curso.
  if (estado === "llevar_items") {
    if (/^(borrar|vaciar|empezar de nuevo|reiniciar|limpiar)\b/.test(plano)) {
      return { sesion: { estado: "llevar_items", datos: { ...datos, carrito: [] } }, respuestas: ["Borré todo. Escribime qué querés pedir. 🙂"] };
    }
    if (/^(listo|nada mas|eso es todo|ya esta|eso nomas|eso seria todo|confirmar|seguir|continuar|termine)\b/.test(plano)) {
      if (!(datos.carrito ?? []).length) return { sesion, respuestas: ["Todavía no anoté nada. Escribime qué querés pedir, por ejemplo *2 milanesas napolitanas*."] };
      return { sesion: { estado: "llevar_nombre", datos }, respuestas: [pedirNombre(ctx, datos)] };
    }
    return recibirItems(sesion, entrada, ctx);
  }
  if (estado === "llevar_nombre") {
    const nombre = nombreDe(entrada, ctx, datos);
    if (!nombre) return { sesion, respuestas: ["No pude leer el nombre. Escribilo de nuevo, por favor."] };
    const minimo = hoy.minutos + ctx.config.llevar.demoraMin;
    return { sesion: { estado: "llevar_retiro", datos: { ...datos, nombreCliente: nombre } }, respuestas: [`Gracias, ${nombre}. ¿A qué hora lo retirás? Por ejemplo *en 30 minutos* o *21:15*. Lo más pronto es a las ${hhmm(minimo)}.`] };
  }
  if (estado === "llevar_retiro") {
    const r = enterarRetiro(entrada, ctx, hoy);
    if (r.error) return { sesion, respuestas: [r.error] };
    const { items, total } = await ctx.precios(datos.carrito);
    return {
      sesion: { estado: "llevar_confirmar", datos: { ...datos, retiroMin: r.minutos } },
      respuestas: [
        `${r.ajustado ? `Lo más pronto es a las ${hhmm(r.minutos)}, así que lo dejo para esa hora.\n\n` : ""}Revisá tu pedido:\n\n${resumenCarrito(items, total)}\n\nRetira *${datos.nombreCliente}* a las *${hhmm(r.minutos)}*. Se paga en el local.\n\n¿Lo confirmo? Respondé *sí* o *no*.`,
      ],
    };
  }
  if (estado === "llevar_confirmar") {
    if (entenderNo(entrada)) return { sesion: { estado: "llevar_items", datos }, respuestas: ["Sin problema. Escribime qué querés agregar, *borrar* para empezar de nuevo o *menu* para salir."] };
    if (!entenderSi(entrada)) return { sesion, respuestas: ["¿Lo confirmo? Respondé *sí* o *no*."] };
    try {
      const { codigo, total, omitidos } = await ctx.pedirLlevar({ nombre: datos.nombreCliente, retiroMin: datos.retiroMin, carrito: datos.carrito });
      return {
        sesion: base({ nombreGuardado: datos.nombreCliente }),
        respuestas: [
          `¡Pedido recibido! 🙌 Ya está en cocina. Código *#${codigo}*.\nRetirás a las *${hhmm(datos.retiroMin)}* y pagás ${dinero(total)} en el local. Te aviso por acá cuando esté listo.` +
            (omitidos?.length ? `\n\n⚠️ No pude anotar: ${omitidos.join(", ")}.` : ""),
        ],
      };
    } catch (error) {
      const mensaje = error?.status ? error.message : "No pude enviar el pedido a cocina. Probá de nuevo en un rato.";
      return { sesion: { estado: "llevar_items", datos }, respuestas: [`${mensaje}\n\nPodés cambiar el pedido o escribir *listo* para reintentar.`] };
    }
  }

  return { sesion: base(), respuestas: [MENU(ctx, false)] };
}
