'use strict';

const $ = id => document.getElementById(id);

// ---------- Utilidades de UI ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  if (name === 'crop') requestAnimationFrame(cropView.resize);
  if (name === 'edit') requestAnimationFrame(editView.render);
}
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2500);
}
function busy(on, text = 'Processando…') {
  $('busy-text').textContent = text;
  $('busy').hidden = !on;
}
const nextFrame = () => new Promise(r => setTimeout(r, 30));

// ---------- Armazenamento (IndexedDB) ----------
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const req = indexedDB.open('digitalizador-fotos', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('fotos', { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('fotos', mode);
      const r = fn(t.objectStore('fotos'));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: item => tx('readwrite', s => s.put(item)),
    del: id => tx('readwrite', s => s.delete(id)),
    all: () => tx('readonly', s => s.getAll()),
  };
})();

// ---------- Carregar imagens ----------
function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Limita o tamanho para não estourar a memória em celulares.
      const c = Imaging.scaledCopy(img, 4000);
      URL.revokeObjectURL(url);
      res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível abrir a imagem.')); };
    img.src = url;
  });
}

const session = { queue: [], total: 0, source: null, corners: null, warped: null };

async function startFiles(files) {
  files = [...files].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  session.queue = files;
  session.total = files.length;
  await nextInQueue();
}

async function nextInQueue() {
  const file = session.queue.shift();
  if (!file) { showScreen('home'); return; }
  busy(true, 'Detectando a foto…');
  await nextFrame();
  try {
    session.source = await loadImage(file);
    autoDetect(false);
    const done = session.total - session.queue.length;
    $('queue-info').textContent = session.total > 1 ? `(${done}/${session.total})` : '';
    showScreen('crop');
  } catch (e) {
    toast(e.message);
    await nextInQueue();
  } finally {
    busy(false);
  }
}

function autoDetect(notify = true) {
  const src = session.source;
  const found = Imaging.detectCorners(src);
  session.corners = found || Imaging.defaultCorners(src.width, src.height, 0.05);
  if (notify) toast(found ? 'Bordas detectadas' : 'Não encontrei as bordas — ajuste manualmente');
  else if (!found) toast('Ajuste os cantos sobre a foto');
  cropView.draw();
}

// ---------- Tela de recorte ----------
const cropView = (() => {
  const canvas = $('crop-canvas');
  const ctx = canvas.getContext('2d');
  let view = { s: 1, ox: 0, oy: 0 }, dpr = 1, drag = -1, pointer = null;
  const PAD = 28;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    draw();
  }
  function layout() {
    const src = session.source;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const s = Math.min((W - PAD * 2) / src.width, (H - PAD * 2) / src.height);
    view = { s, ox: (W - src.width * s) / 2, oy: (H - src.height * s) / 2 };
  }
  const toScreen = ([x, y]) => [x * view.s + view.ox, y * view.s + view.oy];
  const toImage = ([x, y]) => [(x - view.ox) / view.s, (y - view.oy) / view.s];

  function draw() {
    const src = session.source;
    if (!src || !canvas.width) return;
    layout();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, view.ox, view.oy, src.width * view.s, src.height * view.s);
    const pts = session.corners.map(toScreen);
    // escurece fora da seleção
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath();
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#4f9cff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.stroke();
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p[0], p[1], i === drag ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(79,156,255,0.35)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    });
    if (drag >= 0) drawLoupe(pts[drag]);
  }

  // Lupa para posicionar o canto com precisão.
  function drawLoupe(p) {
    const R = 55, Z = 3;
    const W = canvas.width / dpr;
    const cx = p[0] < W / 2 ? W - R - 12 : R + 12, cy = R + 12;
    const [ix, iy] = toImage(p);
    const srcR = R / (view.s * Z);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.drawImage(session.source, ix - srcR, iy - srcR, srcR * 2, srcR * 2, cx - R, cy - R, R * 2, R * 2);
    ctx.strokeStyle = '#4f9cff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  }

  function pos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  canvas.addEventListener('pointerdown', e => {
    if (!session.corners) return;
    const p = pos(e);
    let best = -1, bd = 44;
    session.corners.map(toScreen).forEach((q, i) => {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    drag = best;
    const q = toScreen(session.corners[best]);
    pointer = { dx: q[0] - p[0], dy: q[1] - p[1] };
    canvas.setPointerCapture(e.pointerId);
    draw();
  });
  canvas.addEventListener('pointermove', e => {
    if (drag < 0) return;
    const p = pos(e);
    let [x, y] = toImage([p[0] + pointer.dx, p[1] + pointer.dy]);
    x = Math.min(session.source.width, Math.max(0, x));
    y = Math.min(session.source.height, Math.max(0, y));
    session.corners[drag] = [x, y];
    draw();
  });
  const end = () => { if (drag >= 0) { drag = -1; draw(); } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => { if ($('screen-crop').classList.contains('active')) resize(); });
  return { resize, draw };
})();

$('crop-auto').onclick = () => autoDetect(true);
$('crop-full').onclick = () => {
  session.corners = Imaging.defaultCorners(session.source.width, session.source.height);
  cropView.draw();
};
$('crop-rotate').onclick = () => {
  const old = session.source;
  session.source = Imaging.rotate90(old);
  // gira os cantos junto: (x, y) -> (H - y, x)
  session.corners = Imaging.orderCorners(session.corners.map(([x, y]) => [old.height - y, x]));
  cropView.draw();
};
$('crop-cancel').onclick = () => { session.queue = []; showScreen('home'); };
$('crop-next').onclick = async () => {
  busy(true, 'Corrigindo perspectiva…');
  await nextFrame();
  try {
    session.warped = Imaging.warp(session.source, session.corners);
    editView.load(session.warped);
    showScreen('edit');
  } finally { busy(false); }
};

// ---------- Tela de edição ----------
const DEFAULTS = { restore: true, bw: false, brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpen: 20 };
const editView = (() => {
  const canvas = $('edit-canvas');
  const ctx = canvas.getContext('2d');
  let full = null, preview = null, levels = null, result = null, compare = false, pending = false;
  let opt = { ...DEFAULTS };

  function load(c) {
    full = c;
    preview = Imaging.scaledCopy(full, 1200);
    levels = Imaging.computeLevels(full);
    syncControls();
    update();
  }
  function syncControls() {
    $('t-restore').classList.toggle('on', opt.restore);
    $('t-bw').classList.toggle('on', opt.bw);
    for (const k of ['brightness', 'contrast', 'saturation', 'warmth', 'sharpen']) $('s-' + k).value = opt[k];
  }
  function update() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!preview) return;
      result = Imaging.applyAdjustments(preview, opt, levels);
      render();
    });
  }
  function render() {
    const img = compare ? preview : result;
    if (!img) return;
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    const W = r.width, H = r.height, P = 16;
    const s = Math.min((W - P * 2) / img.width, (H - P * 2) / img.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  }
  function rotate() {
    full = Imaging.rotate90(full);
    preview = Imaging.rotate90(preview);
    update();
  }
  function finalImage() { return Imaging.applyAdjustments(full, opt, levels); }

  for (const k of ['brightness', 'contrast', 'saturation', 'warmth', 'sharpen']) {
    $('s-' + k).addEventListener('input', e => { opt[k] = +e.target.value; update(); });
  }
  $('t-restore').onclick = () => { opt.restore = !opt.restore; syncControls(); update(); };
  $('t-bw').onclick = () => { opt.bw = !opt.bw; syncControls(); update(); };
  $('t-rotate').onclick = rotate;
  $('t-reset').onclick = () => { opt = { ...DEFAULTS }; syncControls(); update(); };
  const cmp = $('t-compare');
  const setCompare = v => { compare = v; cmp.classList.toggle('on', v); render(); };
  cmp.addEventListener('pointerdown', () => setCompare(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => setCompare(false)));
  window.addEventListener('resize', () => { if ($('screen-edit').classList.contains('active')) render(); });

  return { load, render, finalImage };
})();

$('edit-back').onclick = () => showScreen('crop');
$('edit-save').onclick = async () => {
  busy(true, 'Salvando…');
  await nextFrame();
  try {
    const out = editView.finalImage();
    const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
    const thumbC = Imaging.scaledCopy(out, 320);
    const thumb = await new Promise(r => thumbC.toBlob(r, 'image/jpeg', 0.8));
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await DB.put({ id, created: Date.now(), width: out.width, height: out.height, blob, thumb });
    toast('Foto salva!');
    await renderGallery();
  } catch (e) {
    console.error(e);
    toast('Erro ao salvar: ' + e.message);
  } finally { busy(false); }
  if (session.queue.length) await nextInQueue();
  else showScreen('home');
};

// ---------- Galeria ----------
const thumbUrls = [];
async function renderGallery() {
  thumbUrls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const items = (await DB.all()).sort((a, b) => b.created - a.created);
  const g = $('gallery');
  g.innerHTML = '';
  $('empty').hidden = items.length > 0;
  $('count').textContent = items.length ? `(${items.length})` : '';
  for (const it of items) {
    const b = document.createElement('button');
    const img = document.createElement('img');
    const u = URL.createObjectURL(it.thumb); thumbUrls.push(u);
    img.src = u; img.alt = 'Foto digitalizada'; img.loading = 'lazy';
    b.appendChild(img);
    b.onclick = () => openViewer(it);
    g.appendChild(b);
  }
}

let viewerItem = null, viewerUrl = null;
function fileName(it) {
  const d = new Date(it.created);
  const p = n => String(n).padStart(2, '0');
  return `foto-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}
function openViewer(it) {
  viewerItem = it;
  viewerUrl = URL.createObjectURL(it.blob);
  $('viewer-img').src = viewerUrl;
  $('viewer').hidden = false;
  $('v-share').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([it.blob], 'x.jpg', { type: 'image/jpeg' })] }));
}
function closeViewer() {
  $('viewer').hidden = true;
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerItem = viewerUrl = null;
}
$('v-close').onclick = closeViewer;
$('v-download').onclick = () => {
  const a = document.createElement('a');
  a.href = viewerUrl; a.download = fileName(viewerItem);
  document.body.appendChild(a); a.click(); a.remove();
};
$('v-share').onclick = async () => {
  try {
    const file = new File([viewerItem.blob], fileName(viewerItem), { type: 'image/jpeg' });
    await navigator.share({ files: [file], title: 'Foto digitalizada' });
  } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível compartilhar'); }
};
$('v-delete').onclick = async () => {
  if (!confirm('Excluir esta foto?')) return;
  await DB.del(viewerItem.id);
  closeViewer();
  renderGallery();
};

// ---------- Inicialização ----------
for (const id of ['input-camera', 'input-files']) {
  $(id).addEventListener('change', e => { startFiles(e.target.files); e.target.value = ''; });
}
renderGallery().catch(() => toast('Armazenamento indisponível neste navegador'));
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
