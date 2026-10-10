// reel.js: a kinetic-typography reel (template from the kinetic-reel skill). Every frame is a pure function of t.
// Layers per frame:  WebGL backgrounds (particle terrain, liquid marble, chrome knot) → 2D canvas (type, HUD, shapes)
// → WebGL post pass (RGB split, slice glitch, grain, vignette, flash) → #out. The render.mjs contract: window.ready,
// renderAt(t), renderSheet(...), gpuInfo(), globals DUR + PROJECT.
import * as THREE from '../node_modules/three/build/three.module.js';

const W = 1920, H = 1080, C = KCUE, S = C.S, Hh = C.hits, FPS = C.fps, BEAT = 60 / C.bpm;
window.DUR = C.dur; window.PROJECT = { audio: 'assets/score.m4a' };
// Paleta de Vase Rest: el verde de la marca hace de acento (en la plantilla era el lima).
const K = { ink: '#0C0C0E', ink2: '#1C1C1E', cream: '#F2F2F7', lime: '#4CC38A', brand: '#177A4E', blue: '#1D2840', red: '#E8412F', amber: '#F0B04A', grey: '#8E8E95', mid: '#5C5C63', wood: '#F1D3AE', chair: '#D9703C' };
const F = { cond: '"Anton"', wide: '"Archivo Black"', serif: '"Instrument Serif"', mono: '"JetBrains Mono"', ui: '"Inter"' };

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const expoOut = x => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const backOut = x => { x = clamp(x); const s = 1.7; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const beatPulse = (t, k = 7) => Math.exp(-((t / BEAT) % 1) * k);
const TAU = Math.PI * 2;

// ---------- canvases ----------
const out = document.getElementById('out');
const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
let ctx = c2.getContext('2d');   // swapped to an offscreen buffer while a transition renders its two scenes
const mainCtx = ctx;
const mkBuf = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const bufA = mkBuf(), bufB = mkBuf(), bufT = mkBuf();   // outgoing scene · incoming scene · text-mask scratch
let TRANS = false;                                       // true while a scene renders inside a transition
const RECT = {};                                         // rects scenes register for zoom-through transitions
const glA = document.createElement('canvas'); glA.width = W; glA.height = H;
const RA = new THREE.WebGLRenderer({ canvas: glA, antialias: true, alpha: true, preserveDrawingBuffer: true });
RA.setPixelRatio(1); RA.setSize(W, H, false);
const RP = new THREE.WebGLRenderer({ canvas: out, antialias: false, preserveDrawingBuffer: true });
RP.setPixelRatio(1); RP.setSize(W, H, false); RP.outputColorSpace = THREE.LinearSRGBColorSpace;

// ---------- GL layer 1: particle terrain ----------
const terrain = (() => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, W / H, .1, 100);
  const nx = 220, nz = 140, pos = new Float32Array(nx * nz * 3);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const k = (i * nz + j) * 3; pos[k] = (i / (nx - 1) - .5) * 26; pos[k + 1] = 0; pos[k + 2] = -j / (nz - 1) * 30 + 3; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, amp: { value: 1 }, fade: { value: 1 }, tint: { value: new THREE.Color(K.cream) } },
    vertexShader: `uniform float time, amp; varying float vA;
      float wave(vec2 p, float t){ return sin(p.x*.5+t*.9)*.45 + sin(p.y*.38-t*.7)*.6 + sin((p.x+p.y)*.27+t*.5)*.7 + sin(length(p-vec2(3.,-9.))*.8-t*1.4)*.4; }
      void main(){ vec3 p = position; p.y = wave(p.xz, time)*amp; vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_PointSize = 5.5 * (6.0 / -mv.z); float d = -mv.z; vA = clamp(1.0 - d/30.0, 0., 1.) * (.25 + .75*smoothstep(-1.2, 1.6, p.y)) * smoothstep(0.5, 3.5, d);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float fade; uniform vec3 tint; varying float vA;
      void main(){ vec2 c = gl_PointCoord-.5; float r = dot(c,c); if (r>.25) discard; gl_FragColor = vec4(tint, vA*fade*(1.0-r*2.5)); }`,
  });
  scene.add(new THREE.Points(g, mat));
  return (t, o = {}) => {
    mat.uniforms.time.value = t; mat.uniforms.amp.value = o.amp ?? 1; mat.uniforms.fade.value = o.fade ?? 1;
    cam.position.set(Math.sin(t * .15) * 1.5, o.camY ?? 3.2, 5 - (o.push ?? 0)); cam.lookAt(0, -.4, -8); cam.rotation.z += o.roll ?? 0;
    RA.setClearColor(0x000000, 0); RA.clear(); RA.render(scene, cam);
    return glA;
  };
})();

// ---------- GL layer 2: liquid marble (domain-warped fbm, banded) ----------
const liquid = (() => {
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, strips: { value: 0 }, stripAmt: { value: 0 }, zoom: { value: 1.6 }, seed: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform float time, strips, stripAmt, zoom, seed; uniform vec2 res; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
      void main(){
        vec2 uv = vUv; vec2 p = (uv-.5)*vec2(res.x/res.y,1.)*zoom + seed;
        if (strips > 0.) { float s = floor(uv.x*strips); p.y += (h(vec2(s,3.))-.5)*stripAmt; p.x += (h(vec2(s,7.))-.5)*stripAmt*.25; }
        vec2 q = vec2(fbm(p + time*.06), fbm(p + vec2(5.2,1.3) - time*.05));
        vec2 r = vec2(fbm(p + 3.6*q + vec2(1.7,9.2) + time*.13), fbm(p + 3.6*q + vec2(8.3,2.8) - time*.11));
        float f = fbm(p + 3.8*r);
        float band = sin(f*22.0 + r.x*7.0)*.5+.5;
        vec3 blue = vec3(.09,.48,.31), red = vec3(.30,.76,.54), lil = vec3(.80,.93,.86), navy = vec3(.02,.07,.05), cream = vec3(.95,.95,.97);
        vec3 col = mix(blue, red, smoothstep(.38,.62,f));
        col = mix(col, lil, smoothstep(.62,.95,band)*.55);
        col = mix(col, navy, smoothstep(.55,.95,1.0-f)*.75);
        col = mix(col, cream, smoothstep(.93,1.,band)*smoothstep(.45,.7,f)*.5);
        gl_FragColor = vec4(col,1.);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return (t, o = {}) => {
    const u = mat.uniforms; u.time.value = t; u.strips.value = o.strips || 0; u.stripAmt.value = o.stripAmt || 0; u.zoom.value = o.zoom ?? 1.6; u.seed.value = o.seed || 0;
    RA.setClearColor(0x000000, 1); RA.clear(); RA.render(scene, cam);
    return glA;
  };
})();

// ---------- GL layer 3: chrome torus knot (matcap + inked outline) ----------
const knot = (() => {
  const mc = document.createElement('canvas'); mc.width = mc.height = 256; const m = mc.getContext('2d');
  m.fillStyle = '#202020'; m.fillRect(0, 0, 256, 256);
  let g = m.createRadialGradient(96, 84, 4, 128, 128, 132);
  [[0, '#ffffff'], [.18, '#f2f2f2'], [.38, '#b9b9b9'], [.55, '#5c5c5c'], [.7, '#262626'], [.84, '#9d9d9d'], [.93, '#e6e6e6'], [1, '#5a5a5a']].forEach(([s, c]) => g.addColorStop(s, c));
  m.fillStyle = g; m.beginPath(); m.arc(128, 128, 128, 0, TAU); m.fill();
  g = m.createLinearGradient(0, 120, 0, 170); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = g; m.fillRect(0, 120, 256, 50);
  const tex = new THREE.CanvasTexture(mc); tex.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, .1, 100); cam.position.set(0, 0, 9);
  const geo = new THREE.TorusKnotGeometry(1.25, .34, 360, 48, 2, 3);
  const body = new THREE.Mesh(geo, new THREE.MeshMatcapMaterial({ matcap: tex }));
  const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0e0f0e, side: THREE.BackSide })); hull.scale.setScalar(1.045);
  const grp = new THREE.Group(); grp.add(hull, body); scene.add(grp);
  return (t, o = {}) => {
    grp.rotation.set(t * .55 + (o.r0 || 0), t * .8, t * .25);
    grp.position.set(o.x ?? 1.9, o.y ?? 0, 0); grp.scale.setScalar(o.s ?? 1);
    RA.setClearColor(0x000000, 0); RA.clear(); RA.render(scene, cam);
    return glA;
  };
})();

// ---------- GL layer 4: a particle cloud that condenses into a thyroid (two lobes + isthmus) ----------
// k = 0: a loose shell (dust / embedding space) · k = 1: the gland. Points 0–2 can be highlighted (retrieved chunks);
// cloud.project(i, t, o) gives a point's screen position for 2D overlays (same maths as the shader, minus the wobble).
const cloud = (() => {
  const n = 9000, A = new Float32Array(n * 3), Bp = new Float32Array(n * 3), R = new Float32Array(n), ID = new Float32Array(n);
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const inside = (x, y) => {
    for (const s of [-1, 1]) { const cx = s * .62, cy = .05, a = -s * .28, dx = x - cx, dy = y - cy, u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a); if ((u / .36) ** 2 + (v / .72) ** 2 < 1) return true; }
    return Math.abs(x) < .42 && y > -.42 && y < -.12;
  };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, th = rnd() * TAU, r = 2.4 + rnd() * 1.3, q = Math.sqrt(1 - u * u);
    A.set([Math.cos(th) * q * r * 1.45, u * r * .8, Math.sin(th) * q * r], i * 3);
    let x, y; do { x = rnd() * 2.2 - 1.1; y = rnd() * 1.8 - .8; } while (!inside(x, y));
    Bp.set([x * 1.6, y * 1.6, (rnd() - .5) * .45], i * 3);
    R[i] = rnd(); ID[i] = i;
  }
  // move three front-and-centre shell points into slots 0–2 (the highlighted "retrieved chunks")
  let slot = 0;
  for (let i = 3; i < n && slot < 3; i++) {
    const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2];
    if (Math.abs(x) < 1.8 && Math.abs(y) < 1 && z > 1.2 && (slot === 0 || Math.hypot(x - A[0], y - A[1]) > .9) && (slot < 2 || Math.hypot(x - A[3], y - A[4]) > .9)) {
      for (const arr of [A, Bp]) for (let c = 0; c < 3; c++) { const tmp = arr[slot * 3 + c]; arr[slot * 3 + c] = arr[i * 3 + c]; arr[i * 3 + c] = tmp; }
      const tr = R[slot]; R[slot] = R[i]; R[i] = tr; slot++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(A.slice(), 3)); g.setAttribute('a', new THREE.BufferAttribute(A, 3));
  g.setAttribute('b', new THREE.BufferAttribute(Bp, 3)); g.setAttribute('r', new THREE.BufferAttribute(R, 1)); g.setAttribute('id', new THREE.BufferAttribute(ID, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, k: { value: 0 }, hi: { value: 0 }, size: { value: 4 }, fade: { value: 1 } },
    vertexShader: `attribute vec3 a; attribute vec3 b; attribute float r; attribute float id; uniform float time, k, hi, size; varying float vA; varying vec3 vC;
      void main(){
        float kk = clamp(k*1.4 - r*.4, 0., 1.); kk = kk*kk*(3.-2.*kk);
        vec3 wa = a + vec3(sin(time*.5+r*20.)*.08, cos(time*.4+r*13.)*.08, 0.);
        vec3 wb = b + vec3(sin(time*1.3+r*40.)*.015, cos(time*1.1+r*30.)*.015, 0.);
        vec4 mv = modelViewMatrix*vec4(mix(wa, wb, kk), 1.);
        float isHi = step(id, 2.5) * hi;
        gl_PointSize = size * (1. + 5.*isHi) * (7.0 / -mv.z);
        vA = (.3 + .45*kk) * (1. + 2.5*isHi);
        vC = mix(vec3(.95,.93,.9), vec3(.87,.96,.24), min(1., step(.86, r) + isHi));
        vC = mix(vC, vec3(.91,.25,.18), step(.965, r)*(1.-isHi));
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float fade; varying float vA; varying vec3 vC;
      void main(){ vec2 c = gl_PointCoord-.5; float d = dot(c,c); if (d>.25) discard; gl_FragColor = vec4(vC, vA*fade*(1.-d*3.)); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, .1, 100); cam.position.set(0, 0, 9); scene.add(pts);
  const pose = (t, o) => { pts.rotation.set(.12 * Math.sin(t * .3), o.rot ?? t * .25, 0); pts.position.set(o.x ?? 0, o.y ?? 0, 0); pts.scale.setScalar(o.s ?? 1); pts.updateMatrixWorld(); };
  const fn = (t, o = {}) => {
    const u = mat.uniforms; u.time.value = t; u.k.value = o.k ?? 0; u.hi.value = o.hi ?? 0; u.fade.value = o.fade ?? 1; u.size.value = o.size ?? 4;
    pose(t, o); RA.setClearColor(0x000000, 0); RA.clear(); RA.render(scene, cam); return glA;
  };
  const v = new THREE.Vector3();
  fn.project = (i, t, o = {}) => {
    let kk = clamp((o.k ?? 0) * 1.4 - R[i] * .4); kk = kk * kk * (3 - 2 * kk);
    pose(t, o); v.set(lerp(A[i * 3], Bp[i * 3], kk), lerp(A[i * 3 + 1], Bp[i * 3 + 1], kk), lerp(A[i * 3 + 2], Bp[i * 3 + 2], kk)).applyMatrix4(pts.matrixWorld).project(cam);
    return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H];
  };
  return fn;
})();

// ---------- post pass ----------
const post = (() => {
  const tex = new THREE.CanvasTexture(c2); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: tex }, split: { value: 0 }, slice: { value: 0 }, seed: { value: 0 }, grain: { value: .05 }, time: { value: 0 }, vign: { value: .5 }, flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 1, 1) }, res: { value: new THREE.Vector2(W, H) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform sampler2D tex; uniform float split, slice, seed, grain, time, vign, flash; uniform vec3 flashCol; uniform vec2 res; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 uv = vUv;
        float band = floor(uv.y*28.0 + h(vec2(seed,1.))*3.0), hb = h(vec2(band, seed));
        if (hb < slice) uv.x += (h(vec2(band, seed+2.)) - .5) * .16 * slice;
        vec2 d = vec2(split, split*.15);
        vec3 c = vec3(texture2D(tex, uv + d).r, texture2D(tex, uv).g, texture2D(tex, uv - d).b);
        c += (h(vUv*res + time*61.7) - .5) * grain;
        vec2 q = vUv - .5; c *= 1.0 - vign*dot(q,q)*.9;
        c = mix(c, flashCol, flash);
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return (t, fx) => {
    tex.needsUpdate = true;
    const u = mat.uniforms; u.split.value = fx.split; u.slice.value = fx.slice; u.seed.value = fx.seed; u.time.value = Math.floor(t * FPS);
    u.grain.value = fx.grain; u.vign.value = fx.vign; u.flash.value = fx.flash; u.flashCol.value.set(fx.flashCol);
    RP.render(scene, cam);
  };
})();

// ---------- 2D helpers ----------
let FX;
const font = (fam, size, weight = '') => `${weight} ${size}px ${fam}`.trim();
function txt(s, x, y, o = {}) {
  ctx.save();
  ctx.font = o.font; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic'; ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.globalAlpha = o.a ?? 1;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowR || 28; }
  if (o.stroke) { ctx.lineWidth = o.lw || 2; ctx.strokeStyle = o.stroke; ctx.strokeText(s, x, y); }
  if (o.fill !== null) { ctx.fillStyle = o.fill || K.cream; ctx.fillText(s, x, y); }
  ctx.restore();
}
// per-letter animation: fn(i, n) → { dx, dy, r, s, a }
function letters(s, x, y, o, fn) {
  ctx.save(); ctx.font = o.font; ctx.letterSpacing = (o.ls || 0) + 'px';
  const total = ctx.measureText(s).width, x0 = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const ch = s[i]; if (ch === ' ') continue;
    const px = ctx.measureText(s.slice(0, i)).width, cw = ctx.measureText(ch).width, a = fn(i, n);
    if ((a.a ?? 1) <= 0.001) continue;
    ctx.save(); ctx.globalAlpha = a.a ?? 1; ctx.translate(x0 + px + cw / 2 + (a.dx || 0), y + (a.dy || 0)); ctx.rotate(a.r || 0); ctx.scale(a.s ?? 1, a.s ?? 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (o.stroke) { ctx.lineWidth = o.lw || 2; ctx.strokeStyle = o.stroke; ctx.strokeText(ch, 0, 0); }
    if (o.fill !== null) { ctx.fillStyle = a.fill || o.fill || K.cream; ctx.fillText(ch, 0, 0); }
    ctx.restore();
  }
  ctx.restore();
  return total;
}
const measure = (s, f, ls = 0) => { ctx.save(); ctx.font = f; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; };
const bg = col => { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); };
function line(pts, col, lw = 2, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore(); }
function circle(x, y, r, o = {}) { if (!(r > .01)) return; ctx.save(); ctx.globalAlpha = o.a ?? 1; ctx.beginPath(); ctx.arc(x, y, r, o.a0 ?? 0, o.a1 ?? TAU); if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); } if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.stroke(); } ctx.restore(); }
// the Jelly mark: a dome and four tentacles. (x, y) = centre of the dome's base; r = dome radius; k = 0..1 build-in
function jelly(x, y, r, col, t, k = 1, rot = 0) {
  if (!(r > .01)) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
  const dome = easeOut(seg(k, 0, .55));
  if (dome > 0) { ctx.beginPath(); ctx.arc(0, 0, r * dome, Math.PI, TAU); ctx.closePath(); ctx.fill(); }
  const tk = seg(k, .35, 1);
  for (let i = 0; i < 4; i++) {
    const xi = (-0.6 + i * .4) * r, L = r * (1.05 + .25 * (i % 2)) * easeOut(seg(tk, i * .12, .6 + i * .12));
    if (L < 1) continue;
    ctx.lineWidth = r * .16; ctx.beginPath(); ctx.moveTo(xi, r * .12);
    for (let s = 1; s <= 8; s++) { const q = s / 8; ctx.lineTo(xi + Math.sin(t * 5 + i * 1.3 - q * 4) * r * .12 * q, r * .12 + L * q); }
    ctx.stroke();
  }
  ctx.restore();
}
function starburst(x, y, r, n, col, rot = 0, inner = .62) { if (!(r > .01)) return; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, q = i % 2 ? r * inner : r; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); } ctx.closePath(); ctx.fill(); ctx.restore(); }
function asterisk(x, y, r, col, lw = 5, rot = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'butt'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); } ctx.restore(); }
function arrowNE(x, y, s, col, lw = 6) { line([[x, y + s], [x + s, y]], col, lw); line([[x + s * .35, y], [x + s, y], [x + s, y + s * .65]], col, lw); }
// HUD: corner brackets + micro-type in the four corners + a progress rule
function hud(t, o) {
  const dark = o.dark !== false, col = dark ? 'rgba(241,238,230,.85)' : 'rgba(14,15,14,.85)', dim = dark ? 'rgba(241,238,230,.45)' : 'rgba(14,15,14,.45)';
  const k = o.k ?? 1, m = 40, L = 26 * k;
  if (o.brackets !== false) for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) line([[cx, cy + sy * L], [cx, cy], [cx + sx * L, cy]], col, 2, k);
  const f = font(F.mono, 17, 500), a = clamp(k * 1.4 - .3);
  if (o.tl) txt(o.tl, m + 18, m + 30, { font: f, fill: col, ls: 2.5, a });
  if (o.tr) txt(o.tr, W - m - 18, m + 30, { font: f, fill: col, ls: 2.5, align: 'right', a });
  if (o.bl) txt(o.bl, m + 18, H - m - 18, { font: f, fill: col, ls: 2.5, a });
  if (o.br) txt(o.br, W - m - 18, H - m - 18, { font: f, fill: col, ls: 2.5, align: 'right', a });
  if (o.zh) txt(o.zh, o.zhRight ? W - m - 18 : m + 18, H - m - 52, { font: font(F.mono, 16, 500), fill: dim, ls: 3, align: o.zhRight ? 'right' : 'left', a });
  if (o.progress !== false) {   // the reel as a trace: one segment per chapter, filled as it plays
    const y = H - m + 10, x0 = m + 18, x1 = W - m - 18, X = s => lerp(x0, x1, s / C.dur);
    for (const [, a0, a1] of C.CH) {
      const xa = X(a0) + 3, xb = X(a1) - 3, on = t >= a0 && t < a1;
      line([[xa, y], [xb, y]], dim, 1, a * .6);
      if (t > a0) line([[xa, y], [Math.min(xb, X(t)), y]], col, on ? 3 : 2, a);
    }
  }
}
const tc = t => { const f = Math.floor(t * FPS), s = Math.floor(f / FPS), fr = f % FPS, p = n => String(n).padStart(2, '0'); return `TC 00:00:${p(s)}:${p(fr)}`; };
const sec = (i, name) => `■ ${String(i).padStart(2, '0')} / ${String(C.CH.filter(c => /^\d/.test(c[0])).length).padStart(2, '0')}   ${name}`;
const glShot = (canvas, a = 1) => { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(canvas, 0, 0, W, H); ctx.restore(); };
const count = (t, t0, t1, v0, v1) => Math.round(lerp(v0, v1, expoOut(seg(t, t0, t1))));

// ---------- scenes ----------
function odometer(v0, v1, k, x, y, f, col) {   // digits roll from v0 to v1
  const s0 = String(v0), s1 = String(v1); ctx.save(); ctx.font = f;
  let xx = x; const hgt = parseFloat(f.match(/(\d+)px/)[1]) * .92;
  for (let i = 0; i < s1.length; i++) {
    const d0 = +s0[i], d1 = +s1[i], w = ctx.measureText(s1[i]).width, kk = expoOut(clamp(k * 1.2 - i * .15));
    ctx.save(); ctx.beginPath(); ctx.rect(xx - 10, y - hgt, w + 20, hgt * 1.12); ctx.clip();
    const steps = (d1 - d0 + 10) % 10 || 10, off = kk * steps;
    for (let j = -1; j <= steps + 1; j++) { const dy = (j - off) * hgt; if (Math.abs(dy) > hgt * 1.2) continue; ctx.fillStyle = col; ctx.fillText(String((d0 + j + 10) % 10), xx, y + dy); }
    ctx.restore(); xx += w;
  }
  ctx.restore(); return xx;
}
function tape(t, y, rot, col, fg, words, speed, dir, k) {
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(rot); ctx.translate(lerp(dir * W * 1.4, 0, expoOut(k)), 0);
  ctx.fillStyle = col; ctx.fillRect(-W * 1.5, -85, W * 3, 170);
  const f = font(F.cond, 128), unit = words.map(w => measure(w, f) + 170).reduce((a, b) => a + b, 0), off = ((t * speed) % unit + unit) % unit;
  let x = -W * 1.4 - off * dir;
  while (x < W * 1.5) for (const w of words) { txt(w, x, 50, { font: f, fill: fg }); const ww = measure(w, f); if (w !== '') { if (words.indexOf(w) % 2 === 0) asterisk(x + ww + 85, 0, 34, fg, 7, t); else arrowNE(x + ww + 55, -32, 62, fg, 8); } x += ww + 170; }
  ctx.restore();
}
// ---------- v2 helpers ----------
function rrect(x, y, w, h, r, o = {}) { if (!(w > .5) || !(h > .5)) return; ctx.save(); ctx.globalAlpha = o.a ?? 1; ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); } if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.stroke(); } ctx.restore(); }
// a label chip, left edge at x, vertically centred on y; k = 0..1 wipe-in. Returns its width.
function chip(s, x, y, o = {}) {
  const f = o.font || font(F.mono, 18, 700), ls = o.ls ?? 2, w = measure(s, f, ls) + 28, h = o.h || 38, k = o.k ?? 1;
  if (k <= 0) return w;
  rrect(x, y - h / 2, w * easeOut(k), h, o.r ?? 0, { fill: o.bg || K.ink, stroke: o.line, lw: o.lw, a: o.a });
  if (k > .6) txt(s, x + 14, y + 6.5, { font: f, fill: o.fg || K.cream, ls, a: (o.a ?? 1) * seg(k, .6, 1) });
  return w;
}
function arrow(x0, y0, x1, y1, col, lw = 2, a = 1, head = 13) {
  if (a <= 0) return;
  line([[x0, y0], [x1, y1]], col, lw, a); const g = Math.atan2(y1 - y0, x1 - x0);
  line([[x1 - Math.cos(g - .45) * head, y1 - Math.sin(g - .45) * head], [x1, y1], [x1 - Math.cos(g + .45) * head, y1 - Math.sin(g + .45) * head]], col, lw, a);
}
// big number + small label under it
function stat(v, label, x, y, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return;
  txt(v, x, y + (1 - easeOut(k)) * 24, { font: font(F.cond, o.size || 110), fill: o.col || K.cream, a: k, align: o.align });
  txt(label, x + (o.align === 'right' ? 0 : 4), y + (o.gap || 38), { font: font(F.mono, o.ls ? 16 : 17, 700), fill: o.sub || 'rgba(241,238,230,.7)', ls: 2.5, a: k, align: o.align });
}
const pad2 = n => String(n).padStart(2, '0');
// drop-in word: letters fall from above with overshoot
const dropWord = (s, x, y, f, t0, t, o = {}) => letters(s, x, y, { font: f, fill: o.fill || K.cream, align: o.align }, (i) => {
  const k = seg(t, t0 + i * (o.stag ?? .03), t0 + i * (o.stag ?? .03) + (o.dur ?? .32)); return { dy: (1 - expoOut(k)) * (o.fall ?? 220), a: k > 0 ? 1 : 0, fill: o.fillAt ? o.fillAt(i) : undefined };
});
const glitchIn = (lt, seed, d = .14, amt = .5) => { if (!TRANS && lt < d) { FX.slice = Math.max(FX.slice, amt * (1 - lt / d)); FX.split = Math.max(FX.split, .006 * (1 - lt / d)); FX.seed = seed; } };
// ---------- 01 MICROSOFT CLOUD & AI ----------
// ---------- 02 UW SURGERY · 03 PROJECTS ----------
// ---------- v3 helpers ----------
// Letters as windows onto a shader: draw() into a scratch buffer, keep only `src` inside what was drawn.
function texWindow(draw, src) {
  const saved = ctx, g = bufT.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  ctx = g; draw(); ctx = saved;
  g.globalCompositeOperation = 'source-in'; g.drawImage(src, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
  ctx.drawImage(bufT, 0, 0);
}
function redacted(x, y, w, h, seed, col, a = 1) {   // a line of "text" as blocks (never real content)
  let xx = x; const end = x + w;
  for (let j = 0; xx < end - 10; j++) { const ww = Math.min(end - xx, 30 + 90 * hash(seed * 13 + j)); rrect(xx, y, ww, h, h / 2, { fill: col, a }); xx += ww + 10; }
}
const bez = (p0, c0, c1, p1, u) => { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * c0[0] + 3 * v * u * u * c1[0] + u * u * u * p1[0], v * v * v * p0[1] + 3 * v * v * u * c0[1] + 3 * v * u * u * c1[1] + u * u * u * p1[1]]; };
function thread(p0, p1, k, col, lw = 2.5) {   // a cubic "citation thread", drawn up to k
  if (k <= 0) return; const c0 = [p0[0] + 160, p0[1]], c1 = [p1[0] - 160, p1[1]], pts = [];
  for (let i = 0; i <= 40 * k; i++) pts.push(bez(p0, c0, c1, p1, i / 40));
  if (pts.length > 1) line(pts, col, lw);
}
const DARK = '#0B0D0C';

// ---------- index ----------
// ---------- 02 UW–MADISON DEPARTMENT OF SURGERY ----------
// ---------- 03 ENTERPRISE RAG ----------
// ---------- finale: the whole reel as a trace ----------
// ---------- transitions (into a scene; A = outgoing scene frozen on its last frame, B = incoming, live) ----------
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const ioExpo = x => { x = clamp(x); return x === 0 ? 0 : x === 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
const trIris = (cx, cy, ring = K.lime) => (k, A, B, g) => {
  const e = easeIn(k) * .6 + ease(k) * .4, R = e * Math.hypot(W, H);
  g.drawImage(A, 0, 0); g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip(); g.drawImage(B, 0, 0); g.restore();
  g.save(); g.strokeStyle = ring; g.lineWidth = 2 + 10 * (1 - e); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.restore();
};
const trZoom = rect => (k, A, B, g) => {   // zoom into a UI element of A; B is seen through it, then fills the frame
  const [rx, ry, rw, rh] = typeof rect === 'function' ? rect() : rect, e = ioExpo(k), s1 = Math.max(W / rw, H / rh), s = Math.pow(s1, e);
  const cx = rx + rw / 2, cy = ry + rh / 2, px = lerp(cx, W / 2, e), py = lerp(cy, H / 2, e);
  g.save(); g.translate(px, py); g.scale(s, s); g.translate(-cx, -cy); g.drawImage(A, 0, 0); g.restore();
  g.save(); g.beginPath(); g.rect(px - rw / 2 * s, py - rh / 2 * s, rw * s, rh * s); g.clip(); g.globalAlpha = clamp(e * 2.2 - .2); g.drawImage(B, 0, 0); g.restore();
  FX.split = Math.max(FX.split, .008 * Math.sin(Math.PI * e));
};
const trPush = (dx, dy) => (k, A, B, g) => { const e = ioExpo(k); g.drawImage(A, -dx * W * e, -dy * H * e); g.drawImage(B, dx * W * (1 - e), dy * H * (1 - e)); FX.split = Math.max(FX.split, .012 * Math.sin(Math.PI * e)); };
const trWipe = (col = K.lime) => (k, A, B, g) => { const x = easeInOut(k) * (W + 40); g.drawImage(A, 0, 0); g.save(); g.beginPath(); g.rect(0, 0, x, H); g.clip(); g.drawImage(B, 0, 0); g.restore(); g.fillStyle = col; g.fillRect(x - 4, 0, 8, H); };
const trSlats = (n = 12) => (k, A, B, g) => { g.drawImage(A, 0, 0); const sw = W / n; for (let i = 0; i < n; i++) { const kk = easeInOut(seg(k, i * .035, i * .035 + .6)); if (kk <= 0) continue; g.save(); g.beginPath(); g.rect(i * sw, 0, sw * kk + 1, H); g.clip(); g.drawImage(B, 0, 0); g.restore(); } };
const trGrid = (cols = 16, rows = 9, col = K.lime) => (k, A, B, g) => {
  g.drawImage(A, 0, 0); const cw = W / cols, ch = H / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = (c + r) / (cols + rows - 2), kk = seg(k, d * .6, d * .6 + .4); if (kk <= 0) continue;
    const x = c * cw, y = r * ch;
    if (kk < .5) { const s = kk * 2; g.fillStyle = col; g.fillRect(x + cw * (1 - s) / 2, y + ch * (1 - s) / 2, cw * s, ch * s); }
    else { g.save(); g.beginPath(); g.rect(x, y, cw + 1, ch + 1); g.clip(); g.drawImage(B, 0, 0); g.restore(); if (kk < 1) { g.globalAlpha = 2 - kk * 2; g.fillStyle = col; g.fillRect(x, y, cw + 1, ch + 1); g.globalAlpha = 1; } }
  }
};
// ---------- Vase Rest: piezas de dibujo propias ----------
// Una mesa vista desde arriba (la marca del reel): tapa redonda o rectangular con sillas alrededor.
function mesa(x, y, r, o = {}) {
  if (!(r > .5)) return;
  const sillas = o.sillas ?? 4, rect = !!o.rect, w = rect ? r * 2.3 : r * 2, h = r * 2, cs = r * .5;
  ctx.save(); ctx.globalAlpha = o.a ?? 1;
  for (let i = 0; i < sillas; i++) {
    const a = i / sillas * TAU + (o.rot || 0) + Math.PI / 4 * (rect ? 0 : 1), d = rect ? 0 : r + cs * .75;
    let cx, cy;
    if (rect) { const lado = i % 2 ? 1 : -1, col = Math.floor(i / 2), n = Math.ceil(sillas / 2); cx = x + (col - (n - 1) / 2) * (w / n); cy = y + lado * (h / 2 + cs * .75); }
    else { cx = x + Math.cos(a) * d; cy = y + Math.sin(a) * d; }
    rrect(cx - cs * .7, cy - cs * .55, cs * 1.4, cs * 1.1, cs * .35, { fill: o.chair || K.chair });
  }
  if (rect) rrect(x - w / 2, y - h / 2, w, h, r * .25, { fill: o.fill || K.wood, stroke: o.ring, lw: o.lw || 0 });
  else circle(x, y, r, { fill: o.fill || K.wood, stroke: o.ring, lw: o.lw || 0 });
  if (o.n != null) txt(String(o.n), x, y + r * .22, { font: font(F.cond, Math.round(r * .62)), fill: o.ink || '#2A1E14', align: 'center' });
  ctx.restore();
}
// marco de celular: cuerpo, pantalla recortada, isla. Devuelve el rect interno para dibujar adentro.
function celular(x, y, w, h, o = {}) {
  rrect(x, y, w, h, 64, { fill: o.cuerpo || '#2A2A2E' });
  rrect(x + 10, y + 10, w - 20, h - 20, 56, { fill: o.pantalla || K.cream });
  rrect(x + w / 2 - 62, y + 26, 124, 34, 17, { fill: '#0A0A0B' });
  return [x + 10, y + 10, w - 20, h - 20];
}
const clip = (r, fn, rad = 56) => { ctx.save(); ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], rad); ctx.clip(); fn(); ctx.restore(); };
// un QR de mentira (patrón, no codifica nada): bloques por hash + los tres ojos.
function qrFalso(x, y, s, seed = 3, col = K.ink) {
  const n = 25, c = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const ojo = (i < 7 && j < 7) || (i >= n - 7 && j < 7) || (i < 7 && j >= n - 7);
    if (!ojo && hash(seed * 999 + i * 31 + j * 7) > .52) ctx.fillRect(x + i * c, y + j * c, c + .5, c + .5);
  }
  ctx.fillStyle = col;
  for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) { rrect(x + ox * c, y + oy * c, 7 * c, 7 * c, c, { stroke: col, lw: c }); ctx.fillStyle = col; ctx.fillRect(x + (ox + 2) * c, y + (oy + 2) * c, 3 * c, 3 * c); }
}
function burbuja(texto, x, y, ancho, k, o = {}) {   // burbuja de chat: x es el borde izquierdo (o derecho si o.der)
  if (k <= 0) return 0;
  const f = font(F.ui, 30, 500), lineas = [], palabras = texto.split(' '); let cur = '';
  for (const p of palabras) { const prueba = cur ? cur + ' ' + p : p; if (measure(prueba, f) > ancho - 56 && cur) { lineas.push(cur); cur = p; } else cur = prueba; }
  lineas.push(cur);
  const w = Math.min(ancho, Math.max(...lineas.map(l => measure(l, f))) + 56), h = lineas.length * 42 + 30, e = backOut(k);
  const bx = o.der ? x - w : x, sc = .85 + .15 * e;
  ctx.save(); ctx.translate(o.der ? bx + w : bx, y + h); ctx.scale(sc, sc); ctx.translate(-(o.der ? bx + w : bx), -(y + h)); ctx.globalAlpha = clamp(k * 3);
  rrect(bx, y, w, h, 26, { fill: o.bg || '#FFFFFF' });
  lineas.forEach((l, i) => txt(l, bx + 28, y + 50 + i * 42, { font: f, fill: o.fg || K.ink }));
  ctx.restore();
  return h;
}
const ILUS = 'ILUSTRATIVO · DATOS DE EJEMPLO';

// ---------- apertura ----------
function sOpen(t) {
  bg(K.ink); const lt = t - S.open;
  glShot(terrain(t, { fade: ease(seg(t, .1, 1.2)) * (1 - .5 * seg(t, Hh.mark, Hh.mark + .4)), amp: lerp(.2, 1.1, easeOut(seg(t, 0, 2.5))), push: t * .6 }));
  const fuera = 1 - easeIn(seg(t, Hh.dot - .1, Hh.dot + .3));
  if (fuera > 0) {
    ctx.save(); ctx.globalAlpha = fuera;
    dropWord('UN SALÓN.', W / 2, 470, font(F.cond, 170), Hh.hook1, t, { align: 'center', fall: 140, fillAt: i => i === 8 ? K.lime : K.cream });
    letters('MIL COSAS A LA VEZ.', W / 2, 600, { font: font(F.cond, 92), align: 'center', fill: 'rgba(242,242,247,.72)' }, i => { const k = seg(t, Hh.hook2 + i * .018, Hh.hook2 + i * .018 + .25); return { dy: (1 - expoOut(k)) * 60, a: k }; });
    ctx.restore();
  }
  const cx = W / 2, cy = H / 2 + 20;
  if (t > Hh.dot - .05 && t < Hh.mark) circle(cx, cy, (12 + 9 * beatPulse(t)) * backOut(seg(t, Hh.dot, Hh.dot + .3)), { fill: K.lime });
  if (t >= Hh.mark) {
    const k = backOut(seg(t, Hh.mark, Hh.mark + .45));
    mesa(cx, cy, 64 * k, { sillas: 4, fill: K.lime, chair: 'rgba(76,195,138,.55)' });
    circle(cx, cy, 170 * k + 10 * beatPulse(t), { stroke: 'rgba(76,195,138,.35)', lw: 2 });
  }
  hud(t, { tl: 'VASE REST — LANZAMIENTO', tr: tc(t), bl: sec(0, 'APERTURA'), br: 'RENDERIZADO EN CÓDIGO · 1920×1080', k: ease(seg(lt, .1, .6)) });
}

// ---------- 01 salón: el plano en vivo ----------
const PLANO = { x: 930, y: 170, w: 860, h: 690 };
const MESAS = [   // [x, y, r, n, rect, sillas]  posiciones dentro del plano
  [1060, 300, 46, 1, false, 4], [1230, 300, 46, 2, false, 4], [1400, 300, 46, 3, false, 4],
  [1100, 470, 44, 4, true, 4], [1330, 470, 44, 5, true, 4], [1515, 470, 40, 6, false, 4],
  [1090, 715, 46, 7, false, 4], [1330, 715, 52, 8, true, 6],
];
// estados por mesa: libre (verde), ocupada (rojo suave), esperando (azul), listo (naranja)
const ESTADO = { libre: '#2E9B63', ocupada: '#D0503C', esperando: '#3F78C6', listo: '#D77A2E' };
function estadoMesa(i, t) {
  const base = ['ocupada', 'libre', 'esperando', 'ocupada', 'listo', 'libre', 'esperando', 'ocupada'][i];
  const f = Hh.flips;
  if (i === 1 && t > f[0]) return 'ocupada';
  if (i === 2 && t > f[1]) return 'listo';
  if (i === 5 && t > f[2]) return 'esperando';
  return base;
}
function sPlano(t) {
  bg(K.ink); const lt = t - S.plano;
  // plano azul con grilla de 50 cm
  const p = PLANO, kp = expoOut(seg(lt, 0, .6));
  ctx.save(); ctx.globalAlpha = kp;
  rrect(p.x, p.y, p.w, p.h, 22, { fill: K.blue });
  ctx.save(); ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 22); ctx.clip();
  for (let gx = p.x; gx < p.x + p.w; gx += 34) line([[gx, p.y], [gx, p.y + p.h]], 'rgba(255,255,255,.05)', 1);
  for (let gy = p.y; gy < p.y + p.h; gy += 34) line([[p.x, gy], [p.x + p.w, gy]], 'rgba(255,255,255,.05)', 1);
  ctx.restore();
  // muros y zonas
  rrect(p.x + 40, p.y + 40, 620, 360, 8, { stroke: 'rgba(242,242,247,.55)', lw: 4 });
  rrect(p.x + 40, p.y + 430, 620, 220, 8, { stroke: 'rgba(242,242,247,.55)', lw: 4 });
  rrect(p.x + 690, p.y + 40, 130, 610, 8, { stroke: 'rgba(242,242,247,.55)', lw: 4 });
  txt('SALÓN', p.x + 60, p.y + 72, { font: font(F.mono, 15, 700), fill: 'rgba(242,242,247,.6)', ls: 3 });
  txt('PATIO', p.x + 60, p.y + 462, { font: font(F.mono, 15, 700), fill: 'rgba(242,242,247,.6)', ls: 3 });
  txt('BARRA', p.x + 755, p.y + 350, { font: font(F.mono, 15, 700), fill: 'rgba(242,242,247,.6)', ls: 3, align: 'center' });
  rrect(p.x + 720, p.y + 120, 70, 460, 10, { fill: K.wood, a: .9 });
  ctx.restore();
  MESAS.forEach(([x, y, r, n, rect, sillas], i) => {
    const k = backOut(seg(t, Hh.mesas[i], Hh.mesas[i] + .35)); if (k <= 0) return;
    const est = estadoMesa(i, t), col = ESTADO[est];
    const flip = Hh.flips.map((f, j) => [f, [1, 2, 5][j]]).find(([f, m]) => m === i && t > f && t < f + .35);
    const pop = flip ? 1 + .12 * Math.sin(Math.PI * seg(t, flip[0], flip[0] + .35)) : 1;
    if (i === 4 && t > Hh.late) {   // la mesa demorada late
      for (let q = 0; q < 2; q++) { const ph = ((t - Hh.late) / .9 + q * .5) % 1; circle(x, y, r * 1.9 * (.9 + ph * .7), { stroke: K.red, lw: 5, a: .8 * (1 - ph) }); }
      circle(x, y, r * 1.75, { stroke: K.red, lw: 5 });
    } else circle(x, y, r * 1.75 * k, { stroke: col, lw: 5, a: .95 });
    mesa(x, y, r * k * pop, { sillas, rect, n, chair: K.chair });
    if (t > Hh.mozo && [0, 3, 7].includes(i)) {   // iniciales del mozo que atiende
      const kb = backOut(seg(t, Hh.mozo + [0, 3, 7].indexOf(i) * .1, Hh.mozo + .3 + [0, 3, 7].indexOf(i) * .1));
      circle(x + r * 1.35, y - r * 1.35, 24 * kb, { fill: K.lime });
      if (kb > .6) txt(['AP', 'LR', 'AP'][[0, 3, 7].indexOf(i)], x + r * 1.35, y - r * 1.35 + 8, { font: font(F.mono, 18, 700), fill: K.ink, align: 'center' });
    }
  });
  RECT.mesa5 = [1330 - 90, 470 - 70, 180, 140];
  if (t > Hh.late) {   // la etiqueta de la demora
    const k = seg(t, Hh.late + .1, Hh.late + .4);
    chip('MESA 5 · LISTO HACE 7 MIN', 1205, 585, { k, bg: K.red, fg: K.cream, font: font(F.mono, 21, 700), r: 4, h: 42 });
  }
  dropWord('TU SALÓN,', 140, 330, font(F.cond, 170), Hh.planoTitle, t, { fall: 150 });
  dropWord('EN VIVO.', 140, 510, font(F.cond, 170), Hh.planoTitle + .2, t, { fall: 150, fill: K.lime });
  txt('El plano real del local: cada mesa con su estado,', 144, 600, { font: font(F.ui, 30, 500), fill: 'rgba(242,242,247,.75)', a: seg(lt, .8, 1.1) });
  txt('quién la atiende y cuánto lleva esperando.', 144, 642, { font: font(F.ui, 30, 500), fill: 'rgba(242,242,247,.75)', a: seg(lt, .9, 1.2) });
  let x = 144; ['ESTADOS EN VIVO', 'MESAS DEMORADAS', 'REPARTO ENTRE MOZOS'].forEach((s, i) => { x += chip(s, x, 760, { k: seg(t, Hh.chips[i], Hh.chips[i] + .25), bg: i === 1 ? K.red : K.ink2, fg: K.cream, line: i === 1 ? null : 'rgba(242,242,247,.3)', lw: 1.5 }) + 12; });
  hud(t, { tl: '01 / SALÓN', tr: tc(t), bl: sec(1, 'PLANO EN VIVO'), br: 'SE ARMA Y SE OPERA CON EL DEDO' });
}

// ---------- 02 QR: pedir, pagar, salir ----------
function sQR(t) {
  bg(K.cream); const lt = t - S.qr;
  ['PEDÍ.', 'PAGÁ.', 'SALÍ.'].forEach((w, i) => dropWord(w, 140, 340 + i * 200, font(F.cond, 200), Hh.qrWords[i], t, { fill: K.ink, fall: 160, fillAt: j => j === 4 ? K.brand : K.ink }));
  txt('DESDE EL QR DE LA MESA · SIN DESCARGAR NADA', 146, 860, { font: font(F.mono, 20, 700), fill: K.mid, ls: 3, a: seg(lt, .9, 1.2) });
  const ph = [1180, 105, 420, 840], scr = celular(...ph, { pantalla: '#F7F7FA' });
  RECT.phoneQR = ph;
  clip(scr, () => {
    const [sx, sy, sw] = scr, cx = sx + sw / 2;
    if (t < Hh.carta) {   // escanear el QR de la mesa
      ctx.fillStyle = K.ink; const q = 260; qrFalso(cx - q / 2, sy + 230, q, 7);
      txt('Mesa 5', cx, sy + 180, { font: font(F.ui, 36, 700), fill: K.ink, align: 'center' });
      const sl = sy + 230 + q * ((t - Hh.scan) / .7 % 1);
      if (t > Hh.scan) line([[cx - q / 2 - 20, sl], [cx + q / 2 + 20, sl]], K.lime, 6);
      txt('Escaneá para ver la carta', cx, sy + 560, { font: font(F.ui, 24, 500), fill: K.mid, align: 'center' });
    } else if (t < Hh.split) {   // la carta: los platos caen al pedido
      txt('Nuestra carta', sx + 34, sy + 130, { font: font(F.ui, 40, 700), fill: K.ink });
      [['Milanesa napolitana', '$ 15.900'], ['Copa de Malbec', '$ 6.400'], ['Flan casero', '$ 6.200']].forEach(([n, p], i) => {
        const y = sy + 190 + i * 128, k = easeOut(seg(t, Hh.carta + i * .08, Hh.carta + .3 + i * .08));
        rrect(sx + 24, y + (1 - k) * 30, sw - 48, 108, 22, { fill: '#FFFFFF', a: k });
        txt(n, sx + 50, y + 48 + (1 - k) * 30, { font: font(F.ui, 26, 600), fill: K.ink, a: k });
        txt(p, sx + 50, y + 84 + (1 - k) * 30, { font: font(F.ui, 24, 500), fill: K.mid, a: k });
        const add = t > Hh.items[i];
        circle(sx + sw - 70, y + 54, 26 * k, { fill: add ? K.brand : 'rgba(23,122,78,.14)' });
        txt(add ? '✓' : '+', sx + sw - 70, y + 64, { font: font(F.ui, 28, 700), fill: add ? '#fff' : K.brand, align: 'center', a: k });
      });
      const n = Hh.items.filter(h => t > h).length;
      rrect(sx + 24, sy + 620, sw - 48, 84, 42, { fill: K.brand, a: n ? 1 : .35 });
      txt(`Pedir · ${n} ${n === 1 ? 'plato' : 'platos'}`, cx, sy + 674, { font: font(F.ui, 28, 700), fill: '#fff', align: 'center' });
    } else if (t < Hh.recibo) {   // dividir la cuenta
      txt('Tu cuenta', sx + 34, sy + 130, { font: font(F.ui, 40, 700), fill: K.ink });
      txt('¿Cómo dividimos?', sx + 34, sy + 180, { font: font(F.ui, 24, 500), fill: K.mid });
      ['Todo', 'Por partes', 'Lo mío'].forEach((s, i) => { const on = i === 2; rrect(sx + 24 + i * 122, sy + 210, 112, 56, 28, { fill: on ? K.brand : '#E9E9EE' }); txt(s, sx + 80 + i * 122, sy + 246, { font: font(F.ui, 21, 600), fill: on ? '#fff' : K.ink, align: 'center' }); });
      txt('$ ' + count(t, Hh.total, Hh.total + .6, 0, 24974).toLocaleString('es-AR'), sx + 34, sy + 415, { font: font(F.cond, 88), fill: K.ink });
      txt('+ propina 10 %', sx + 34, sy + 480, { font: font(F.ui, 24, 500), fill: K.mid });
      rrect(sx + 24, sy + 620, sw - 48, 84, 42, { fill: K.ink });
      txt('Pagar', cx, sy + 674, { font: font(F.ui, 28, 700), fill: '#fff', align: 'center' });
    } else {   // comprobante con QR de salida
      const k = backOut(seg(t, Hh.recibo, Hh.recibo + .4));
      circle(cx, sy + 160, 46 * k, { fill: K.brand }); if (k > .5) txt('✓', cx, sy + 178, { font: font(F.ui, 48, 700), fill: '#fff', align: 'center' });
      txt('¡Pago confirmado!', cx, sy + 260, { font: font(F.ui, 32, 700), fill: K.ink, align: 'center', a: seg(t, Hh.recibo + .1, Hh.recibo + .3) });
      ctx.fillStyle = K.ink; qrFalso(cx - 90, sy + 300, 180, 11);
      txt('K7RP-29EW', cx, sy + 540, { font: font(F.mono, 34, 700), fill: K.ink, align: 'center', ls: 4 });
      txt('Mostralo al salir', cx, sy + 590, { font: font(F.ui, 22, 500), fill: K.mid, align: 'center' });
      if (t > Hh.pagado) {   // el control de salida lo da por bueno
        const kk = backOut(seg(t, Hh.pagado, Hh.pagado + .3));
        ctx.save(); ctx.translate(cx, sy + 420); ctx.rotate(-.18); ctx.scale(kk, kk);
        rrect(-150, -48, 300, 96, 14, { fill: 'rgba(255,255,255,.94)', stroke: K.brand, lw: 7 }); txt('PAGADO', 0, 22, { font: font(F.wide, 52), fill: K.brand, align: 'center' });
        ctx.restore();
      }
    }
  });
  hud(t, { dark: false, tl: '02 / QR DE LA MESA', tr: tc(t), bl: sec(2, 'PEDIR · PAGAR · SALIR'), br: ILUS, brackets: false });
}

// ---------- 03 avisos en la pantalla bloqueada ----------
function notif(x, y, w, k, titulo, cuerpo, hora = 'ahora') {
  if (k <= 0) return;
  const e = expoOut(k), dy = (1 - e) * -120;
  ctx.save(); ctx.globalAlpha = clamp(k * 2.5);
  rrect(x, y + dy, w, 150, 34, { fill: 'rgba(242,242,247,.92)' });
  rrect(x + 24, y + dy + 26, 56, 56, 14, { fill: K.brand });
  circle(x + 52, y + dy + 54, 13, { fill: K.cream });
  txt('VASE REST', x + 100, y + dy + 50, { font: font(F.ui, 20, 600), fill: K.mid, ls: 1 });
  txt(hora, x + w - 28, y + dy + 50, { font: font(F.ui, 20, 500), fill: K.mid, align: 'right' });
  txt(titulo, x + 100, y + dy + 88, { font: font(F.ui, 25, 700), fill: K.ink });
  txt(cuerpo, x + 100, y + dy + 122, { font: font(F.ui, 21, 500), fill: '#3A3A3F' });
  ctx.restore();
}
function sAvisos(t) {
  bg(K.ink); const lt = t - S.avisos;
  glShot(liquid(t, { zoom: 1.4, seed: 4 }), .55);
  bg('rgba(12,12,14,.35)');
  dropWord('AVISA', 140, 400, font(F.cond, 230), Hh.avTitle, t, { fall: 170 });
  dropWord('SOLO.', 140, 620, font(F.cond, 230), Hh.avTitle + .2, t, { fall: 170, fillAt: i => i === 4 ? K.lime : K.cream });
  txt('PANTALLA BLOQUEADA · ANDROID Y IPHONE', 146, 720, { font: font(F.mono, 20, 700), fill: 'rgba(242,242,247,.7)', ls: 3, a: seg(lt, .6, .9) });
  const ph = [1090, 105, 540, 840], scr = celular(...ph, { pantalla: '#101820' });
  clip(scr, () => {
    const [sx, sy, sw, sh] = scr, cx = sx + sw / 2;
    const g = ctx.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#173A2B'); g.addColorStop(1, '#0B1411'); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
    txt('sábado 10 de octubre', cx, sy + 150, { font: font(F.ui, 24, 600), fill: 'rgba(242,242,247,.8)', align: 'center' });
    txt('21:12', cx, sy + 270, { font: font(F.ui, 120, 600), fill: K.cream, align: 'center' });
    notif(sx + 18, sy + 330, sw - 36, seg(t, Hh.notif1, Hh.notif1 + .4), 'Mesa 5 · listo para servir', 'Cocina terminó el pedido.');
    notif(sx + 18, sy + 500, sw - 36, seg(t, Hh.notif2, Hh.notif2 + .4), 'Mesa 7 quiere pedir', 'Confirmalo y pasa a cocina.');
  });
  hud(t, { tl: '03 / AVISOS', tr: tc(t), bl: sec(3, 'PUSH AL MOZO'), br: 'LE LLEGA A QUIEN ATIENDE LA MESA' });
}

// ---------- 04 WhatsApp ----------
function sWhats(t) {
  bg(K.brand); const lt = t - S.whats;
  dropWord('WHATSAPP', 140, 330, font(F.wide, 128), Hh.waTitle, t, { fall: 130, stag: .025 });
  dropWord('ES TU VIDRIERA.', 140, 480, font(F.cond, 128), Hh.waTitle + .25, t, { fall: 130, fillAt: i => i === 14 ? K.ink : K.cream });
  txt('Reservas con el plano real.', 144, 600, { font: font(F.ui, 32, 600), fill: K.cream, a: seg(lt, .5, .8) });
  txt('Pedidos para llevar, directo a cocina.', 144, 646, { font: font(F.ui, 32, 600), fill: K.cream, a: seg(lt, 2.2, 2.5) });
  // el chat
  const px = 1040, py = 120, pw = 740, phh = 760;
  rrect(px, py, pw, phh, 36, { fill: '#E9E3D9', a: expoOut(seg(lt, 0, .4)) });
  ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, phh, 36); ctx.clip();
  const b = Hh.bubbles, scroll = 220 * easeInOut(seg(t, b[2] + .4, b[3]));
  let y = py + 120 - scroll;
  y += burbuja('Mesa para 4 mañana a las 21', px + pw - 30, y, 520, seg(t, b[0], b[0] + .3), { der: true, bg: '#D2F5C9' }) + 18;
  y += burbuja('¡Tengo mesa! Mesa 12, en el salón. Elegila mirando el plano ↗', px + 30, y, 560, seg(t, b[1], b[1] + .3)) + 18;
  const kp = backOut(seg(t, b[2], b[2] + .35));   // la tarjeta del plano real
  if (kp > 0) {
    ctx.save(); ctx.globalAlpha = clamp(kp * 2);
    rrect(px + 30, y, 420, 200, 22, { fill: K.blue });
    [[110, 70], [210, 70], [310, 70], [110, 150], [310, 150]].forEach(([mx, my], i) => mesa(px + 30 + mx, y + my, 22, { sillas: 4, fill: K.wood, a: i === 2 ? 1 : .35 }));
    circle(px + 30 + 310, y + 70, 44 + 6 * beatPulse(t), { stroke: K.lime, lw: 4 });
    txt('12', px + 30 + 310, y + 77, { font: font(F.cond, 20), fill: '#2A1E14', align: 'center' });
    ctx.restore(); y += 200 * clamp(kp) + 18;
  }
  y += burbuja('2 milanesas napolitanas para llevar', px + pw - 30, y, 520, seg(t, b[3], b[3] + .3), { der: true, bg: '#D2F5C9' }) + 18;
  burbuja('¡Pedido recibido! Ya está en cocina. Código #C728', px + 30, y, 560, seg(t, b[4], b[4] + .3));
  rrect(px, py, pw, 92, 0, { fill: '#123C2A' });
  circle(px + 60, py + 46, 26, { fill: K.lime }); txt('Vase Rest', px + 104, py + 56, { font: font(F.ui, 28, 700), fill: '#fff' });
  ctx.restore();
  if (t > Hh.cocina) {   // el ticket viaja a la columna de cocina
    const k = expoOut(seg(t, Hh.cocina, Hh.cocina + .5));
    chip('PARA LLEVAR #C728', lerp(1040, 144, k), 790, { k: 1, bg: K.ink, fg: K.cream, font: font(F.mono, 20, 700) });
    if (k > .9) { arrow(470, 790, 560, 790, K.cream, 3); chip('COCINA', 580, 790, { k: seg(t, Hh.cocina + .45, Hh.cocina + .65), bg: K.lime, fg: K.ink, font: font(F.mono, 20, 700) }); }
  }
  hud(t, { tl: '04 / WHATSAPP', tr: tc(t), bl: sec(4, 'RESERVAS Y PARA LLEVAR'), br: ILUS });
}

// ---------- 05 voz ----------
function sVoz(t) {
  bg(K.cream); const lt = t - S.voz;
  dropWord('HABLALE.', 140, 330, font(F.cond, 250), S.voz + .05, t, { fill: K.ink, fall: 180, fillAt: i => i === 7 ? K.brand : K.ink });
  // la onda de la voz
  const on = seg(t, Hh.wave, Hh.wave + .2) * (1 - seg(t, Hh.card, Hh.card + .3));
  for (let i = 0; i < 44; i++) {
    const x = 146 + i * 20, a = (.2 + .8 * Math.abs(Math.sin(t * 9 + i * .7) * hash(i + Math.floor(t * 12)))) * on;
    rrect(x, 480 - a * 85, 11, a * 170 + 6, 5.5, { fill: K.brand });
  }
  const pal = ['“Marcá', 'agotado', 'el', 'bife.”'], f = `italic 86px ${F.serif}`;
  let x = 146; pal.forEach((p, i) => { const k = seg(t, Hh.words[i], Hh.words[i] + .25); txt(p, x, 660 + (1 - easeOut(k)) * 24, { font: f, fill: K.ink, a: k }); x += measure(p + ' ', f); });
  txt('SIEMPRE MUESTRA EL ANTES Y EL DESPUÉS, Y PIDE CONFIRMACIÓN', 146, 760, { font: font(F.mono, 19, 700), fill: K.mid, ls: 2.5, a: seg(t, Hh.card, Hh.card + .3) });
  // la tarjeta de confirmación
  const k = expoOut(seg(t, Hh.card, Hh.card + .45));
  if (k > 0) {
    const cx = 1120 + (1 - k) * 200, cy = 200;
    ctx.save(); ctx.globalAlpha = k;
    rrect(cx, cy, 660, 560, 38, { fill: '#FFFFFF' });
    txt('Bife de chorizo', cx + 48, cy + 96, { font: font(F.ui, 48, 700), fill: K.ink });
    txt('Antes', cx + 48, cy + 190, { font: font(F.ui, 28, 500), fill: K.mid });
    chip('DISPONIBLE', cx + 48, cy + 250, { bg: 'rgba(23,122,78,.12)', fg: K.brand, r: 24, h: 52, font: font(F.mono, 22, 700) });
    arrow(cx + 300, cy + 250, cx + 370, cy + 250, K.mid, 3);
    txt('Después', cx + 395, cy + 190, { font: font(F.ui, 28, 500), fill: K.mid });
    chip('AGOTADO', cx + 395, cy + 250, { bg: 'rgba(232,65,47,.12)', fg: K.red, r: 24, h: 52, font: font(F.mono, 22, 700) });
    const pr = t > Hh.confirm && t < Hh.confirm + .15 ? .96 : 1, ok = t > Hh.confirm + .1;
    ctx.save(); ctx.translate(cx + 330, cy + 440); ctx.scale(pr, pr);
    rrect(-282, -52, 564, 104, 52, { fill: ok ? K.lime : K.brand });
    txt(ok ? 'Listo · 1 cambio aplicado' : 'Confirmar', 0, 13, { font: font(F.ui, 34, 700), fill: ok ? K.ink : '#fff', align: 'center' });
    ctx.restore(); ctx.restore();
  }
  hud(t, { dark: false, tl: '05 / ASISTENTE', tr: tc(t), bl: sec(5, 'ÓRDENES POR VOZ'), br: 'TAMBIÉN DICTA PEDIDOS', brackets: false });
}

// ---------- 06 datos ----------
function sDatos(t) {
  bg(K.ink); const lt = t - S.datos;
  dropWord('DECIDÍ CON', 140, 300, font(F.cond, 150), Hh.dTitle, t, { fall: 130 });
  dropWord('DATOS.', 140, 460, font(F.cond, 150), Hh.dTitle + .2, t, { fall: 130, fill: K.lime });
  txt('Mapa de calor por mesa: ventas, rotación, permanencia.', 144, 560, { font: font(F.ui, 28, 500), fill: 'rgba(242,242,247,.75)', a: seg(lt, .4, .7) });
  txt('Reparto justo de mesas entre mozos.', 144, 602, { font: font(F.ui, 28, 500), fill: 'rgba(242,242,247,.75)', a: seg(t, Hh.reparto, Hh.reparto + .3) });
  // mapa de calor: 4 × 3 mesas
  const vals = [.35, .8, 1, .55, .25, .7, .9, .4, .6, .3, .85, .5], x0 = 990, y0 = 130;
  vals.forEach((v, i) => {
    const c = i % 4, r = Math.floor(i / 4), x = x0 + c * 200, y = y0 + r * 160, k = easeOut(seg(t, Hh.heat + (c + r) * .06, Hh.heat + .4 + (c + r) * .06));
    circle(x + 70, y + 60, 62 * k, { fill: `rgba(240,176,74,${(.15 + .6 * v) * k})` });
    mesa(x + 70, y + 60, 22 * k, { sillas: 4, a: k });
    if (k > .8) txt(`$ ${Math.round(40 + v * 260)} k`, x + 70, y + 140, { font: font(F.mono, 21, 700), fill: 'rgba(242,242,247,.85)', align: 'center' });
  });
  // reparto: carga por mozo
  const mozos = [['ANA', .82], ['BETO', .34], ['LU', .58]], ry = 640;
  mozos.forEach(([n, v], i) => {
    const k = seg(t, Hh.reparto + i * .12, Hh.reparto + .5 + i * .12), y = ry + i * 64;
    txt(n, 990, y + 14, { font: font(F.mono, 24, 700), fill: K.cream, a: k });
    rrect(1110, y - 8, 560, 26, 13, { fill: 'rgba(242,242,247,.12)', a: k });
    rrect(1110, y - 8, 560 * v * expoOut(k), 26, 13, { fill: i === 1 ? K.lime : 'rgba(242,242,247,.55)' });
  });
  if (t > Hh.sugerido) chip('PRÓXIMA MESA → BETO', 1110, ry + 3 * 64 + 26, { k: seg(t, Hh.sugerido, Hh.sugerido + .25), bg: K.lime, fg: K.ink, font: font(F.mono, 18, 700) });
  hud(t, { tl: '06 / DATOS', tr: tc(t), bl: sec(6, 'CALOR Y REPARTO'), br: ILUS });
}

// ---------- repaso: cintas ----------
function sRecap(t) {
  bg(K.ink); const k = seg(t, Hh.tapes, Hh.tapes + .5);
  tape(t, 380, -.06, K.lime, K.ink, ['PLANO EN VIVO', 'QR DE LA MESA', 'COCINA', 'WHATSAPP'], 520, 1, k);
  tape(t, 700, .05, K.cream, K.ink, ['TICKET Y FACTURA', 'RESERVAS', 'AVISOS', 'VOZ'], 480, -1, seg(t, Hh.tapes + .15, Hh.tapes + .65));
  glitchIn(t - S.recap, 3);
  hud(t, { tl: 'RESUMEN', tr: tc(t), bl: sec(7, 'TODO EN UNA APP'), br: 'ANDROID · IPHONE · WEB · WINDOWS' });
}

// ---------- cierre ----------
function sEnd(t) {
  bg('#0E100F'); const lt = t - S.end;
  glShot(terrain(t, { fade: .35 * ease(seg(lt, 0, 1)), amp: .6, push: 2 + lt * .3, camY: 2.6 }));
  dropWord('VASE', 130, 520, font(F.cond, 300), Hh.name, t, { stag: .04, dur: .4 });
  dropWord('REST.', 130, 820, font(F.cond, 300), Hh.name + .25, t, { stag: .05, dur: .4, fillAt: i => i === 4 ? K.lime : K.cream });
  const mk = seg(t, Hh.name + .5, Hh.name + 1.2), cx = 1420, cy = 400;
  mesa(cx, cy, 110 * backOut(mk), { sillas: 4, fill: K.lime, chair: 'rgba(76,195,138,.55)' });
  circle(cx, cy, (250 + 12 * beatPulse(t)) * backOut(mk), { stroke: 'rgba(76,195,138,.35)', lw: 2 });
  const tg = 'El servicio, de punta a punta.', f = `italic 64px ${F.serif}`;
  txt(tg, 1420, 720, { font: f, fill: K.cream, align: 'center', a: seg(t, Hh.tagline, Hh.tagline + .4) });
  let x = 1420 - 330; ['ANDROID', 'IPHONE', 'WEB', 'WINDOWS'].forEach((s, i) => { x += chip(s, x, 810, { k: seg(t, Hh.plats[i], Hh.plats[i] + .2), bg: 'transparent', line: 'rgba(242,242,247,.45)', lw: 1.5, fg: K.cream, r: 22, h: 46, font: font(F.mono, 21, 700) }) + 14; });
  hud(t, { tl: 'VASE REST — 2026', tr: 'PARA EL RITMO DEL LOCAL ARGENTINO', bl: 'Salón · Cocina · Cobro · Salida', br: 'ES-AR · ARS', brackets: false, k: seg(lt, .5, 1), progress: false });
  if (t > Hh.glitch) { const g = seg(t, Hh.glitch, Hh.endDot); FX.slice = g * .8; FX.split = .016 * g; FX.seed = Math.floor(t * FPS); }
  if (t > Hh.endDot) { const k = seg(t, Hh.endDot, Hh.endDot + .25); bg(K.ink); circle(W / 2, H / 2, lerp(60, 4, easeIn(k)) * (1 - seg(t, C.dur - .25, C.dur)), { fill: K.lime }); FX.slice = 0; FX.split = 0; }
}

// transiciones hacia cada escena (las que no tienen entrada cortan seco en el compás)
const TR = {
  plano: [.5, trIris(W / 2, H / 2 + 20, K.lime)],
  qr: [.55, trZoom(() => RECT.mesa5 || [1240, 410, 180, 140])],
  avisos: [.45, trPush(0, 1)],
  whats: [.5, trSlats(12)],
  voz: [.5, trWipe(K.lime)],
  datos: [.6, trGrid(16, 9, K.lime)],
};
const SCENES = [[S.open, sOpen, 'open'], [S.plano, sPlano, 'plano'], [S.qr, sQR, 'qr'], [S.avisos, sAvisos, 'avisos'], [S.whats, sWhats, 'whats'],
  [S.voz, sVoz, 'voz'], [S.datos, sDatos, 'datos'], [S.recap, sRecap, 'recap'], [S.end, sEnd, 'end']];

function renderInto(i, t, buf) {
  ctx = buf.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.clearRect(0, 0, W, H);
  SCENES[i][1](t); ctx = mainCtx;
}
function frame(t) {
  FX = { split: 0, slice: 0, seed: 0, grain: .05, vign: .28, flash: 0, flashCol: '#ffffff' };
  let i = 0; while (i + 1 < SCENES.length && t >= SCENES[i + 1][0]) i++;
  const [s0, fn, key] = SCENES[i], tr = TR[key];
  ctx = mainCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (tr && i > 0 && t < s0 + tr[0]) {
    TRANS = true;
    const keep = FX; FX = { ...keep }; renderInto(i - 1, s0 - 1 / FPS, bufA); FX = keep;   // the outgoing scene's own effects are dropped
    renderInto(i, t, bufB);
    TRANS = false;
    tr[1](seg(t, s0, s0 + tr[0]), bufA, bufB, mainCtx);
  } else {
    fn(t);
    if (!tr && s0 > 0 && t < s0 + 1 / FPS) FX.flash = Math.max(FX.flash, .08);   // a one-frame flash on hard cuts
  }
  post(t, FX);
}

// ---------- render contract ----------
// Fuentes locales (reel/fonts): Google Fonts no siempre es alcanzable desde Chrome headless.
const fontsReady = Promise.all([
  document.fonts.load('100px "Anton"', 'ÁÉÍÓÚÑ'), document.fonts.load('100px "Archivo Black"'), document.fonts.load('italic 100px "Instrument Serif"'),
  document.fonts.load('700 20px "JetBrains Mono"'), document.fonts.load('500 20px "JetBrains Mono"'),
  document.fonts.load('500 20px "Inter"'), document.fonts.load('600 20px "Inter"'), document.fonts.load('700 20px "Inter"'),
]);
window.renderAt = async (t, type = 'image/png', q = .92) => { frame(t); return out.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640, crop = null) => {
  const [, , cw, ch] = crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); frame(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h, [cx, cy] = crop || [0, 0];
    c.drawImage(out, cx, cy, cw, ch, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => { const gl = RA.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };
fontsReady.then(() => {
  window.ready = true;
  if (!location.search.includes('render')) {
    const s = document.getElementById('scrub'), lab = document.getElementById('tt');
    const go = () => { const t0 = performance.now(); frame(+s.value); lab.textContent = `${(+s.value).toFixed(2)}s · ${Math.round(performance.now() - t0)} ms`; };
    s.addEventListener('input', go); s.value = new URLSearchParams(location.search).get('t') || 0; go();
  }
});
