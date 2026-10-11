// reel/reel.js: reel vertical de Vase Rest (1080×1920, 15 s). Estilo "morph de UI": una sola forma que nunca corta;
// cada estado es la misma pieza cambiando tamaño, radio y color mientras su contenido se cambia con un blur corto.
// Cada cuadro es una función pura de t: los resortes son respuestas al escalón en forma cerrada, sumadas por cambio.
// Contrato con render.mjs: window.ready, window.DUR, window.renderAt(t, type, q), window.renderSheet(...), window.gpuInfo().
'use strict';
const W = 1080, H = 1920, C = KCUE, Hh = C.hits, B = C.B, BEAT = C.BEAT;
window.DUR = C.dur; window.PROJECT = { audio: 'assets/score.m4a' };
const out = document.getElementById('out'), octx = out.getContext('2d');
const FR = document.createElement('canvas'); FR.width = W; FR.height = H; const x = FR.getContext('2d');

// ---------- paleta: lienzo gris cálido, componentes en negro y blanco, un solo acento (el verde de la marca) ----------
const BG = '#ECE9E4', INK = '#111111', GREY = '#8A8781', LINE = '#D6D1C9', SOFT = '#F6F4F0', GREEN = '#177A4E', MINT = '#4CC38A', GTINT = '#E2F0E8';
const RGB = { ink: [17, 17, 17], white: [255, 255, 255], green: [23, 122, 78] };
const ui = (w, px) => `${w} ${px}px "Inter"`, mono = (px, w = 400) => `${w} ${px}px "JetBrains Mono"`;

// ---------- matemática ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a)), eo = v => 1 - Math.pow(1 - clamp(v), 3);
const eio = v => { v = clamp(v); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function spring(t, w = 17, z = .82) {   // respuesta al escalón de un resorte subamortiguado: overshoot chiquito
  if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
const track = (keys, w, z) => t => { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], w, z); return v; };
// visibilidad de un contenido entre a y b: entra y sale con fundido + blur
const vis = (t, a, b, d = .16) => Math.max(0, Math.min(eo((t - a) / d), 1 - eo((t - b) / d)));

// ---------- dibujo ----------
function rr(x0, y0, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); x.beginPath(); x.roundRect(x0, y0, Math.max(0, w), Math.max(0, h), r); }
function txt(s, x0, y0, o = {}) {
  x.save(); x.font = o.font || ui(600, 32); x.fillStyle = o.fill || INK; x.textAlign = o.align || 'left'; x.textBaseline = 'alphabetic';
  x.letterSpacing = (o.ls || 0) + 'px'; if (o.alpha != null) x.globalAlpha *= o.alpha; x.fillText(s, x0, y0); x.restore();
}
function tw(s, font, ls = 0) { x.save(); x.font = font; x.letterSpacing = ls + 'px'; const w = x.measureText(s).width; x.restore(); return w; }
function fx(k, fn, dy = 0) {   // contenido que entra/sale con fundido, blur corto y un leve desplazamiento
  if (k <= .001) return; x.save(); x.globalAlpha *= k; if (k < .999) x.filter = `blur(${((1 - k) * 12).toFixed(1)}px)`;
  if (dy) x.translate(0, dy * (1 - k)); fn(); x.restore();
}
function circle(cx, cy, r, o = {}) { if (r <= 0) return; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); if (o.fill) { x.fillStyle = o.fill; x.fill(); } if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = o.lw || 2; x.stroke(); } }
function poly(pts, p, color, lw) {   // polilínea dibujada hasta la fracción p de su largo
  const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let left = tot * clamp(p); x.beginPath(); x.moveTo(...pts[0]);
  for (let i = 1; i < pts.length && left > 0; i++) { const k = Math.min(1, left / L[i - 1]); x.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= L[i - 1]; }
  x.strokeStyle = color; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke();
}
const peso = n => '$ ' + Math.round(n).toLocaleString('es-AR');
const press = (t, t0) => 1 - .035 * Math.exp(-Math.pow((t - t0 - .02) / .07, 2));   // botón que se hunde al tocarlo

// ---------- la forma: una sola pieza para todo el reel ----------
const SH = [   // [t, cx, cy, w, h, radio, color]
  [0, 540, 1000, 0, 0, 0, RGB.ink],
  [Hh.button, 540, 1000, 660, 150, 75, RGB.ink],
  [Hh.tapBtn, 540, 1000, 630, 142, 71, RGB.ink], [Hh.tapBtn + .12, 540, 1000, 660, 150, 75, RGB.ink],
  [Hh.plano, 540, 1010, 920, 920, 56, RGB.white],
  [Hh.dive, 540, 1030, 164, 164, 82, RGB.green],
  [Hh.carta, 540, 1040, 680, 1040, 72, RGB.white],
  [Hh.check, 540, 1000, 300, 300, 150, RGB.green],
  [Hh.island, 540, 940, 560, 120, 60, RGB.ink],
  [Hh.expand, 540, 960, 900, 440, 64, RGB.ink],
  [Hh.toast, 540, 960, 680, 130, 65, RGB.green],
  [Hh.wa, 540, 1040, 900, 980, 56, RGB.white],
  [Hh.voz, 540, 1000, 820, 180, 90, RGB.ink],
  [Hh.card, 540, 1010, 900, 640, 56, RGB.white],
  [Hh.end, 540, 1000, 700, 170, 85, RGB.ink],
];
const shTracks = [1, 2, 3, 4, 5].map(i => track(SH.map(k => [k[0], k[i]]), 17, .84));
const colTracks = [0, 1, 2].map(c => track(SH.map(k => [k[0], k[6][c]]), 20, .95));
function shape(t) {
  const [cx, cy, w, h, r] = shTracks.map(f => f(t)), col = colTracks.map(f => Math.round(clamp(f(t), 0, 255)));
  return { cx, cy, w: Math.max(0, w), h: Math.max(0, h), r: Math.max(0, r), fill: `rgb(${col})`, x0: cx - w / 2, y0: cy - h / 2 };
}

// ---------- el dedo (toques reales sobre cada control) ----------
const TOUCH = [
  [0, 780, 1340], [Hh.tapBtn - .55, 780, 1340], [Hh.tapBtn - .25, 600, 1010],
  [Hh.tapMesa - .5, 600, 1060], [Hh.tapMesa - .2, 560, 1040],
  [Hh.items[0] - .3, 810, 768], [Hh.items[1] - .3, 810, 898], [Hh.items[2] - .3, 810, 1028], [Hh.items[3] - .3, 810, 1158],
  [Hh.send - .35, 560, 1470], [Hh.seg - .3, 740, 766], [Hh.pagar - .45, 560, 1470],
  [Hh.confirm - .5, 755, 1088], [Hh.tapVoz - .5, 540, 1240],
];
const tX = track(TOUCH.map(k => [k[0], k[1]]), 13, .9), tY = track(TOUCH.map(k => [k[0], k[2]]), 13, .9);
const TAPS = [Hh.tapBtn, Hh.tapMesa, ...Hh.items, Hh.send, Hh.seg, Hh.pagar, Hh.confirm, Hh.tapVoz];
const TWIN = [[Hh.tapBtn - .7, Hh.tapBtn + .45], [Hh.tapMesa - .7, Hh.tapMesa + .35], [Hh.items[0] - .5, Hh.send + .4],
  [Hh.seg - .5, Hh.pagar + .3], [Hh.confirm - .7, Hh.confirm + .4], [Hh.tapVoz - .7, Hh.tapVoz + .4]];
function touch(t) {
  const a = Math.max(...TWIN.map(([p, q]) => vis(t, p, q, .18))); if (a <= 0) return;
  const px = tX(t), py = tY(t); let sc = 1;
  for (const t0 of TAPS) {
    const d = t - t0; sc -= .24 * Math.exp(-Math.pow(d / .08, 2));
    if (d >= 0 && d < .45) circle(px, py, 36 + 70 * eo(d / .45), { stroke: `rgba(17,17,17,${(.35 * (1 - d / .45) * a).toFixed(3)})`, lw: 3 });
  }
  x.save(); x.globalAlpha = a; circle(px, py, 34 * sc, { fill: 'rgba(17,17,17,.24)', stroke: 'rgba(255,255,255,.95)', lw: 4 }); x.restore();
}

// ---------- titulares ----------
function headline(t) {
  const L = C.heads;
  for (let i = 0; i < L.length; i++) {
    const [a, s] = L[i], b = i + 1 < L.length ? L[i + 1][0] : 99, k = vis(t, a, b, .2); if (k <= 0) continue;
    const font = ui(700, 108), lines = s.split('\n');
    lines.forEach((ln, j) => { const kj = vis(t, a + j * .06, b, .2); fx(kj, () => txt(ln, 540, 330 + j * 114, { font, align: 'center', ls: -4 }), t < a + .4 ? 34 : -34); });
  }
}

// ---------- escenas ----------
const PILLS = [['Mesa 3 pide la cuenta', 380, 700, -5], ['¿Queda bife?', 730, 820, 4], ['Reserva para 6 · 21:30', 470, 950, -2],
  ['Mesa 7 quiere pedir', 690, 1080, 6], ['La 5 espera hace 10 min', 410, 1210, -4], ['Pedido para llevar', 700, 1340, 3], ['¿Quién atiende la 9?', 460, 1460, -6]];
function caos(t) {
  if (t > Hh.button + .2) return;
  const c = eio(seg(t, Hh.collapse, Hh.button)), jit = 4 * seg(t, 0, Hh.collapse);
  PILLS.forEach(([s, px, py, rot], i) => {
    const ta = Hh.pills[i], k = spring(t - ta, 20, .6); if (k <= 0) return;
    const f = ui(600, 36), w = tw(s, f) + 96, h = 100;
    const cx = lerp(px + Math.sin(t * 29 + i * 7) * jit, 540, c), cy = lerp(py + Math.cos(t * 23 + i * 3) * jit, 1000, c);
    x.save(); x.translate(cx, cy); x.rotate((rot + Math.sin(t * 11 + i) * jit * .4) * Math.PI / 180 * (1 - c)); x.scale(k * (1 - .85 * c), k * (1 - .85 * c));
    x.globalAlpha = clamp(k) * (1 - c);
    x.shadowColor = 'rgba(40,30,20,.12)'; x.shadowBlur = 30; x.shadowOffsetY = 12; rr(-w / 2, -h / 2, w, h, 50); x.fillStyle = '#fff'; x.fill(); x.shadowColor = 'transparent';
    circle(-w / 2 + 40, 0, 9, { fill: i === 4 ? GREEN : INK }); txt(s, -w / 2 + 64, 13, { font: f });
    x.restore();
  });
}

function boton(t) {
  fx(vis(t, Hh.button + .1, Hh.plano, .14), () => {
    const s = 'Abrir Vase Rest', f = ui(600, 44), w = tw(s, f) + 38, x0 = 540 - w / 2;
    circle(x0 + 11, 1000, 11, { fill: MINT }); txt(s, x0 + 38, 1016, { font: f, fill: '#fff' });
  });
}

const MESAS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ n: i + 1, cx: 260 + 280 * (i % 3), cy: 780 + 250 * Math.floor(i / 3) }));
const CAMBIOS = [[Hh.estados[0], [0, 2, 6, 4], 'ocupada'], [Hh.estados[1], [1, 8], 'ocupada'], [Hh.estados[1], [3], 'lista'],
  [Hh.estados[2], [5, 7], 'ocupada'], [Hh.late, [4], 'lista']];
function estadoMesa(i, t) { let e = 'libre', tc = -9; for (const [tt, ids, s] of CAMBIOS) if (t >= tt && ids.includes(i)) { e = s; tc = tt; } return [e, tc]; }
function mesa(m, t) {
  const [e, tc] = estadoMesa(m.n - 1, t), pop = 1 + .1 * Math.sin(Math.PI * seg(t, tc, tc + .28)), r = 72 * pop;
  const chair = e === 'libre' ? LINE : '#BDB7AD';
  for (let a = 0; a < 4; a++) {
    const ang = Math.PI / 4 + a * Math.PI / 2; x.save(); x.translate(m.cx + Math.cos(ang) * (r + 14), m.cy + Math.sin(ang) * (r + 14)); x.rotate(ang + Math.PI / 2);
    rr(-19, -11, 38, 22, 9); x.fillStyle = chair; x.fill(); x.restore();
  }
  if (e === 'lista' && m.n === 5 && t > Hh.late) {
    const ph = ((t - Hh.late) / BEAT) % 1; circle(m.cx, m.cy, 82 + 52 * ph, { stroke: `rgba(23,122,78,${(.55 * (1 - ph)).toFixed(3)})`, lw: 6 });
  }
  circle(m.cx, m.cy, r, e === 'libre' ? { fill: SOFT, stroke: LINE, lw: 3 } : { fill: e === 'lista' ? GREEN : INK });
  txt(String(m.n), m.cx, m.cy + 16, { font: ui(700, 46), fill: e === 'libre' ? GREY : '#fff', align: 'center' });
}
function plano(t) {
  fx(vis(t, Hh.plano + .12, Hh.dive - .05, .18), () => {
    txt('SALÓN · EN VIVO', 130, 612, { font: mono(24, 700), fill: GREY, ls: 2 }); txt('9 MESAS', 950, 612, { font: mono(24, 700), fill: GREY, ls: 2, align: 'right' });
    x.fillStyle = LINE; x.fillRect(130, 640, 820, 2);
    MESAS.forEach(m => mesa(m, t));
    [[0, 'AP'], [4, 'LR'], [8, 'AP']].forEach(([i, s], j) => {
      const k = spring(t - Hh.mozos - j * .08, 22, .8); if (k <= 0) return; const m = MESAS[i];
      x.save(); x.translate(m.cx + 58, m.cy - 58); x.scale(k, k); circle(0, 0, 26, { fill: '#fff', stroke: INK, lw: 3 });
      txt(s, 0, 7, { font: mono(18, 700), align: 'center' }); x.restore();
    });
    const k = eo(seg(t, Hh.late + .1, Hh.late + .35));
    if (k > 0) {
      const s = 'MESA 5 · LISTA HACE 7 MIN', f = mono(24, 700), w = tw(s, f, 1) + 44;
      x.save(); x.globalAlpha *= k; x.translate(0, (1 - k) * 12); rr(540 - w / 2, 1128, w, 52, 10); x.fillStyle = INK; x.fill();
      txt(s, 540, 1163, { font: f, fill: '#fff', align: 'center', ls: 1 }); x.restore();
    }
  });
}

const PLATOS = [['Milanesa napolitana', 9800], ['Papas fritas', 4200], ['Limonada', 3500], ['Flan con dulce', 3900]];
function carta(t) {
  fx(vis(t, Hh.carta + .14, Hh.split, .16), () => {
    txt('MESA 5 · CARTA', 250, 600, { font: mono(22, 700), fill: GREY, ls: 2 }); txt('¿Qué van a pedir?', 250, 664, { font: ui(700, 46) });
    let n = 0, sum = 0;
    PLATOS.forEach(([s, p], i) => {
      const y0 = 770 + i * 130, on = t > Hh.items[i] + .04; if (on) { n++; sum += p; }
      txt(s, 250, y0, { font: ui(600, 34) }); txt(peso(p), 250, y0 + 40, { font: mono(26), fill: GREY });
      x.fillStyle = LINE; x.fillRect(250, y0 + 72, 580, 2);
      const pp = 1 + .14 * Math.sin(Math.PI * seg(t, Hh.items[i], Hh.items[i] + .25));
      circle(810, y0 - 2, 34 * pp, { fill: on ? GREEN : INK }); txt(on ? '1' : '+', 810, y0 + (on ? 10 : 12), { font: ui(700, on ? 32 : 40), fill: '#fff', align: 'center' });
    });
    const sent = t > Hh.send + .05, sc = press(t, Hh.send);
    x.save(); x.translate(540, 1470); x.scale(sc, sc); rr(-300, -50, 600, 100, 50); x.fillStyle = sent ? GREEN : INK; x.fill();
    txt(sent ? 'Enviado · lo confirma el mozo' : n ? `Enviar pedido · ${peso(sum)}` : 'Elegí tus platos', 0, 11, { font: ui(600, 32), fill: '#fff', align: 'center' }); x.restore();
  });
}
function dividir(t) {
  fx(vis(t, Hh.split + .06, Hh.pagar + .12, .16), () => {
    txt('TU CUENTA · MESA 5', 250, 600, { font: mono(22, 700), fill: GREY, ls: 2 }); txt('¿Cómo dividimos?', 250, 664, { font: ui(700, 46) });
    rr(240, 720, 600, 92, 46); x.fillStyle = '#EFECE7'; x.fill();
    const L = lerp(244, 644, spring(t - Hh.seg, 12, .92)), R = lerp(436, 836, spring(t - Hh.seg, 22, .8));
    rr(L, 724, R - L, 84, 42); x.fillStyle = INK; x.fill();
    [['Todo', 340], ['Partes', 540], ['Lo mío', 740]].forEach(([s, c]) => txt(s, c, 777, { font: ui(600, 30), fill: c > L && c < R ? '#fff' : INK, align: 'center' }));
    const k = eio(seg(t, Hh.seg + .1, Hh.seg + .6)), tot = lerp(21400, 13300, k);
    txt(peso(tot), 540, 1100, { font: ui(700, 120), align: 'center', ls: -3 });
    txt(k < .5 ? 'Total de la mesa · 4 platos' : 'Milanesa napolitana + Limonada', 540, 1170, { font: ui(500, 30), fill: GREY, align: 'center', alpha: Math.abs(k - .5) * 2 });
    const sc = press(t, Hh.pagar); x.save(); x.translate(540, 1470); x.scale(sc, sc); rr(-300, -50, 600, 100, 50); x.fillStyle = INK; x.fill();
    txt(`Pagar ${peso(tot)}`, 0, 11, { font: ui(600, 32), fill: '#fff', align: 'center' }); x.restore();
  });
}
function pagado(t) {
  fx(vis(t, Hh.check + .08, Hh.island, .12), () => poly([[466, 1004], [522, 1060], [618, 950]], eo(seg(t, Hh.check + .1, Hh.check + .45)), '#fff', 20));
}
function pagadoCaption(t) { fx(vis(t, Hh.check + .25, Hh.island, .16), () => txt('PAGADO · COMPROBANTE LISTO', 540, 1222, { font: mono(26, 700), align: 'center', ls: 2 }), 16); }

function aviso(t) {
  fx(vis(t, Hh.island + .1, Hh.expand + .04, .12), () => {
    circle(312, 940, 13, { fill: MINT }); txt('Mesa 7 quiere pedir', 345, 951, { font: ui(600, 32), fill: '#fff' });
  });
  fx(vis(t, Hh.expand + .14, Hh.toast, .16), () => {
    rr(130, 780, 84, 84, 22); x.fillStyle = GREEN; x.fill(); circle(172, 822, 17, { fill: '#fff' });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => circle(172 + a * 25, 822 + b * 25, 6, { fill: 'rgba(255,255,255,.75)' }));
    txt('VASE REST', 240, 832, { font: mono(24, 700), fill: '#A3A09A', ls: 2 }); txt('ahora', 950, 832, { font: ui(500, 26), fill: '#A3A09A', align: 'right' });
    txt('Mesa 7 quiere pedir', 130, 945, { font: ui(700, 50), fill: '#fff' });
    txt('2 platos · confirmalo y va a cocina', 130, 997, { font: ui(500, 32), fill: '#B8B5AF' });
    rr(130, 1040, 390, 96, 48); x.fillStyle = '#2B2B2B'; x.fill(); txt('Ver pedido', 325, 1099, { font: ui(600, 32), fill: '#fff', align: 'center' });
    const sc = press(t, Hh.confirm); x.save(); x.translate(755, 1088); x.scale(sc, sc); rr(-195, -48, 390, 96, 48); x.fillStyle = GREEN; x.fill();
    txt('Confirmar', 0, 11, { font: ui(600, 32), fill: '#fff', align: 'center' }); x.restore();
  });
  fx(vis(t, Hh.toast + .1, Hh.wa, .14), () => {
    const s = 'Enviado a cocina', f = ui(700, 40), w = tw(s, f) + 58, x0 = 540 - w / 2;
    poly([[x0, 962], [x0 + 14, 976], [x0 + 38, 948]], eo(seg(t, Hh.toast + .15, Hh.toast + .4)), '#fff', 7);
    txt(s, x0 + 58, 974, { font: f, fill: '#fff' });
  });
}

function burbuja(s, side, y, t0, t) {
  const k = spring(t - t0, 22, .78); if (k <= 0) return 0;
  const f = ui(500, 32), w = Math.min(560, tw(s, f)) + 52, h = 86, x0 = side === 'in' ? 130 : 950 - w;
  x.save(); x.globalAlpha *= clamp(k * 1.6); const ox = side === 'in' ? x0 : x0 + w; x.translate(ox, y + h); x.scale(k, k); x.translate(-ox, -(y + h));
  rr(x0, y, w, h, 30); x.fillStyle = side === 'in' ? '#fff' : GREEN; x.fill();
  txt(s, x0 + 26, y + 54, { font: f, fill: side === 'in' ? INK : '#fff' }); x.restore();
  return h;
}
function whatsapp(t) {
  fx(vis(t, Hh.wa + .14, Hh.voz, .16), () => {
    x.fillStyle = '#F3F1EC'; x.fillRect(90, 660, 900, 880); x.fillStyle = INK; x.fillRect(90, 540, 900, 120);
    circle(160, 605, 32, { fill: GREEN }); txt('V', 160, 616, { font: ui(700, 30), fill: '#fff', align: 'center' });
    txt('Vase Rest', 212, 600, { font: ui(700, 34), fill: '#fff' }); txt('en línea', 212, 634, { font: ui(500, 24), fill: '#9E9B95' });
    const b = Hh.bubbles; let y = 700;
    y += burbuja('¡Hola! ¿Mesa para 4 hoy a las 21?', 'in', y, b[0], t) + 22;
    y += burbuja('¡Sí! Elegí dónde sentarte:', 'out', y, b[1], t) + 22;
    const k = spring(t - b[2], 22, .78);
    if (k > 0) {
      x.save(); x.globalAlpha *= clamp(k * 1.6); x.translate(950, y + 250); x.scale(k, k); x.translate(-950, -(y + 250));
      rr(510, y, 440, 250, 30); x.fillStyle = GREEN; x.fill(); rr(522, y + 12, 416, 226, 22); x.fillStyle = INK; x.fill();
      txt('ELEGÍ TU MESA', 546, y + 50, { font: mono(18, 700), fill: '#A3A09A', ls: 2 });
      for (let i = 0; i < 8; i++) {
        const cx = 580 + (i % 4) * 100, cy = y + 112 + Math.floor(i / 4) * 78, sel = i === 3;
        circle(cx, cy, 25, { fill: sel ? MINT : '#E8E4DC' }); txt(String(i + 9), cx, cy + 8, { font: ui(700, 22), fill: INK, align: 'center' });
        if (sel && t > b[3]) circle(cx, cy, 34, { stroke: MINT, lw: 4 });
      }
      x.restore();
    }
    y += 250 + 22;
    y += burbuja('La 12, junto a la ventana.', 'in', y, b[3], t) + 22;
    burbuja('Listo, reservada. ¡Los esperamos!', 'out', y, b[4], t);
  });
}

function voz(t) {
  fx(vis(t, Hh.voz + .12, Hh.card, .14), () => {
    circle(222, 1000, 58, { fill: GREEN }); rr(210, 962, 24, 46, 12); x.fillStyle = '#fff'; x.fill();
    x.beginPath(); x.arc(222, 990, 26, .15, Math.PI - .15); x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineCap = 'round'; x.stroke();
    x.beginPath(); x.moveTo(222, 1016); x.lineTo(222, 1030); x.moveTo(208, 1031); x.lineTo(236, 1031); x.stroke();
    const s = '“Marcá agotado el bife.”', n = Math.floor(s.length * seg(t, Hh.typeA, Hh.typeB));
    txt(s.slice(0, n), 310, 988, { font: ui(600, 36), fill: '#fff' });
    const talk = t > Hh.voz && t < Hh.typeB + .1;
    for (let i = 0; i < 26; i++) {
      const a = talk ? 6 + 34 * Math.abs(Math.sin(t * 14 + i * .9)) * (.35 + .65 * hash(i + Math.floor(t * 14))) : 6;
      rr(312 + i * 22, 1040 - a / 2, 10, a, 5); x.fillStyle = MINT; x.fill();
    }
  });
  fx(vis(t, Hh.card + .14, Hh.end, .16), () => {
    txt('ASISTENTE · TE PIDE CONFIRMAR', 140, 752, { font: mono(22, 700), fill: GREY, ls: 2 });
    txt('Bife de chorizo', 140, 834, { font: ui(700, 56) });
    txt('Antes', 140, 912, { font: ui(500, 28), fill: GREY }); txt('Después', 580, 912, { font: ui(500, 28), fill: GREY });
    const f = ui(600, 30), w1 = tw('Disponible', f) + 56, w2 = tw('Agotado', f) + 56;
    rr(140, 935, w1, 64, 32); x.fillStyle = GTINT; x.fill(); txt('Disponible', 168, 978, { font: f, fill: GREEN });
    x.strokeStyle = GREY; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath(); x.moveTo(140 + w1 + 30, 967); x.lineTo(550, 967); x.moveTo(538, 957); x.lineTo(550, 967); x.lineTo(538, 977); x.stroke();
    rr(580, 935, w2, 64, 32); x.fillStyle = INK; x.fill(); txt('Agotado', 608, 978, { font: f, fill: '#fff' });
    txt('Se actualiza en la carta al instante.', 140, 1090, { font: ui(500, 30), fill: GREY });
    const ok = t > Hh.listo, sc = press(t, Hh.tapVoz);
    x.save(); x.translate(540, 1240); x.scale(sc, sc); rr(-400, -50, 800, 100, 50); x.fillStyle = ok ? GREEN : INK; x.fill();
    txt(ok ? 'Listo · 1 cambio aplicado' : 'Confirmar', 0, 12, { font: ui(600, 34), fill: '#fff', align: 'center' }); x.restore();
  });
}

function cierre(t) {
  fx(vis(t, Hh.end + .14, 99, .18), () => {
    const s = 'Vase Rest', f = ui(700, 68), w = tw(s, f, -2), x0 = 540 - (w + 34) / 2;
    txt(s, x0, 1024, { font: f, fill: '#fff', ls: -2 }); rr(x0 + w + 14, 1004, 20, 20, 3); x.fillStyle = MINT; x.fill();
  });
}

// ---------- grano ----------
const GR = document.createElement('canvas'); GR.width = GR.height = 256;
{ const g = GR.getContext('2d'), d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }

// ---------- cuadro ----------
function frame(t) {
  x.save(); x.fillStyle = BG; x.fillRect(0, 0, W, H);
  headline(t); caos(t);
  const s = shape(t);
  if (s.w > 1 && s.h > 1) {
    x.save(); x.shadowColor = 'rgba(40,30,20,.13)'; x.shadowBlur = 60; x.shadowOffsetY = 22;
    rr(s.x0, s.y0, s.w, s.h, s.r); x.fillStyle = s.fill; x.fill(); x.restore();
    x.save(); rr(s.x0, s.y0, s.w, s.h, s.r); x.clip();
    boton(t); plano(t); carta(t); dividir(t); pagado(t); aviso(t); whatsapp(t); voz(t); cierre(t);
    x.restore();
  }
  pagadoCaption(t);
  cierre2(t);
  fx(vis(t, Hh.plano, Hh.end, .3) * .85, () => txt('DATOS DE EJEMPLO', 540, 1640, { font: mono(20, 700), fill: GREY, align: 'center', ls: 3 }));
  touch(t);
  x.save(); x.globalAlpha = .045; x.globalCompositeOperation = 'overlay'; const o = Math.floor(hash(Math.round(t * 30)) * 256);
  x.translate(-o, -o); x.fillStyle = x.createPattern(GR, 'repeat'); x.fillRect(0, 0, W + 256, H + 256); x.restore();
  x.restore();
}
function cierre2(t) {   // lo que va fuera de la forma en el cierre
  fx(vis(t, Hh.plats, 99, .2), () => txt('ANDROID · IPHONE · WEB · WINDOWS', 540, 1180, { font: mono(26, 700), fill: GREY, align: 'center', ls: 3 }), 14);
}

// motion blur: 3 subcuadros dentro de medio obturador, promediados
function render(t, mb = true) {
  const n = mb ? 3 : 1;
  for (let k = 0; k < n; k++) {
    frame(t + (n > 1 ? (k / (n - 1) - .5) * (.5 / C.fps) : 0));
    octx.globalAlpha = 1 / (k + 1); octx.drawImage(FR, 0, 0);
  }
  octx.globalAlpha = 1;
}

const fontsReady = Promise.all([
  document.fonts.load('500 20px "Inter"', 'ÁÉÍÓÚÑ¿¡“”'), document.fonts.load('600 20px "Inter"', 'ÁÉÍÓÚÑ¿¡“”'), document.fonts.load('700 20px "Inter"', 'ÁÉÍÓÚÑ¿¡'),
  document.fonts.load('700 20px "JetBrains Mono"', 'ÁÉÍÓÚÑ·'), document.fonts.load('400 20px "JetBrains Mono"', '$'),
]);
window.renderAt = async (t, type = 'image/png', q = .92) => { render(t); return out.toDataURL(type, q); };
window.renderSheet = async (times, cols = 4, w = 360) => {
  const h = Math.round(w * H / W), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); render(times[i], false); ms.push(Math.round(performance.now() - t0));
    const px = (i % cols) * w, py = Math.floor(i / cols) * h;
    c.drawImage(out, px, py, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(px, py, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', px + 6, py + 17);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => 'canvas 2d';
fontsReady.then(() => {
  window.ready = true;
  if (!location.search.includes('render')) {
    const s = document.getElementById('scrub'), lab = document.getElementById('tt');
    const go = () => { const t0 = performance.now(); render(+s.value, false); lab.textContent = `${(+s.value).toFixed(2)}s · ${Math.round(performance.now() - t0)} ms`; };
    s.addEventListener('input', go); s.value = new URLSearchParams(location.search).get('t') || 0; go();
  }
});
