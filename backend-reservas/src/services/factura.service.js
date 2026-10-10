/**
 * Datos fiscales que pide el cliente para su factura. Acá solo se validan y ordenan: la emisión
 * real la hace el local en ARCA con sus credenciales (este sistema no inventa números ni CAE).
 */
export const CONDICIONES_IVA = ["consumidor_final", "responsable_inscripto", "monotributo", "exento"];
export const DOCUMENTOS = ["DNI", "CUIT", "CUIL"];

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** CUIT/CUIL de 11 dígitos con dígito verificador correcto (módulo 11). */
export function cuitValido(entrada) {
  const d = String(entrada ?? "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  const suma = PESOS_CUIT.reduce((s, peso, i) => s + peso * Number(d[i]), 0);
  const resto = suma % 11;
  const verificador = resto === 0 ? 0 : 11 - resto;
  return verificador !== 10 && verificador === Number(d[10]);
}

export const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** 20123456786 → 20-12345678-6 */
export const formatearCuit = (v) => soloDigitos(v).replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3");

/**
 * Qué factura corresponde: si el local es Responsable Inscripto emite A al RI y B al resto;
 * si es Monotributista emite siempre C.
 */
export function tipoSugerido(condicionReceptor, condicionEmisor = "responsable_inscripto") {
  if (condicionEmisor === "monotributo") return "C";
  return condicionReceptor === "responsable_inscripto" ? "A" : "B";
}

/** Valida y normaliza el pedido; devuelve { datos } o { error }. */
export function validarPedidoFactura(entrada, condicionEmisor = "responsable_inscripto") {
  const e = entrada && typeof entrada === "object" ? entrada : {};
  const condicion = String(e.condicionIva ?? "");
  if (!CONDICIONES_IVA.includes(condicion)) return { error: "Elegí tu condición frente al IVA." };
  const docTipo = String(e.docTipo ?? "");
  if (!DOCUMENTOS.includes(docTipo)) return { error: "Elegí el tipo de documento." };
  const doc = soloDigitos(e.docNumero);
  if (docTipo === "DNI" ? !(doc.length >= 7 && doc.length <= 8) : !cuitValido(doc)) {
    return { error: docTipo === "DNI" ? "El DNI debe tener 7 u 8 números." : "Revisá el CUIT/CUIL: no es válido." };
  }
  if (condicion === "responsable_inscripto" && docTipo !== "CUIT") return { error: "Un Responsable Inscripto se identifica con su CUIT." };
  const nombre = String(e.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (nombre.length < 3) return { error: "Escribí el nombre o la razón social." };
  const email = String(e.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Escribí un email válido para recibir la factura." };
  const domicilio = String(e.domicilio ?? "").trim().slice(0, 160);
  return {
    datos: {
      tipoComprobante: tipoSugerido(condicion, condicionEmisor),
      condicionIva: condicion,
      docTipo,
      docNumero: docTipo === "DNI" ? doc : formatearCuit(doc),
      nombre,
      email,
      domicilio,
    },
  };
}

const redondear = (n) => Math.round(n * 100) / 100;

/** IVA que ya viene dentro de un importe final con IVA 21 % (régimen de transparencia fiscal). */
export const ivaContenido = (importeFinal, alicuota = 21) => redondear((Number(importeFinal) * alicuota) / (100 + alicuota));

/**
 * Ticket para el cliente de un pago confirmado. NO es una factura: lo dice en la leyenda.
 * `cuenta` es la salida de armarCuenta; las unidades que cubrió este pago salen de `pago.detalle.unidades`.
 */
export function armarTicket({ pago, cuenta, config, mesaNumero, factura = null }) {
  const claves = new Set(pago.detalle?.unidades ?? []);
  const lineas = new Map();
  for (const u of cuenta.unidades) {
    if (!claves.has(u.clave)) continue;
    const previa = lineas.get(u.itemId);
    if (previa) { previa.cantidad += 1; previa.importe = redondear(previa.importe + u.importe); }
    else lineas.set(u.itemId, { nombre: u.nombre, cantidad: 1, importe: u.importe });
  }
  let items = [...lineas.values()];
  // En "partes" o "monto" no hay platos puntuales: se informa como porción de la cuenta.
  if (!items.length) {
    const etiqueta = pago.detalle?.modo === "partes" ? `Parte de la cuenta (1/${pago.detalle.partes})` : "Pago a cuenta";
    items = [{ nombre: etiqueta, cantidad: 1, importe: Number(pago.monto) }];
  }
  const monto = Number(pago.monto);
  const propina = Number(pago.propina);
  return {
    local: config.nombreLocal || "Restaurante",
    razonSocial: config.fiscal?.razonSocial ?? "",
    cuit: config.fiscal?.cuit ?? "",
    condicionIvaLocal: config.fiscal?.condicionIva ?? "",
    domicilio: config.fiscal?.domicilio ?? "",
    codigo: pago.codigo,
    mesa: mesaNumero ?? null,
    fecha: pago.pagado_en ?? pago.creado_en,
    metodo: pago.metodo,
    items,
    monto,
    propina,
    total: redondear(monto + propina),
    ivaContenido: ivaContenido(monto),
    leyenda: "Ticket no válido como factura. Si necesitás factura, pedila con tu código desde este mismo comprobante.",
    puedePedirFactura: config.fiscal?.pedirFactura !== false,
    condicionEmisor: config.fiscal?.condicionIva ?? "responsable_inscripto",
    factura,
  };
}
