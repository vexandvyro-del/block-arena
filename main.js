import * as THREE from 'three';
const V = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;

// ================= scene =================
const SKY = 0x87ceeb;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 40, 130);
const camera = new THREE.PerspectiveCamera(85, innerWidth / innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ';
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a6a, 2.3));
const sunL = new THREE.DirectionalLight(0xfff2c0, 1.6);
sunL.position.set(30, 60, 20);
scene.add(sunL);

// ================= pixel textures =================
const rand = (b, v) => b.map((c) => Math.max(0, Math.min(255, Math.round(c + (Math.random() - 0.5) * v))));
function mkTex(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, gg, b] = fn(x, y);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const lam = (t) => new THREE.MeshLambertMaterial({ map: t });
const TEX = {
  stone: (x, y) => rand([125, 125, 128], 26),
  brick: (x, y) => (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7 ? rand([190, 185, 175], 16) : rand([150, 72, 56], 22)),
  log: (x, y) => rand(x % 4 === 0 ? [80, 58, 32] : [110, 82, 48], 14),
  leaves: (x, y) => rand([45, 125, 45], 50),
  planks: (x, y) => (y % 4 === 3 ? rand([110, 80, 45], 10) : rand([175, 135, 82], 16)),
};

// ================= voxel world =================
const colliders = [];
const blocks = {};
function fill(type, x0, y0, z0, x1, y1, z1) {
  const list = (blocks[type] ||= []);
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) list.push(x + 0.5, y + 0.5, z + 0.5);
  colliders.push(new THREE.Box3(new V(x0, y0, z0), new V(x1, y1, z1)));
}
function mfill(type, x0, y0, z0, x1, y1, z1) {
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const xa = x0 * sx, xb = x1 * sx, za = z0 * sz, zb = z1 * sz;
    fill(type, Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb));
  }
}
// arena walls
fill('stone', -30, 0, -31, 30, 6, -30); fill('stone', -30, 0, 30, 30, 6, 31);
fill('stone', -31, 0, -30, -30, 6, 30); fill('stone', 30, 0, -30, 31, 6, 30);
// center platform with steps + cover pillar
fill('brick', -4, 0, -4, 4, 2, 4); fill('planks', -4, 0, 4, 4, 1, 6); fill('planks', -4, 0, -6, 4, 1, -4);
fill('planks', -1, 2, -1, 1, 4, 1);
// corner towers with stair steps
mfill('stone', 22, 0, 22, 28, 3, 28); mfill('stone', 21, 0, 22, 22, 2, 28); mfill('stone', 20, 0, 22, 21, 1, 28);
// cover walls
mfill('brick', 12, 0, -5, 13, 2, 5); mfill('brick', 5, 0, 14, 10, 2, 15);
// trees
for (const [x, z] of [[-25, 5], [25, -6], [-8, -24], [8, 25], [-20, -2], [19, 3]]) {
  fill('log', x, 0, z, x + 1, 4, z + 1); fill('leaves', x - 1, 4, z - 1, x + 2, 6, z + 2);
}
const cube = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4();
for (const [type, pos] of Object.entries(blocks)) {
  const n = pos.length / 3;
  const im = new THREE.InstancedMesh(cube, lam(mkTex(16, TEX[type])), n);
  for (let i = 0; i < n; i++) im.setMatrixAt(i, m4.makeTranslation(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  scene.add(im);
}
// grass floor
const grassT = mkTex(16, () => rand([95, 165, 60], 30));
grassT.wrapS = grassT.wrapT = THREE.RepeatWrapping;
grassT.repeat.set(240, 240);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ map: grassT }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
// sun + clouds
const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xfff6a0, fog: false }));
sunMesh.position.set(90, 110, -90); sunMesh.lookAt(0, 0, 0); scene.add(sunMesh);
for (let i = 0; i < 12; i++) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(10 + Math.random() * 14, 2, 6 + Math.random() * 8), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  c.position.set((Math.random() - 0.5) * 220, 45 + Math.random() * 10, (Math.random() - 0.5) * 220);
  scene.add(c);
}
// pads
const pads = [
  { x: -18, z: -18, t: 'b' }, { x: 18, z: 18, t: 'b' }, { x: 0, z: -15, t: 's' }, { x: 0, z: 22, t: 's' },
];
for (const p of pads) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 2), new THREE.MeshBasicMaterial({ color: p.t === 'b' ? 0x33ff66 : 0xffdd33 }));
  m.position.set(p.x, 0.04, p.z); scene.add(m);
}

// ================= player =================
const P = {
  pos: new V(0, 0, 15), vel: new V(), yaw: 0, pitch: 0, onGround: false, sliding: false, slideCooldown: 0,
  eye: 1.7, roll: 0, hp: 100, ammo: 12, reload: 0, cool: 0, kick: 0, lastHit: -99,
};
const CFG = { walk: 7, sprint: 11, jump: 10, gravity: 30, groundAccel: 10, airAccel: 12, airCap: 2.5, friction: 8,
  slideFriction: 0.8, slideBoost: 1.25, slideMaxSpeed: 16, slideMinSpeed: 7, slideEndSpeed: 3.5, radius: 0.4, height: 1.8, standEye: 1.7, slideEye: 0.8 };
const MAG = 12;
let time = 0, dead = false, ads = false, firing = false, A = 0;
let wave = 0, score = 0, waveTimer = 2, botId = 0;
const aura = { on: false, lock: null };

// ================= pistol =================
const gun = new THREE.Group();
const part = (w, h, d, col, x, y, z, rx = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
  m.position.set(x, y, z); m.rotation.x = rx; gun.add(m); return m;
};
part(0.07, 0.05, 0.3, 0x2b2f38, 0, 0, -0.1);
part(0.065, 0.07, 0.32, 0x9aa0b0, 0, 0.05, -0.12);
part(0.06, 0.16, 0.08, 0x5a3b1e, 0, -0.1, 0.03, 0.2);
part(0.02, 0.03, 0.02, 0x111111, 0, 0.1, 0.03);
part(0.02, 0.03, 0.02, 0x111111, 0, 0.1, -0.26);
part(0.09, 0.09, 0.12, 0xd9a066, 0, -0.12, 0.05);
part(0.11, 0.11, 0.4, 0xd9a066, 0.04, -0.17, 0.26, -0.3);
const flashM = new THREE.MeshBasicMaterial({ color: 0xffe066 });
const gunFlash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), flashM);
gunFlash.position.set(0, 0.05, -0.36); gunFlash.visible = false; gun.add(gunFlash);
camera.add(gun);
let flashT = 0;

// ================= audio =================
let AC;
function beep(f, d = 0.08, type = 'square', v = 0.05, f2) {
  try {
    AC ||= new AudioContext();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2 || f * 0.4, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(AC.destination); o.start(); o.stop(t + d);
  } catch {}
}

// ================= helpers: rays =================
const tmp = new V(), hbox = new THREE.Box3();
function blocked(a, b) {
  const d = b.clone().sub(a), len = d.length();
  const ray = new THREE.Ray(a, d.normalize());
  for (const c of colliders) { const p = ray.intersectBox(c, tmp); if (p && a.distanceTo(p) < len - 0.01) return true; }
  return false;
}
function hitscan(o, d) {
  const ray = new THREE.Ray(o, d);
  let wall = 80;
  for (const c of colliders) { const p = ray.intersectBox(c, tmp); if (p) wall = Math.min(wall, o.distanceTo(p)); }
  let best = null;
  for (const b of bots) {
    const { x, z } = b.g.position;
    for (const h of [0, 1]) {
      hbox.min.set(h ? x - 0.25 : x - 0.35, h ? 1.4 : 0, h ? z - 0.25 : z - 0.35);
      hbox.max.set(h ? x + 0.25 : x + 0.35, h ? 1.9 : 1.4, h ? z + 0.25 : z + 0.35);
      const p = ray.intersectBox(hbox, tmp);
      if (p) { const k = o.distanceTo(p); if (k < wall && (!best || k < best.dist)) best = { bot: b, head: !!h, dist: k }; }
    }
  }
  return best || { dist: wall };
}

// ================= effects =================
const tracers = [], parts = [];
function tracer(a, b, col) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]), new THREE.LineBasicMaterial({ color: col }));
  scene.add(l); tracers.push({ l, life: 0.06 });
}
const partGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
function burst(pos, col, n) {
  const mat = new THREE.MeshLambertMaterial({ color: col });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, mat); m.position.copy(pos); scene.add(m);
    parts.push({ m, v: new V((Math.random() - 0.5) * 5, Math.random() * 5 + 1, (Math.random() - 0.5) * 5), life: 0.8 });
  }
}
function hitMark(head, kill) {
  const h = $('hit');
  h.style.color = kill ? '#f33' : head ? '#ff0' : '#fff';
  h.style.opacity = 1; h.dataset.t = 0.15;
}

// ================= chat =================
const NAMES = ['Creeper_99', 'Steve_Bot', 'xX_Zombie_Xx', 'Herobrine.exe', 'Alex_Aim'];
const LINES = {
  spawn: ['Get ready to get blocked.', 'Fresh spawn, easy target.', "We're coming for you!", 'Wave incoming, noob.'],
  hit: ['Ez.', 'Skill issue.', 'Did that tickle?', 'Too slow!'],
  kill: ['Nooo my pixels!', 'Lag!!', 'That was my last life...', 'Respawning... eventually.'],
  cheat: ['Bro is CLEARLY using AURA', 'REPORTED FOR HACKING', 'aimbot detected lol', 'admin?? ADMIN??'],
  death: ['GG no re.', 'Sit down.', 'Better luck next block.', 'Uninstall.'],
};
let lastSay = 0;
function say(kind, force) {
  if (!force && time - lastSay < 1.5) return;
  lastSay = time;
  const arr = LINES[kind], d = document.createElement('div');
  d.innerHTML = `<span style="color:#ff6">&lt;${NAMES[Math.random() * NAMES.length | 0]}&gt;</span> ${arr[Math.random() * arr.length | 0]}`;
  const c = $('chat'); c.append(d);
  while (c.children.length > 6) c.firstChild.remove();
  setTimeout(() => d.remove(), 9000);
}

// ================= bots =================
const bots = [];
const skinM = lam(mkTex(8, () => rand([205, 150, 110], 20)));
const faceM = lam(mkTex(8, (x, y) => ((y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) ? [40, 20, 20] : (y === 5 && x >= 2 && x <= 5) ? [110, 50, 40] : rand([205, 150, 110], 14))));
const shirts = [[190, 50, 50], [50, 160, 190]].map((c) => lam(mkTex(8, () => rand(c, 24))));
const shirtHex = [0xbe3232, 0x32a0be];
const pantsM = lam(mkTex(8, () => rand([60, 60, 150], 24)));
const gunM = new THREE.MeshLambertMaterial({ color: 0x222222 });
function makeBot(x, z) {
  const g = new THREE.Group(), k = Math.random() * 2 | 0;
  const box = (w, h, d, m, px, py, pz, par = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); par.add(b); return b; };
  box(0.5, 0.5, 0.5, [skinM, skinM, skinM, skinM, faceM, skinM], 0, 1.65, 0);
  box(0.6, 0.7, 0.3, shirts[k], 0, 1.05, 0);
  const l1 = new THREE.Group(), l2 = new THREE.Group();
  l1.position.set(-0.15, 0.7, 0); l2.position.set(0.15, 0.7, 0); g.add(l1, l2);
  box(0.28, 0.7, 0.28, pantsM, 0, -0.35, 0, l1); box(0.28, 0.7, 0.28, pantsM, 0, -0.35, 0, l2);
  for (const sx of [-1, 1]) { const a = new THREE.Group(); a.position.set(sx * 0.4, 1.35, 0); a.rotation.x = -1.4; g.add(a); box(0.2, 0.6, 0.2, skinM, 0, -0.25, 0, a); }
  box(0.1, 0.14, 0.5, gunM, 0, 1.3, 0.45);
  const fl = box(0.14, 0.14, 0.14, flashM, 0, 1.32, 0.75); fl.visible = false;
  g.position.set(x, 0, z); scene.add(g);
  bots.push({ g, l1, l2, fl, hp: 60, cd: 1 + Math.random() * 2, t: Math.random() * 10, sf: 1 + Math.random(), ph: Math.random() * 6,
    keep: 8 + Math.random() * 10, pop: 0, id: ++botId, hex: shirtHex[k], flash: 0 });
}
function inWall(x, z) { return colliders.some((c) => x > c.min.x - 1 && x < c.max.x + 1 && z > c.min.z - 1 && z < c.max.z + 1 && c.min.y < 1); }
function spawnWave() {
  wave++;
  const n = Math.min(3 + wave * 2, 14);
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 40; t++) {
      const x = (Math.random() - 0.5) * 56, z = (Math.random() - 0.5) * 56;
      if (!inWall(x, z) && Math.hypot(x - P.pos.x, z - P.pos.z) > 18) { makeBot(x, z); break; }
    }
  }
  say('spawn', true);
}
function killBot(b, head) {
  burst(new V(b.g.position.x, 1, b.g.position.z), b.hex, 14);
  scene.remove(b.g); bots.splice(bots.indexOf(b), 1);
  score += head ? 150 : 100;
  beep(500, 0.15, 'triangle', 0.07, 120);
  say(aura.on ? 'cheat' : 'kill');
}
function updateBots(dt) {
  const eye = new V(P.pos.x, P.pos.y + P.eye, P.pos.z);
  for (const b of bots) {
    const p = b.g.position;
    const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 1;
    b.g.rotation.y = Math.atan2(dx, dz);
    let mx = 0, mz = 0;
    if (dist > b.keep) { mx = dx / dist; mz = dz / dist; } else if (dist < b.keep - 3) { mx = -dx / dist; mz = -dz / dist; }
    b.t += dt;
    const s = Math.sin(b.t * b.sf + b.ph) * 0.8;
    mx += (-dz / dist) * s; mz += (dx / dist) * s;
    const sp = Math.min(2.5 + wave * 0.15, 4.5);
    p.x += mx * sp * dt; p.z += mz * sp * dt;
    for (const c of colliders) {
      if (c.min.y > 1.8) continue;
      if (p.x + 0.35 > c.min.x && p.x - 0.35 < c.max.x && p.z + 0.35 > c.min.z && p.z - 0.35 < c.max.z) {
        const px = Math.min(p.x + 0.35 - c.min.x, c.max.x - (p.x - 0.35)), pz = Math.min(p.z + 0.35 - c.min.z, c.max.z - (p.z - 0.35));
        if (px < pz) p.x += p.x < (c.min.x + c.max.x) / 2 ? -px : px; else p.z += p.z < (c.min.z + c.max.z) / 2 ? -pz : pz;
      }
    }
    const sw = Math.sin(b.t * 8) * 0.6;
    b.l1.rotation.x = sw; b.l2.rotation.x = -sw;
    b.pop *= 0.85; b.g.scale.setScalar(1 + b.pop);
    b.flash -= dt; b.fl.visible = b.flash > 0;
    b.cd -= dt;
    if (b.cd <= 0 && dist < 40) {
      const from = new V(p.x, 1.4, p.z);
      if (!blocked(from, eye)) {
        b.flash = 0.07; beep(140, 0.08, 'sawtooth', 0.025);
        const chance = Math.max(0.12, 0.55 - dist * 0.012) * (P.sliding ? 0.6 : 1);
        if (Math.random() < chance) { hurt(6 + Math.floor(wave * 0.6)); say('hit'); }
        tracer(from, eye.clone().add(new V((Math.random() - 0.5) * 1.5, -0.3, (Math.random() - 0.5) * 1.5)), 0xff5533);
      }
      b.cd = 0.9 + Math.random() * 1.3;
    }
  }
}
function hurt(d) {
  if (dead) return;
  P.hp -= d; P.lastHit = time;
  $('flash').style.opacity = 0.45; beep(90, 0.15, 'square', 0.08);
  if (P.hp <= 0) die();
}
function die() {
  dead = true; document.exitPointerLock();
  $('msg').innerHTML = `<p>YOU DIED</p><p>SCORE ${score} / WAVE ${wave}</p><p>Click to respawn</p>`;
  say('death', true);
}
function reset() {
  for (const b of bots) scene.remove(b.g);
  bots.length = 0;
  Object.assign(P, { hp: 100, ammo: MAG, reload: 0, yaw: 0, pitch: 0, kick: 0, sliding: false });
  P.pos.set(0, 0, 15); P.vel.set(0, 0, 0);
  wave = 0; score = 0; waveTimer = 2; dead = false;
}

// ================= shooting =================
function reload() { if (P.reload <= 0 && P.ammo < MAG) { P.reload = 1.2; beep(300, 0.1, 'triangle', 0.04, 500); } }
function shoot() {
  if (P.reload > 0 || P.cool > 0) return;
  if (P.ammo <= 0) return reload();
  P.cool = 0.17; P.ammo--; P.kick = 1;
  beep(220, 0.1, 'square', 0.07, 50);
  const fwd = new V(); camera.getWorldDirection(fwd);
  const right = new V().crossVectors(fwd, camera.up).normalize(), up = new V().crossVectors(right, fwd);
  let spread = 0.004 + 0.03 * (1 - A) + Math.hypot(P.vel.x, P.vel.z) * 0.0012 * (1 - A * 0.7);
  if (aura.on) spread *= 0.15;
  const dir = fwd.addScaledVector(right, (Math.random() - 0.5) * 2 * spread).addScaledVector(up, (Math.random() - 0.5) * 2 * spread).normalize();
  const o = camera.position.clone(), r = hitscan(o, dir);
  const end = o.clone().addScaledVector(dir, r.dist);
  tracer(gun.localToWorld(new V(0, 0.05, -0.34)), end, 0xffee88);
  gunFlash.visible = true; flashT = 0.05;
  if (!aura.on) { P.pitch += 0.012; P.yaw += (Math.random() - 0.5) * 0.006; }
  if (r.bot) {
    const b = r.bot;
    b.hp -= r.head ? 45 : 20; b.pop = 0.18;
    burst(end, 0xcc2222, 4); beep(r.head ? 900 : 600, 0.06, 'square', 0.04);
    if (b.hp <= 0) { hitMark(r.head, true); killBot(b, r.head); } else hitMark(r.head, false);
  } else burst(end, 0x999999, 3);
}

// ================= AURA cheat =================
let buf = '';
const BOOT = ['[*] attaching to block_arena.exe', '[*] bypassing anti-cheat ........ OK', '[+] hooking camera matrix', '[+] ESP overlay online',
  '[+] AIMBOT engaged (fov 28deg)', '[+] recoil compensation loaded', '>> AURA READY. HOLD FIRE OR RMB TO LOCK'];
let bootTimers = [];
function toggleAura() {
  aura.on = !aura.on;
  document.body.classList.toggle('aura', aura.on);
  bootTimers.forEach(clearTimeout); bootTimers = [];
  const log = $('hlog'); log.innerHTML = '';
  if (aura.on) {
    beep(800, 0.3, 'sawtooth', 0.05, 1600);
    BOOT.forEach((l, i) => bootTimers.push(setTimeout(() => { const d = document.createElement('div'); d.textContent = l; log.append(d); beep(1200, 0.03, 'square', 0.02); }, i * 320)));
  } else { aura.lock = null; beep(600, 0.3, 'sawtooth', 0.05, 100); }
}

// ================= input =================
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') reload();
  if (!e.repeat && /^[a-z]$/i.test(e.key)) {
    buf = (buf + e.key.toUpperCase()).slice(-12);
    if (buf === 'AURAAURAAURA') { toggleAura(); buf = ''; }
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
const overlay = $('overlay');
overlay.addEventListener('click', () => { if (dead) reset(); renderer.domElement.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  overlay.style.display = document.pointerLockElement ? 'none' : 'flex';
  if (!document.pointerLockElement) { firing = ads = false; if (!dead) $('msg').innerHTML = '<p>PAUSED</p><p>Click to resume</p>'; }
});
addEventListener('mousedown', (e) => { if (!document.pointerLockElement) return; if (e.button === 0) firing = true; if (e.button === 2) ads = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; if (e.button === 2) ads = false; });
document.addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement) return;
  const sens = 0.002 * (camera.fov / 85);
  P.yaw -= e.movementX * sens;
  P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - e.movementY * sens));
});

// ================= movement =================
function applyFriction(dt, f) {
  const s = Math.hypot(P.vel.x, P.vel.z);
  if (s < 0.01) { P.vel.x = P.vel.z = 0; return; }
  const k = Math.max(s - s * f * dt, 0) / s; P.vel.x *= k; P.vel.z *= k;
}
function accelerate(w, max, acc, dt) {
  const add = max - (P.vel.x * w.x + P.vel.z * w.z);
  if (add <= 0) return;
  const a = Math.min(acc * max * dt, add); P.vel.x += w.x * a; P.vel.z += w.z * a;
}
function collide() {
  P.onGround = false;
  if (P.pos.y <= 0) { P.pos.y = 0; if (P.vel.y < 0) P.vel.y = 0; P.onGround = true; }
  const R = CFG.radius, H = CFG.height, p = P.pos;
  for (const c of colliders) {
    if (p.x + R > c.min.x && p.x - R < c.max.x && p.z + R > c.min.z && p.z - R < c.max.z && p.y + H > c.min.y && p.y < c.max.y) {
      if (c.max.y - p.y < 0.6 && P.vel.y <= 0) { p.y = c.max.y; P.vel.y = 0; P.onGround = true; continue; }
      const px = Math.min(p.x + R - c.min.x, c.max.x - (p.x - R)), pz = Math.min(p.z + R - c.min.z, c.max.z - (p.z - R));
      if (px < pz) { p.x += p.x < (c.min.x + c.max.x) / 2 ? -px : px; P.vel.x = 0; } else { p.z += p.z < (c.min.z + c.max.z) / 2 ? -pz : pz; P.vel.z = 0; }
    }
  }
}

// ================= update =================
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function update(dt) {
  time += dt;
  A += ((ads ? 1 : 0) - A) * Math.min(1, dt * 12);
  const fov = 85 - 38 * A;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const wish = new V(-Math.sin(P.yaw) * f + Math.cos(P.yaw) * s, 0, -Math.cos(P.yaw) * f - Math.sin(P.yaw) * s);
  if (wish.lengthSq() > 0) wish.normalize();
  const hSpeed = Math.hypot(P.vel.x, P.vel.z);
  P.slideCooldown = Math.max(0, P.slideCooldown - dt);
  if (keys.KeyC && !P.sliding && P.onGround && hSpeed > CFG.slideMinSpeed && P.slideCooldown === 0) {
    P.sliding = true; const b = Math.min(hSpeed * CFG.slideBoost, CFG.slideMaxSpeed); P.vel.x *= b / hSpeed; P.vel.z *= b / hSpeed;
  }
  if (P.sliding && (!keys.KeyC || hSpeed < CFG.slideEndSpeed || !P.onGround)) { P.sliding = false; P.slideCooldown = 0.4; }
  const maxSpeed = (keys.ShiftLeft && f > 0 ? CFG.sprint : CFG.walk) * (1 - 0.4 * A);
  if (P.onGround) {
    if (P.sliding) { applyFriction(dt, CFG.slideFriction); accelerate(wish, 3, 2, dt); }
    else { applyFriction(dt, CFG.friction); accelerate(wish, maxSpeed, CFG.groundAccel, dt); }
    if (keys.Space) { P.vel.y = CFG.jump; P.onGround = false; P.sliding = false; }
  } else { accelerate(wish, CFG.airCap, CFG.airAccel, dt); P.vel.y -= CFG.gravity * dt; }
  P.pos.addScaledVector(P.vel, dt);
  collide();
  // pads
  if (P.pos.y < 0.2) for (const p of pads) if (Math.abs(P.pos.x - p.x) < 1 && Math.abs(P.pos.z - p.z) < 1) {
    if (p.t === 'b') { P.vel.y = 24; P.onGround = false; beep(300, 0.25, 'sine', 0.08, 900); }
    else {
      let dx = P.vel.x, dz = P.vel.z; const h = Math.hypot(dx, dz);
      if (h < 1) { dx = -Math.sin(P.yaw); dz = -Math.cos(P.yaw); }
      const n = Math.hypot(dx, dz), sp = Math.max(h, 20); P.vel.x = dx / n * sp; P.vel.z = dz / n * sp;
    }
  }

  // aura aim assist
  aura.lock = null;
  if (aura.on) {
    const fwd = new V(); camera.getWorldDirection(fwd);
    let best = 0.5;
    for (const b of bots) {
      const head = new V(b.g.position.x, 1.65, b.g.position.z), d = head.clone().sub(camera.position), ang = fwd.angleTo(d);
      if (ang < best && !blocked(camera.position, head)) { best = ang; aura.lock = { b, d }; }
    }
    if (aura.lock && (firing || ads)) {
      const d = aura.lock.d, ty = Math.atan2(-d.x, -d.z), tp = Math.atan2(d.y, Math.hypot(d.x, d.z)), k = Math.min(1, dt * (ads ? 14 : 9));
      P.yaw += wrap(ty - P.yaw) * k; P.pitch += (tp - P.pitch) * k;
    }
  }

  // shooting
  P.cool = Math.max(0, P.cool - dt);
  if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) P.ammo = MAG; }
  if (firing) shoot();
  P.kick -= P.kick * Math.min(1, dt * 16);
  flashT -= dt; gunFlash.visible = flashT > 0;

  // world
  updateBots(dt);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.life -= dt;
    if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); tracers.splice(i, 1); }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i]; q.v.y -= 20 * dt; q.m.position.addScaledVector(q.v, dt);
    if (q.m.position.y < 0.08) { q.m.position.y = 0.08; q.v.set(0, 0, 0); }
    q.life -= dt; if (q.life <= 0) { scene.remove(q.m); parts.splice(i, 1); }
  }
  if (!bots.length) { waveTimer -= dt; if (waveTimer <= 0) { spawnWave(); waveTimer = 3; } }
  if (time - P.lastHit > 5) P.hp = Math.min(100, P.hp + 8 * dt);

  // camera + gun
  const targetEye = P.sliding ? CFG.slideEye : CFG.standEye;
  P.eye += (targetEye - P.eye) * Math.min(1, dt * 14);
  P.roll += ((P.sliding ? 0.08 : 0) - P.roll) * Math.min(1, dt * 10);
  camera.position.set(P.pos.x, P.pos.y + P.eye, P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, P.roll);
  const bob = P.onGround ? Math.sin(time * 10) * 0.008 * Math.min(1, hSpeed / 7) * (1 - A) : 0;
  const rl = P.reload > 0 ? Math.sin(Math.min(1, (1.2 - P.reload) / 1.2) * Math.PI) : 0;
  gun.position.set(lerp(0.26, 0, A), lerp(-0.24, -0.155, A) + bob - rl * 0.25, lerp(-0.5, -0.42, A) + P.kick * 0.06);
  gun.rotation.set(P.kick * 0.15 + rl * 0.6, 0, P.sliding ? 0.25 : 0);
}

// ================= HUD + ESP =================
const esp = $('esp'), ectx = esp.getContext('2d'), ticks = [...document.querySelectorAll('.tick')];
const v1 = new V(), v2 = new V();
function drawESP() {
  const W = (esp.width = innerWidth), H = (esp.height = innerHeight);
  if (!aura.on) return;
  ectx.font = '12px monospace'; ectx.lineWidth = 1.5;
  ectx.strokeStyle = 'rgba(57,255,20,.5)'; ectx.setLineDash([6, 6]);
  ectx.beginPath(); ectx.arc(W / 2, H / 2, Math.tan(0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * H / 2, 0, 7); ectx.stroke();
  ectx.setLineDash([]);
  for (const b of bots) {
    const { x, z } = b.g.position;
    v1.set(x, 1.95, z).project(camera); v2.set(x, 0, z).project(camera);
    if (v1.z > 1 || v2.z > 1) continue;
    const sx = (v1.x * 0.5 + 0.5) * W, sy = (-v1.y * 0.5 + 0.5) * H, fy = (-v2.y * 0.5 + 0.5) * H, h = fy - sy, w = h * 0.5;
    const locked = aura.lock && aura.lock.b === b, col = locked ? '#ff2d2d' : '#39ff14';
    ectx.strokeStyle = col; ectx.fillStyle = col;
    ectx.strokeRect(sx - w / 2, sy, w, h);
    ectx.fillRect(sx - w / 2 - 6, sy + h * (1 - b.hp / 60), 3, h * b.hp / 60);
    ectx.fillText(`BOT#${b.id} ${camera.position.distanceTo(b.g.position) | 0}m ${locked ? '[LOCKED]' : ''}`, sx - w / 2, sy - 5);
    if (locked) { ectx.beginPath(); ectx.moveTo(W / 2, H / 2); ectx.lineTo(sx, sy + h * 0.08); ectx.stroke(); ectx.strokeRect(sx - 8, sy + h * 0.08 - 8, 16, 16); }
  }
}
function hud(dt) {
  const spd = Math.hypot(P.vel.x, P.vel.z), gap = lerp(16, 2, A) + Math.min(spd, 16) * 0.8 * (1 - A) + P.kick * 8;
  ticks[0].style.transform = `translate(-50%,${-gap - 8}px)`; ticks[1].style.transform = `translate(-50%,${gap}px)`;
  ticks[2].style.transform = `translate(${-gap - 8}px,-50%)`; ticks[3].style.transform = `translate(${gap}px,-50%)`;
  $('dot').style.opacity = A;
  $('top').textContent = `WAVE ${wave}   SCORE ${score}   ENEMIES ${bots.length}`;
  $('hpfill').style.width = Math.max(0, P.hp) + '%';
  $('ammoN').textContent = `${P.ammo}/${MAG}`;
  $('ammoS').textContent = P.reload > 0 ? 'RELOADING...' : P.ammo === 0 ? 'PRESS R' : '';
  const fl = $('flash'); fl.style.opacity = Math.max(0, fl.style.opacity - dt * 1.5);
  const h = $('hit'), t = +h.dataset.t || 0; h.dataset.t = t - dt; if (t - dt <= 0) h.style.opacity = 0;
  if (aura.on) $('hstat').innerHTML = `TARGETS: ${bots.length}<br>LOCK: ${aura.lock ? 'BOT#' + aura.lock.b.id : 'none'}<br>SMOOTH: 0.85 &nbsp; PING: ${20 + (Math.random() * 6 | 0)}ms`;
}

// ================= loop =================
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.pointerLockElement && !dead) update(dt);
  hud(dt); drawESP();
  renderer.render(scene, camera);
}
loop();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});