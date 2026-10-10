// reel/cues.js: THE timeline. The page (reel.js) and the score (music/score.mjs) both read it, so every hit in the
// music lands on its frame. 120 BPM: a beat is 0.5 s, a bar 2 s. Cuts on beats; chapter changes on bars or beats.
var KCUE = (() => {
  const B = n => +(n * 0.5).toFixed(4);
  const S = { open: 0, plano: 3, qr: 8, avisos: 12, whats: 15, voz: 19, datos: 22, recap: 25, end: 27 };
  return {
    bpm: 120, fps: 30, dur: 31, B, S,
    CH: [['APERTURA', 0, 3], ['01 SALÓN', 3, 8], ['02 QR', 8, 12], ['03 AVISOS', 12, 15], ['04 WHATSAPP', 15, 19],
      ['05 VOZ', 19, 22], ['06 DATOS', 22, 25], ['CIERRE', 25, 31]],
    hits: {
      hook1: .5, hook2: 1.25, dot: 1.9, mark: 2.5,
      planoTitle: 3.1, mesas: [3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25],
      flips: [5.5, 6, 6.5], late: 6.5, mozo: 7, chips: [5.6, 5.85, 6.1],
      qrWords: [8.15, 8.65, 9.15], scan: 8.3, carta: 9.0, items: [9.25, 9.5, 9.75], split: 10.0, total: 10.3,
      recibo: 11.0, pagado: 11.5,
      lock: 12.1, notif1: 12.5, notif2: 13.4, avTitle: 12.2,
      waTitle: 15.1, bubbles: [15.5, 16.0, 16.6, 17.3, 17.8], cocina: 18.3,
      wave: 19.3, words: [19.6, 19.9, 20.2, 20.5], card: 20.8, confirm: 21.4,
      dTitle: 22.1, heat: 22.5, reparto: 23.5, sugerido: 24.2,
      tapes: 25.0,
      name: 27.1, tagline: 28.3, plats: [29.0, 29.2, 29.4, 29.6], glitch: 30.2, endDot: 30.45,
    },
  };
})();
if (typeof module !== 'undefined') module.exports = KCUE;
