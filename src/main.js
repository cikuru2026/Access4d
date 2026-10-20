// Access4D : page de présentation.
// Trois morceaux de WebGL (tesseract du hero, 72 panneaux qui changent de monde) + de l'interface en CSS/DOM.
// Après modification : npm run build  (génère public/assets/js/main.js)
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, BufferGeometry, Float32BufferAttribute, BufferAttribute,
  DynamicDrawUsage, LineSegments, LineBasicMaterial, AdditiveBlending, Points, PointsMaterial, CanvasTexture,
  Color, Vector3, Quaternion, Euler, Object3D, BoxGeometry, EdgesGeometry, Mesh, MeshBasicMaterial, DoubleSide,
} from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cfg = window.ACCESS4D || {};

const BLUE = new Color(0x7cc8ff); // l'espace
const AMBER = new Color(0xffd25a); // le temps

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRenderer(canvas, maxDpr = 2) {
  try {
    const r = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    r.setClearColor(0x000000, 0);
    return r;
  } catch {
    document.documentElement.classList.add('no-webgl');
    return null;
  }
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/* ------------------------------------------------------------------ boucle commune */
const scenes = [];
let looping = false;
function startLoop() {
  if (looping || reduceMotion) return;
  looping = true;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const s of scenes) if (s.visible) s.tick(now / 1000, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function register(scene, el) {
  scenes.push(scene);
  const io = new IntersectionObserver((es) => {
    scene.visible = es[0].isIntersecting;
    if (scene.visible && reduceMotion) scene.tick(3, 0.016);
  }, { rootMargin: '120px' });
  io.observe(el);
  startLoop();
}
function fitCanvas(renderer, camera, el, onSize) {
  const apply = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (onSize) onSize(w, h);
  };
  new ResizeObserver(apply).observe(el);
  apply();
}

/* ------------------------------------------------------------------ HERO : un tesseract tourné dans quatre dimensions */
function initHero() {
  const canvas = $('#hero-canvas');
  const hero = canvas.parentElement;
  const renderer = makeRenderer(canvas);
  if (!renderer) return;

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 300);
  camera.position.set(0, 0, 11);
  const group = new Group();
  scene.add(group);

  // 16 sommets (±1, ±1, ±1, ±1), 32 arêtes
  const V = [];
  for (let i = 0; i < 16; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const E = [];
  for (let i = 0; i < 16; i++) for (const b of [1, 2, 4, 8]) if (!(i & b)) E.push([i, i | b]);

  const ECHOES = 7; // des « échos » du tesseract dans le temps : le passé de chaque pose
  const copies = [];
  for (let k = 0; k < ECHOES; k++) {
    const geo = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(E.length * 6), 3);
    const col = new BufferAttribute(new Float32Array(E.length * 6), 3);
    pos.setUsage(DynamicDrawUsage);
    col.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', pos);
    geo.setAttribute('color', col);
    const mat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: k === 0 ? 1 : 0.42 * (1 - k / ECHOES), blending: AdditiveBlending, depthWrite: false });
    const lines = new LineSegments(geo, mat);
    lines.frustumCulled = false;
    group.add(lines);
    copies.push({ pos, col });
  }
  const pGeo = new BufferGeometry();
  const pPos = new BufferAttribute(new Float32Array(16 * 3), 3);
  const pCol = new BufferAttribute(new Float32Array(16 * 3), 3);
  pPos.setUsage(DynamicDrawUsage);
  pCol.setUsage(DynamicDrawUsage);
  pGeo.setAttribute('position', pPos);
  pGeo.setAttribute('color', pCol);
  const points = new Points(pGeo, new PointsMaterial({ size: 0.55, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }));
  points.frustumCulled = false;
  group.add(points);

  // Étoiles
  const N = 1700;
  const sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
  const rnd = mulberry32(4);
  const tmp = new Color();
  for (let i = 0; i < N; i++) {
    const r = 22 + rnd() * 60, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    sp[i * 3 + 2] = r * Math.cos(ph);
    tmp.copy(BLUE).lerp(AMBER, rnd() < 0.25 ? 1 : rnd() * 0.3).multiplyScalar(0.35 + rnd() * 0.65);
    sc[i * 3] = tmp.r; sc[i * 3 + 1] = tmp.g; sc[i * 3 + 2] = tmp.b;
  }
  const sGeo = new BufferGeometry();
  sGeo.setAttribute('position', new Float32BufferAttribute(sp, 3));
  sGeo.setAttribute('color', new Float32BufferAttribute(sc, 3));
  const stars = new Points(sGeo, new PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
  scene.add(stars);

  // Pointeur et défilement
  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    m.tx = (e.clientX / innerWidth) * 2 - 1;
    m.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const roXW = $('#ro-xw'), roYW = $('#ro-yw'), roZW = $('#ro-zw');
  let roT = 0;
  const v = new Array(4);
  const col = new Color();
  const out = V.map(() => ({ p: [0, 0, 0], w: 0, s: 1 }));

  function rot(a, i, j, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const x = a[i], y = a[j];
    a[i] = x * c - y * s;
    a[j] = x * s + y * c;
  }
  const mod360 = (rad) => String(Math.round(((rad * 180) / Math.PI) % 360 + 360) % 360).padStart(3, '0');

  function pose(k, t, prog) {
    const tt = t - k * 0.16;
    const axw = tt * 0.42 + m.x * 1.0;
    const ayw = tt * 0.31 + m.y * 0.8;
    const azw = tt * 0.23 + prog * 3.4;
    const axy = tt * 0.17, ayz = tt * 0.11;
    for (let i = 0; i < 16; i++) {
      v[0] = V[i][0]; v[1] = V[i][1]; v[2] = V[i][2]; v[3] = V[i][3];
      rot(v, 0, 3, axw); rot(v, 1, 3, ayw); rot(v, 2, 3, azw); rot(v, 0, 1, axy); rot(v, 1, 2, ayz);
      const d = 4.4, s = d / (d - v[3]);
      const o = out[i];
      o.p[0] = v[0] * s * 1.12; o.p[1] = v[1] * s * 1.12; o.p[2] = v[2] * s * 1.12;
      o.w = v[3]; o.s = s;
    }
    return [axw, ayw, azw];
  }

  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight, asp = w / h;
    if (asp > 1.15) { group.position.set(Math.min(3.7, asp * 1.7), -0.1, 0); group.scale.setScalar(1); }
    else { group.position.set(0, 1.9, 0); group.scale.setScalar(0.72); }
  }

  const scene4 = {
    visible: true,
    tick(time, dt) {
      m.x += (m.tx - m.x) * Math.min(1, dt * 3 || 1);
      m.y += (m.ty - m.y) * Math.min(1, dt * 3 || 1);
      const prog = clamp(scrollY / Math.max(1, hero.clientHeight), 0, 1);
      let ang;
      for (let k = 0; k < ECHOES; k++) {
        const a = pose(k, time, prog);
        if (k === 0) ang = a;
        const { pos, col: cc } = copies[k];
        for (let e = 0; e < E.length; e++) {
          for (let end = 0; end < 2; end++) {
            const o = out[E[e][end]];
            const idx = (e * 2 + end) * 3;
            pos.array[idx] = o.p[0]; pos.array[idx + 1] = o.p[1]; pos.array[idx + 2] = o.p[2];
            const tw = clamp((o.w + 2) / 4, 0, 1);
            col.copy(BLUE).lerp(AMBER, tw).multiplyScalar(0.3 + 0.7 * clamp((o.s - 0.6) / 1.1, 0, 1));
            cc.array[idx] = col.r; cc.array[idx + 1] = col.g; cc.array[idx + 2] = col.b;
          }
        }
        pos.needsUpdate = true;
        cc.needsUpdate = true;
        if (k === 0) {
          for (let i = 0; i < 16; i++) {
            const o = out[i];
            pPos.array[i * 3] = o.p[0]; pPos.array[i * 3 + 1] = o.p[1]; pPos.array[i * 3 + 2] = o.p[2];
            col.copy(BLUE).lerp(AMBER, clamp((o.w + 2) / 4, 0, 1)).multiplyScalar(0.5 + 0.5 * clamp((o.s - 0.6) / 1.1, 0, 1));
            pCol.array[i * 3] = col.r; pCol.array[i * 3 + 1] = col.g; pCol.array[i * 3 + 2] = col.b;
          }
          pPos.needsUpdate = true;
          pCol.needsUpdate = true;
        }
      }
      group.rotation.y = m.x * 0.22 + Math.sin(time * 0.15) * 0.1;
      group.rotation.x = m.y * 0.16;
      stars.rotation.y = time * 0.012 + m.x * 0.05;
      stars.rotation.x = m.y * 0.03;
      canvas.style.opacity = String(1 - prog * 0.85);
      if (time - roT > 0.12) {
        roT = time;
        roXW.textContent = mod360(ang[0]); roYW.textContent = mod360(ang[1]); roZW.textContent = mod360(ang[2]);
      }
      renderer.render(scene, camera);
    },
  };

  fitCanvas(renderer, camera, canvas, () => { layout(); if (reduceMotion) scene4.tick(3, 0.016); });
  register(scene4, hero);
  if (reduceMotion) scene4.tick(3, 0.016);
}

/* ------------------------------------------------------------------ MONDES : 72 panneaux, cinq rangements */
const WORLD_TEXT = {
  constellation: ['Constellation', 'Les sites sont regroupés par liens et par domaine : ceux qui se ressemblent forment un amas.'],
  ville: ['Ville', 'Un immeuble par site, un étage par époque. Le rez-de-chaussée, ce sont les archives les plus anciennes.'],
  tunnel: ['Tunnel', 'Les pages s’alignent du présent aux archives les plus anciennes. On avance dans le temps comme dans un couloir.'],
  arc: ['Arc', 'Un outil de rangement : les panneaux s’alignent en demi-cercle face à vous.'],
  mur: ['Mur', 'Un outil de rangement : les panneaux forment une grille régulière, comme un mur d’écrans.'],
};
const CAMS = {
  constellation: { t: [0, 0, 0], d: 31, el: 0.22, az: 0.3, spin: 0.1 },
  ville: { t: [0, 0.4, 0], d: 28, el: 0.5, az: 0.75, spin: 0.07 },
  tunnel: { t: [0, 0, -13], d: 26, el: 0.1, az: 0, spin: 0 },
  arc: { t: [0, 0, -8], d: 18, el: 0.08, az: 0, spin: 0 },
  mur: { t: [0, 0, 0], d: 25, el: 0.03, az: 0, spin: 0 },
};
const N_PANELS = 72;

function buildLayouts() {
  const dummy = new Object3D();
  const face = (p, target) => { dummy.position.copy(p); dummy.lookAt(target); return dummy.quaternion.clone(); };
  const rnd = mulberry32(11);
  const L = {};

  // Constellation : 6 amas de 12
  {
    const arr = [];
    const fib = (i, n, r) => {
      const y = 1 - (2 * (i + 0.5)) / n, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      return new Vector3(Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r);
    };
    for (let c = 0; c < 6; c++) {
      const center = fib(c, 6, 10);
      for (let j = 0; j < 12; j++) {
        const p = center.clone().add(fib(j, 12, 3.3 * (0.65 + 0.35 * rnd())));
        arr.push({ p, q: face(p, p.clone().multiplyScalar(2)), e: Math.pow(rnd(), 1.7) });
      }
    }
    L.constellation = arr;
  }
  // Ville : 12 immeubles de 6 étages
  {
    const arr = [];
    const flat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
    for (let t = 0; t < 12; t++) {
      const cx = ((t % 4) - 1.5) * 4.6, cz = (Math.floor(t / 4) - 1) * 4.6;
      for (let f = 0; f < 6; f++) arr.push({ p: new Vector3(cx, f * 0.95 - 2.4, cz), q: flat.clone(), e: 1 - f / 5 });
    }
    L.ville = arr;
  }
  // Tunnel : 9 anneaux de 8
  {
    const arr = [];
    for (let r = 0; r < 9; r++) {
      for (let k = 0; k < 8; k++) {
        const th = (k / 8) * Math.PI * 2 + r * 0.22, z = -r * 3.3;
        const p = new Vector3(Math.cos(th) * 5.4, Math.sin(th) * 5.4, z);
        arr.push({ p, q: face(p, new Vector3(0, 0, z)), e: r / 8 });
      }
    }
    L.tunnel = arr;
  }
  // Arc : 4 rangées de 18
  {
    const arr = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 18; c++) {
        const phi = ((-75 + 150 * (c / 17)) * Math.PI) / 180;
        const y = (r - 1.5) * 1.25;
        const p = new Vector3(Math.sin(phi) * 12, y, -Math.cos(phi) * 12);
        arr.push({ p, q: face(p, new Vector3(0, y, 0)), e: c / 17 });
      }
    }
    L.arc = arr;
  }
  // Mur : grille 12 × 6
  {
    const arr = [];
    const id = new Quaternion();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) arr.push({ p: new Vector3((c - 5.5) * 1.85, (2.5 - r) * 1.2, 0), q: id.clone(), e: (c + r) / 16 });
    L.mur = arr;
  }
  return L;
}

function initWorlds() {
  const canvas = $('#worlds-canvas');
  const holder = $('#worlds');
  const renderer = makeRenderer(canvas, 1.75);
  if (!renderer) return;

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 300);
  const layouts = buildLayouts();

  const bodyGeo = new BoxGeometry(1.6, 1, 0.03);
  const edgeGeo = new EdgesGeometry(bodyGeo);
  const contentGeo = (() => {
    const pos = [];
    const quad = (x, y, w, h) => {
      const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2;
      pos.push(x0, y0, 0.02, x1, y0, 0.02, x1, y1, 0.02, x0, y0, 0.02, x1, y1, 0.02, x0, y1, 0.02);
    };
    quad(0, 0.38, 1.44, 0.11); quad(-0.2, 0.12, 1.0, 0.06); quad(-0.1, -0.02, 1.2, 0.06); quad(-0.3, -0.16, 0.8, 0.06); quad(0.2, -0.3, 0.6, 0.07);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    return g;
  })();

  const panels = [];
  const root = new Group();
  scene.add(root);
  for (let i = 0; i < N_PANELS; i++) {
    const g = new Group();
    const color = new Color();
    const body = new Mesh(bodyGeo, new MeshBasicMaterial({ transparent: true, opacity: 0.13, side: DoubleSide, depthWrite: false }));
    const content = new Mesh(contentGeo, new MeshBasicMaterial({ transparent: true, opacity: 0.5, side: DoubleSide, depthWrite: false }));
    const edges = new LineSegments(edgeGeo, new LineBasicMaterial({ transparent: true, opacity: 0.95 }));
    g.add(body, content, edges);
    root.add(g);
    panels.push({ g, color, tcolor: new Color(), mats: [body.material, content.material, edges.material], delay: 0, started: false });
  }

  // Liens de la constellation (un fil entre panneaux voisins d'un amas, et entre amas)
  const pairs = [];
  for (let c = 0; c < 6; c++) {
    for (let j = 1; j < 12; j++) pairs.push([c * 12 + j - 1, c * 12 + j]);
    if (c < 5) pairs.push([c * 12, (c + 1) * 12]);
  }
  const linkGeo = new BufferGeometry();
  const linkPos = new BufferAttribute(new Float32Array(pairs.length * 6), 3);
  linkPos.setUsage(DynamicDrawUsage);
  linkGeo.setAttribute('position', linkPos);
  const linkMat = new LineBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0, depthWrite: false });
  const links = new LineSegments(linkGeo, linkMat);
  links.frustumCulled = false;
  root.add(links);

  // État
  let current = 'constellation';
  let linkTarget = 0.28;
  const cam = { t: new Vector3(), d: 31, el: 0.22, az: 0.3 };
  let tCam = CAMS.constellation;
  const drag = { az: 0, el: 0, on: false, x: 0, y: 0 };
  let spinAz = 0;
  let aspect = 1.7;
  let touched = false;

  const nameEl = $('#world-name'), descEl = $('#world-desc');
  const tabs = $$('[data-world]', holder);

  function setWorld(name, instant = false) {
    current = name;
    tCam = CAMS[name];
    linkTarget = name === 'constellation' ? 0.28 : 0;
    const L = layouts[name];
    const now = performance.now() / 1000;
    panels.forEach((p, i) => {
      const t = L[i];
      p.tp = t.p; p.tq = t.q;
      p.tcolor.copy(BLUE).lerp(AMBER, clamp(t.e, 0, 1));
      p.delay = now + i * 0.011;
      if (instant) {
        p.g.position.copy(t.p); p.g.quaternion.copy(t.q); p.color.copy(p.tcolor); p.started = true; p.delay = 0;
      } else p.started = false;
    });
    if (instant) { drag.az = 0; drag.el = 0; }
    nameEl.textContent = WORLD_TEXT[name][0];
    descEl.textContent = WORLD_TEXT[name][1];
    tabs.forEach((b) => { const on = b.dataset.world === name; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  setWorld('constellation', true);
  cam.t.set(...CAMS.constellation.t);

  tabs.forEach((b) => b.addEventListener('click', () => { touched = true; drag.az = 0; drag.el = 0; setWorld(b.dataset.world, reduceMotion); if (reduceMotion) world.tick(3, 0.016); }));

  // Glisser pour tourner autour
  holder.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag.on = true; drag.x = e.clientX; drag.y = e.clientY; touched = true;
    holder.setPointerCapture(e.pointerId);
  });
  holder.addEventListener('pointermove', (e) => {
    if (!drag.on) return;
    drag.az -= (e.clientX - drag.x) * 0.006;
    drag.el = clamp(drag.el + (e.clientY - drag.y) * 0.004, -0.9, 0.9);
    drag.x = e.clientX; drag.y = e.clientY;
    if (reduceMotion) world.tick(3, 0.016);
  });
  const end = () => { drag.on = false; };
  holder.addEventListener('pointerup', end);
  holder.addEventListener('pointercancel', end);

  // Défilement automatique des mondes tant que personne n'a touché
  if (!reduceMotion) {
    const order = ['constellation', 'ville', 'tunnel', 'arc', 'mur'];
    setInterval(() => {
      if (touched || !world.visible) return;
      setWorld(order[(order.indexOf(current) + 1) % order.length]);
    }, 6500);
  }

  const world = {
    visible: false,
    tick(time, dt) {
      const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 3.2);
      // panneaux : glissement vers leur place, à tour de rôle
      const nowS = performance.now() / 1000;
      for (const p of panels) {
        if (!p.started && nowS >= p.delay) p.started = true;
        if (!p.started) continue;
        const kp = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.2);
        p.g.position.lerp(p.tp, kp);
        p.g.quaternion.slerp(p.tq, kp);
        p.color.lerp(p.tcolor, kp);
        p.mats[0].color.copy(p.color); p.mats[1].color.copy(p.color); p.mats[2].color.copy(p.color);
      }
      // fils
      linkMat.opacity += (linkTarget - linkMat.opacity) * k;
      if (linkMat.opacity > 0.01) {
        links.visible = true;
        for (let i = 0; i < pairs.length; i++) {
          const a = panels[pairs[i][0]].g.position, b = panels[pairs[i][1]].g.position;
          linkPos.array.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        }
        linkPos.needsUpdate = true;
      } else links.visible = false;
      // caméra
      cam.t.x = lerp(cam.t.x, tCam.t[0], k); cam.t.y = lerp(cam.t.y, tCam.t[1], k); cam.t.z = lerp(cam.t.z, tCam.t[2], k);
      const fit = aspect < 1.2 ? 1 + (1.2 - aspect) * 0.95 : 1;
      cam.d = lerp(cam.d, tCam.d * fit, k);
      cam.el = lerp(cam.el, tCam.el, k);
      let az;
      if (tCam.spin) { spinAz += dt * tCam.spin; az = tCam.az + spinAz; }
      else az = tCam.az + Math.sin(time * 0.28) * 0.35;
      cam.az = lerp(cam.az, az, k);
      const A = cam.az + drag.az, E = clamp(cam.el + drag.el, -1.2, 1.3);
      camera.position.set(cam.t.x + cam.d * Math.sin(A) * Math.cos(E), cam.t.y + cam.d * Math.sin(E), cam.t.z + cam.d * Math.cos(A) * Math.cos(E));
      camera.lookAt(cam.t);
      renderer.render(scene, camera);
    },
  };
  fitCanvas(renderer, camera, canvas, (w, h) => { aspect = w / h; if (reduceMotion) world.tick(3, 0.016); });
  register(world, holder);
  if (reduceMotion) world.tick(3, 0.016);
}

/* ------------------------------------------------------------------ TEMPS : on vole à travers les époques d'une page */
function initTime() {
  const world = $('#tm-world'), stage = $('#tm');
  const cards = $$('.mock', world);
  const input = $('#year'), out = $('#year-out'), urlEl = $('#wb-url'), dateEl = $('#wb-date'), eraEl = $('#era-name');
  const reps = cards.map((c) => +c.dataset.year);
  const K = 74;
  const xs = [-40, 34, -30, 38, 0], ys = [-20, 16, -12, 14, 0];
  // un texte par fausse page, choisi selon la page la plus proche du curseur
  const ERA = [
    'Les débuts : pages faites à la main, compteurs de visiteurs, « site en construction ».',
    'Le web 2.0 : dégradés, boutons brillants, blogs.',
    'Grandes bannières photo et icônes rondes.',
    'Le design à plat et le menu hamburger.',
    'Aujourd’hui : thème sombre, verre dépoli, dégradés en maille.',
  ];
  let cur = +input.value, target = cur, raf = 0;
  let mx = 0, my = 0;

  function layout(y) {
    cards.forEach((c, i) => {
      const z = (reps[i] - y) * K;
      const o = z <= 0 ? Math.pow(Math.max(0, 1 - -z / 1200), 1.6) : Math.max(0, 1 - z / 240);
      c.style.opacity = o.toFixed(3);
      c.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      c.style.transform = `translate(-50%,-50%) translate3d(${xs[i]}px,${ys[i]}px,${z.toFixed(1)}px) rotateY(${(-5 + i * 2.5).toFixed(1)}deg)`;
      c.style.zIndex = String(Math.round(1000 + z));
    });
    world.style.transform = `rotateY(${(mx * 5).toFixed(2)}deg) rotateX(${(-my * 3).toFixed(2)}deg)`;
    const Y = Math.round(y);
    out.textContent = String(Y);
    input.setAttribute('aria-valuetext', String(Y));
    urlEl.textContent = `web.archive.org/web/${Y}0612/cafedulac.example`;
    dateEl.textContent = `12 juin ${Y}`;
    let near = 0;
    reps.forEach((r, i) => { if (Math.abs(r - y) < Math.abs(reps[near] - y)) near = i; });
    if (eraEl.textContent !== ERA[near]) eraEl.textContent = ERA[near];
  }
  function animate() {
    cancelAnimationFrame(raf);
    const step = () => {
      cur += (target - cur) * 0.16;
      if (Math.abs(target - cur) < 0.004) cur = target;
      layout(cur);
      if (cur !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  let userMoved = false;
  input.addEventListener('input', () => { userMoved = true; target = +input.value; reduceMotion ? layout((cur = target)) : animate(); });
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    my = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!raf || cur === target) layout(cur);
  });
  layout(cur);

  // Un seul voyage au premier affichage : on remonte à 1996, puis on revient.
  if (!reduceMotion) {
    const io = new IntersectionObserver(async (es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      await sleep(500);
      const run = async (from, to, ms) => {
        const t0 = performance.now();
        await new Promise((res) => {
          const f = (now) => {
            if (userMoved) return res();
            const p = clamp((now - t0) / ms, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            cur = target = lerp(from, to, e);
            input.value = String(cur);
            layout(cur);
            p < 1 ? requestAnimationFrame(f) : res();
          };
          requestAnimationFrame(f);
        });
      };
      await run(2025, 1996, 4200);
      if (!userMoved) await sleep(500);
      if (!userMoved) await run(1996, 2025, 2600);
    }, { threshold: 0.45 });
    io.observe(stage);
  }
}

/* ------------------------------------------------------------------ FONCTIONS : une liste, un aperçu animé */
function initFeatures() {
  const items = $$('.feat__item'), vis = $$('.vis');
  const hooks = {};
  const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');

  // recherche : on tape, on trouve, la caméra vole
  {
    let token = 0;
    const typeEl = $('#v-search-type'), lis = $$('#v-search-res li'), fly = $('.v-search__fly');
    hooks.search = {
      async start() {
        const my = ++token;
        while (my === token) {
          typeEl.textContent = ''; lis.forEach((l) => l.classList.remove('is-hit')); fly.classList.remove('is-on');
          await sleep(500);
          for (const ch of 'wiki') { if (my !== token) return; typeEl.textContent += ch; await sleep(190); }
          if (my !== token) return;
          lis[0].classList.add('is-hit');
          await sleep(500);
          fly.classList.add('is-on');
          await sleep(2200);
        }
      },
      stop() { token++; },
    };
  }
  // salles
  {
    let timer, i = 0;
    const tabs = $$('.rt'), rs = $$('.rs');
    const show = () => { tabs.forEach((t, k) => t.classList.toggle('is-on', k === i)); rs.forEach((t, k) => t.classList.toggle('is-on', k === i)); };
    hooks.rooms = { start() { i = 0; show(); clearInterval(timer); timer = setInterval(() => { i = (i + 1) % 3; show(); }, 1900); }, stop() { clearInterval(timer); } };
  }
  // coffre
  {
    let timer;
    const k = $('#v-key'), c = $('#v-cipher');
    hooks.vault = { start() { clearInterval(timer); const f = () => { k.textContent = `${hex(6)}…${hex(6)}`; c.textContent = hex(28); }; f(); timer = setInterval(f, 110); }, stop() { clearInterval(timer); } };
  }
  // bloqueur
  {
    let timer, n = 0;
    const el = $('#v-block-n'), lis = $$('#v-block-list li');
    hooks.block = {
      start() {
        clearInterval(timer);
        timer = setInterval(() => {
          n += 1 + ((Math.random() * 3) | 0);
          el.textContent = n.toLocaleString('fr-FR');
          const l = lis[[0, 1, 3][(Math.random() * 3) | 0]];
          l.classList.add('is-flash'); setTimeout(() => l.classList.remove('is-flash'), 260);
        }, 520);
      },
      stop() { clearInterval(timer); },
    };
  }
  // résolution adaptative
  {
    let raf = 0, run = false;
    const cv = $('#v-res-canvas'), g = cv.getContext('2d'), note = $('#v-res-note');
    const off = document.createElement('canvas'), og = off.getContext('2d');
    function scene(size, ph) {
      off.width = off.height = size;
      og.fillStyle = '#070b1d'; og.fillRect(0, 0, size, size);
      og.strokeStyle = 'rgba(124,200,255,.25)'; og.lineWidth = Math.max(1, size / 80);
      for (let i = 1; i < 6; i++) { og.beginPath(); og.moveTo((size * i) / 6, 0); og.lineTo((size * i) / 6, size); og.moveTo(0, (size * i) / 6); og.lineTo(size, (size * i) / 6); og.stroke(); }
      og.strokeStyle = '#ffd25a'; og.lineWidth = Math.max(1.2, size / 40);
      og.beginPath(); og.arc(size / 2, size / 2, size * 0.33, 0, Math.PI * 2); og.stroke();
      og.save(); og.translate(size / 2 + Math.cos(ph) * size * 0.2, size / 2 + Math.sin(ph * 1.3) * size * 0.14); og.rotate(ph * 1.7);
      og.fillStyle = 'rgba(124,200,255,.35)'; og.strokeStyle = '#7cc8ff'; og.lineWidth = Math.max(1.2, size / 50);
      const s = size * 0.2; og.fillRect(-s, -s, s * 2, s * 2); og.strokeRect(-s, -s, s * 2, s * 2); og.restore();
      og.fillStyle = '#e8eeff'; og.font = `600 ${Math.round(size * 0.075)}px Geist, sans-serif`; og.textAlign = 'center'; og.fillText('Access4D', size / 2, size * 0.93);
    }
    function frame(now) {
      if (!run) return;
      const cycle = (now / 1000) % 4.2, moving = cycle < 2.4;
      scene(moving ? 26 : 200, now / 700);
      g.imageSmoothingEnabled = !moving ? true : false;
      g.clearRect(0, 0, 320, 320); g.drawImage(off, 0, 0, 320, 320);
      const msg = moving ? 'En mouvement : résolution réduite' : 'À l’arrêt : image nette';
      if (note.textContent !== msg) note.textContent = msg;
      raf = requestAnimationFrame(frame);
    }
    hooks.res = { start() { run = true; if (reduceMotion) { scene(200, 1); g.drawImage(off, 0, 0, 320, 320); note.textContent = 'À l’arrêt : image nette'; } else raf = requestAnimationFrame(frame); }, stop() { run = false; cancelAnimationFrame(raf); } };
  }

  let active = 'live';
  function select(id) {
    if (id === active) return;
    hooks[active] && hooks[active].stop();
    active = id;
    items.forEach((b) => { const on = b.dataset.vis === id; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    vis.forEach((v) => v.classList.toggle('is-on', v.dataset.vis === id));
    hooks[id] && hooks[id].start();
  }
  items.forEach((b) => {
    b.addEventListener('click', () => select(b.dataset.vis));
    b.addEventListener('focus', () => select(b.dataset.vis));
    if (matchMedia('(hover: hover)').matches) b.addEventListener('mouseenter', () => select(b.dataset.vis));
  });
  $('.feat__list').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = items.findIndex((b) => b.dataset.vis === active);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  });
}

/* ------------------------------------------------------------------ COMMANDES : le clavier s'allume */
function initKeys() {
  const keys = $$('.key');
  const map = new Map();
  keys.forEach((k) => k.dataset.k.split(',').forEach((n) => map.set(n, [...(map.get(n) || []), k])));
  const norm = (e) => (e.key === ' ' ? ' ' : e.key.toLowerCase());
  window.addEventListener('keydown', (e) => (map.get(norm(e)) || []).forEach((k) => k.classList.add('is-down')));
  window.addEventListener('keyup', (e) => (map.get(norm(e)) || []).forEach((k) => k.classList.remove('is-down')));
  window.addEventListener('blur', () => keys.forEach((k) => k.classList.remove('is-down')));
  keys.forEach((k) => {
    k.addEventListener('pointerdown', () => k.classList.add('is-down'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => k.addEventListener(ev, () => k.classList.remove('is-down')));
  });
}

/* ------------------------------------------------------------------ TÉLÉCHARGEMENTS */
function initDownloads() {
  const d = cfg.downloads || {};
  const ua = navigator.userAgent || '';
  const os = /android/i.test(ua) ? 'android' : /windows/i.test(ua) ? 'windows' : /linux|x11/i.test(ua) ? 'linux' : null;
  const names = { windows: 'Windows', linux: 'Linux', android: 'Android' };

  async function probe(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return { size: 0 };
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!r.ok || /text\/html/i.test(r.headers.get('content-type') || '')) return null;
      return { size: +r.headers.get('content-length') || 0 };
    } catch { return null; }
  }
  const fmt = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(0)} Mo` : n > 1024 ? `${Math.round(n / 1024)} Ko` : '');

  async function arm(btn, url, labelDone, fileEl) {
    const info = await probe(url);
    if (info) {
      btn.href = url; btn.classList.remove('is-pending'); btn.removeAttribute('aria-disabled');
      if (fileEl) fileEl.textContent = `${url.split('/').pop()}${info.size ? ' · ' + fmt(info.size) : ''}`;
      return true;
    }
    btn.textContent = btn.classList.contains('btn') ? 'Bientôt disponible' : btn.textContent;
    return false;
  }
  const files = (id) => $(`[data-file="${id}"]`);
  arm($('#dl-windows'), d.windows && d.windows.url, '', files('windows'));
  arm($('#dl-linux'), d.linux && d.linux.url, '', files('linux'));
  arm($('#dl-appimage'), d.linux && d.linux.appimage, '', null);
  arm($('#dl-android'), d.android && d.android.url, '', files('android')).then((ok) => { if (ok) $('#android-note').hidden = true; });

  if (os) {
    const col = $(`.dl__col[data-os="${os}"]`);
    col.classList.add('is-yours');
    col.style.order = '-1';
    const tag = $('#dl-detect');
    tag.hidden = false;
    tag.textContent = `Pour votre système (${names[os]}), c’est la colonne en haut.`;
    if (matchMedia('(min-width: 961px)').matches) { col.style.order = ''; tag.textContent = `Pour votre système (${names[os]}) : colonne surlignée en bleu.`; }
    $$('[data-os-cta]').forEach((a) => { a.textContent = a.classList.contains('btn--small') ? `Pour ${names[os]}` : `Télécharger pour ${names[os]}`; });
  }

  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    const text = $(b.dataset.copy).textContent.trim();
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copié'; } catch { b.textContent = 'Sélectionnez le texte'; }
    setTimeout(() => (b.textContent = 'Copier'), 1800);
  }));
}

/* ------------------------------------------------------------------ Divers : navigation, jauge de profondeur, barres */
function initChrome() {
  $$('[data-version]').forEach((el) => { if (cfg.version) el.textContent = el.textContent.trim().length > 4 ? cfg.version : cfg.version.replace(/\.0$/, ''); });
  const nav = $('#nav'), yearEl = $('#depth-year'), thumb = $('#depth-thumb'), depth = $('.depth'), dlSec = $('#telecharger');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      nav.classList.toggle('is-solid', scrollY > 24);
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const p = clamp(scrollY / max, 0, 1);
      yearEl.textContent = String(Math.round(2026 - p * 30));
      thumb.style.top = `${p * 100}%`;
      const r = dlSec.getBoundingClientRect();
      depth.classList.toggle('is-ink', r.top < innerHeight / 2 && r.bottom > innerHeight / 2);
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const bars = $('#bars');
  new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { bars.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.35 }).observe(bars);
}

function boot() {
  initChrome();
  initDownloads();
  initKeys();
  initFeatures();
  initTime();
  try { initHero(); } catch (e) { console.error(e); document.documentElement.classList.add('no-webgl'); }
  try { initWorlds(); } catch (e) { console.error(e); document.documentElement.classList.add('no-webgl'); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
