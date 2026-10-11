// reel/cues.js: la línea de tiempo del reel vertical. La leen la imagen (reel.js) y la música (music/score.mjs).
// 128 BPM: un pulso = 0.46875 s, un compás = 1.875 s, 32 pulsos = 15 s. Todo se escribe en pulsos y se pasa a segundos.
var KCUE = (() => {
  const bpm = 128, BEAT = 60 / bpm, B = n => +(n * BEAT).toFixed(4);
  const b = {
    pills: [.25, .75, 1.25, 1.75, 2.25, 2.75, 3.25], collapse: 3.4, button: 3.75, tapBtn: 5.5,
    plano: 6, estados: [6.5, 7, 7.5], late: 8, mozos: 7.75, tapMesa: 9.5, dive: 10, carta: 10.5,
    items: [11, 11.5, 12, 12.5], send: 13.25, split: 14, seg: 14.5, pagar: 16, check: 16.25,
    island: 17.25, expand: 17.75, confirm: 19, toast: 19.5,
    wa: 20.25, bubbles: [20.75, 21.5, 22, 22.75, 23.25],
    voz: 24, typeA: 24.3, typeB: 25.2, card: 25.5, tapVoz: 26.5, listo: 26.75,
    end: 27.5, plats: 28.5,
  };
  const hits = {};
  for (const k in b) hits[k] = Array.isArray(b[k]) ? b[k].map(B) : B(b[k]);
  // titulares: [pulso, texto]
  const heads = [[0, 'Sábado, 21:40.'], [2, 'El salón\nexplota.'], [3.75, 'Respirá.'], [6, 'Ves todo el salón,\nen vivo.'],
    [10, 'Piden desde\nel QR.'], [14, 'Dividen y\npagan solos.'], [17, 'Te avisa\nal toque.'],
    [20.25, 'Reservan por\nWhatsApp.'], [24, 'Le hablás\ny lo hace.'], [27.5, 'El sábado,\nen orden.']].map(([n, s]) => [B(n), s]);
  return { bpm, BEAT, B, fps: 30, dur: 15, hits, heads };
})();
if (typeof module !== 'undefined') module.exports = KCUE;
