import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mercado Pago (Checkout Pro). Solo se activa si el servidor tiene MP_ACCESS_TOKEN; sin credenciales
 * el cliente ni ve el botón. Variables: MP_ACCESS_TOKEN, PUBLIC_API_URL (donde Mercado Pago avisa
 * el pago), PUBLIC_WEB_URL (adonde vuelve el cliente), MP_WEBHOOK_SECRET (firma de los avisos).
 */
export const mpConfigurado = () => Boolean(process.env.MP_ACCESS_TOKEN);

async function mp(ruta, init = {}) {
  const r = await fetch(`https://api.mercadopago.com${ruta}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${cuerpo?.message ?? "error"}`);
  return cuerpo;
}

export async function crearPreferencia({ codigo, titulo, total, volverA }) {
  const publicaApi = String(process.env.PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  const cuerpo = {
    items: [{ title: titulo, quantity: 1, currency_id: "ARS", unit_price: total }],
    external_reference: codigo,
    expires: true,
    expiration_date_to: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...(publicaApi.startsWith("https://") ? { notification_url: `${publicaApi}/api/public/mp/webhook` } : {}),
    ...(volverA ? { back_urls: { success: volverA, failure: volverA, pending: volverA }, auto_return: "approved" } : {}),
  };
  const r = await mp("/checkout/preferences", { method: "POST", body: JSON.stringify(cuerpo) });
  return { id: r.id, link: r.init_point };
}

export const leerPagoMp = (id) => mp(`/v1/payments/${encodeURIComponent(id)}`);

/** Comprueba la firma `x-signature` de un aviso de Mercado Pago (si hay secreto configurado). */
export function firmaValida(req, dataId) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return true;
  const cabecera = String(req.headers["x-signature"] ?? "");
  const ts = /ts=(\d+)/.exec(cabecera)?.[1];
  const v1 = /v1=([a-f0-9]+)/.exec(cabecera)?.[1];
  if (!ts || !v1) return false;
  const manifiesto = `id:${String(dataId).toLowerCase()};request-id:${req.headers["x-request-id"] ?? ""};ts:${ts};`;
  const esperado = createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return esperado.length === v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
}
