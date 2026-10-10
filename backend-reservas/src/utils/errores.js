/** Error con código HTTP para devolver mensajes claros desde cualquier capa. */
export class ErrorHttp extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

/** Responde un error de forma uniforme: los ErrorHttp con su código, el resto como 500 sin filtrar detalles internos. */
export function responderError(res, error, mensajeGeneral = "No se pudo completar la operación") {
  if (error instanceof ErrorHttp) return res.status(error.status).json({ mensaje: error.message, ...error.extra });
  console.error(mensajeGeneral, error);
  return res.status(500).json({ mensaje: mensajeGeneral });
}
