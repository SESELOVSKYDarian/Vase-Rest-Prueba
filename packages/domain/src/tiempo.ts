/** "hace 12 min", "hace 1 h 5 min": para mesas y pedidos abiertos. */
export function tiempoTranscurrido(desde: Date, ahora: number = Date.now()): string {
  const minutos = Math.max(0, Math.floor((ahora - desde.getTime()) / 60_000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) return resto === 0 ? `hace ${horas} h` : `hace ${horas} h ${resto} min`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
