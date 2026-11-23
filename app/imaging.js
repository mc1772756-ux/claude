/* Processamento de imagem: detecção da foto, correção de perspectiva e ajustes de cor.
 * Tudo roda localmente no navegador — nenhuma imagem sai do aparelho. */
'use strict';

const Imaging = (() => {
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function scaledCopy(src, maxDim) {
    const s = Math.min(1, maxDim / Math.max(src.width, src.height));
    const c = makeCanvas(src.width * s, src.height * s);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function rotate90(src, clockwise = true) {
    const c = makeCanvas(src.height, src.width);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((clockwise ? 1 : -1) * Math.PI / 2);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }

  // ---------- Detecção automática dos cantos ----------

  function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < hist.length; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 0;
    for (let i = 0; i < hist.length; i++) {
      wB += hist[i];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }
    return thr;
  }

  function convexHull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  // Reduz o polígono convexo a 4 vértices removendo, a cada passo, o vértice cuja remoção perde menos área.
  function reduceToQuad(hull) {
    const poly = hull.slice();
    const triArea = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    while (poly.length > 4) {
      let minA = Infinity, idx = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = triArea(poly[(i - 1 + poly.length) % poly.length], poly[i], poly[(i + 1) % poly.length]);
        if (a < minA) { minA = a; idx = i; }
      }
      poly.splice(idx, 1);
    }
    return poly;
  }

  function polygonArea(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
  }

  // Ordena os cantos como: superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo.
  function orderCorners(pts) {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const sorted = pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    // começa pelo de menor x+y (superior-esquerdo)
    let start = 0;
    for (let i = 1; i < 4; i++) if (sorted[i][0] + sorted[i][1] < sorted[start][0] + sorted[start][1]) start = i;
    return [0, 1, 2, 3].map(i => sorted[(start + i) % 4].slice());
  }

  function defaultCorners(w, h, inset = 0) {
    const ix = w * inset, iy = h * inset;
    return [[ix, iy], [w - ix, iy], [w - ix, h - iy], [ix, h - iy]];
  }

  /** Detecta a foto sobre o fundo. Retorna 4 cantos (coordenadas da imagem) ou null. */
  function detectCorners(src) {
    const S = 360;
    const small = scaledCopy(src, S);
    const w = small.width, h = small.height;
    const scale = src.width / w;
    const raw = small.getContext('2d').getImageData(0, 0, w, h).data;

    // Desfoque leve (box 3x3) para reduzir ruído e textura.
    const px = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = (yy * w + xx) * 4;
        r += raw[k]; g += raw[k + 1]; b += raw[k + 2]; n++;
      }
      const o = (y * w + x) * 3;
      px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n;
    }

    // Cor do fundo = mediana da borda da imagem.
    const border = [[], [], []];
    const bw = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= bw && y >= bw && x < w - bw && y < h - bw) continue;
      const o = (y * w + x) * 3;
      border[0].push(px[o]); border[1].push(px[o + 1]); border[2].push(px[o + 2]);
    }
    const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const bg = border.map(med);

    // Distância de cada pixel ao fundo + limiar de Otsu.
    const dist = new Float32Array(w * h);
    const hist = new Float64Array(256);
    const MAXD = 442;
    for (let i = 0; i < w * h; i++) {
      const o = i * 3;
      const d = Math.hypot(px[o] - bg[0], px[o + 1] - bg[1], px[o + 2] - bg[2]);
      dist[i] = d;
      hist[Math.min(255, Math.floor(d / MAXD * 256))]++;
    }
    const thr = Math.max(18, (otsu(hist, w * h) + 0.5) / 256 * MAXD);
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = dist[i] > thr ? 1 : 0;

    // Fechamento morfológico simples (dilata e erode) para preencher áreas da foto parecidas com o fundo.
    const morph = (m, dilate) => {
      const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = dilate ? 0 : 1;
        for (let dy = -2; dy <= 2 && v === (dilate ? 0 : 1); dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
          if (dilate ? m[yy * w + xx] : !m[yy * w + xx]) { v = dilate ? 1 : 0; break; }
        }
        out[y * w + x] = v;
      }
      return out;
    };
    const closed = morph(morph(mask, true), false);

    // Maior componente conexo.
    const label = new Int32Array(w * h);
    let bestLabel = 0, bestSize = 0, cur = 0;
    const stack = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!closed[i] || label[i]) continue;
      cur++;
      let sp = 0, size = 0;
      stack[sp++] = i; label[i] = cur;
      while (sp) {
        const p = stack[--sp]; size++;
        const x = p % w, y = (p / w) | 0;
        if (x > 0 && closed[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack[sp++] = p - 1; }
        if (x < w - 1 && closed[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack[sp++] = p + 1; }
        if (y > 0 && closed[p - w] && !label[p - w]) { label[p - w] = cur; stack[sp++] = p - w; }
        if (y < h - 1 && closed[p + w] && !label[p + w]) { label[p + w] = cur; stack[sp++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = cur; }
    }
    if (!bestLabel || bestSize < w * h * 0.05) return null;

    // Pontos de contorno do componente -> envoltória convexa -> quadrilátero.
    const pts = [];
    for (let y = 0; y < h; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < w; x++) if (label[y * w + x] === bestLabel) { if (first < 0) first = x; last = x; }
      if (first >= 0) { pts.push([first, y]); pts.push([last + 1, y]); }
    }
    const hull = convexHull(pts);
    if (hull.length < 4) return null;
    const quad = reduceToQuad(hull);
    const area = polygonArea(quad);
    if (area < w * h * 0.05 || area > w * h * 0.97) return null;
    return orderCorners(quad.map(([x, y]) => [x * scale, y * scale]));
  }

  // ---------- Correção de perspectiva ----------

  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let max = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[max][i])) max = r;
      [A[i], A[max]] = [A[max], A[i]]; [b[i], b[max]] = [b[max], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // Homografia que leva pontos de `from` para `to`.
  function homography(from, to) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = from[i], [u, v] = to[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b);
    return [...h, 1];
  }

  function outputSize(c) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    return {
      w: Math.max(d(c[0], c[1]), d(c[3], c[2])),
      h: Math.max(d(c[0], c[3]), d(c[1], c[2])),
    };
  }

  /** Recorta o quadrilátero `corners` de `src` e o "endireita" num retângulo. */
  function warp(src, corners, maxDim = 4000) {
    const c = orderCorners(corners);
    let { w, h } = outputSize(c);
    const s = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    const H = homography([[0, 0], [w, 0], [w, h], [0, h]], c);

    const sw = src.width, sh = src.height;
    const sdata = src.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = makeCanvas(w, h);
    const octx = out.getContext('2d');
    const img = octx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const yy = y + 0.5;
      for (let x = 0; x < w; x++) {
        const xx = x + 0.5;
        const z = H[6] * xx + H[7] * yy + H[8];
        let sx = (H[0] * xx + H[1] * yy + H[2]) / z - 0.5;
        let sy = (H[3] * xx + H[4] * yy + H[5]) / z - 0.5;
        sx = Math.min(sw - 1.001, Math.max(0, sx));
        sy = Math.min(sh - 1.001, Math.max(0, sy));
        const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        const o = (y * w + x) * 4;
        for (let k = 0; k < 3; k++) {
          const top = sdata[i00 + k] + (sdata[i10 + k] - sdata[i00 + k]) * fx;
          const bot = sdata[i01 + k] + (sdata[i11 + k] - sdata[i01 + k]) * fx;
          d[o + k] = top + (bot - top) * fy;
        }
        d[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  // ---------- Ajustes de cor ----------

  /** Calcula níveis automáticos por canal (corrige desbotamento e tons amarelados). */
  function computeLevels(canvas) {
    const small = scaledCopy(canvas, 600);
    // Ignora 8% de cada lado (bordas brancas típicas de fotos impressas).
    const mx = Math.round(small.width * 0.08), my = Math.round(small.height * 0.08);
    const data = small.getContext('2d').getImageData(mx, my, small.width - 2 * mx, small.height - 2 * my).data;
    const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++; }
    return hist.map(hh => {
      const lowCut = n * 0.005, highCut = n * 0.995;
      let acc = 0, lo = 0, hi = 255;
      for (let i = 0; i < 256; i++) { acc += hh[i]; if (acc >= lowCut) { lo = i; break; } }
      acc = 0;
      for (let i = 0; i < 256; i++) { acc += hh[i]; if (acc >= highCut) { hi = i; break; } }
      // Limita o ganho para não exagerar em fotos com pouco contraste.
      const MAX_GAIN = 1.8;
      if (hi - lo < 255 / MAX_GAIN) {
        const mid = (lo + hi) / 2, half = 255 / MAX_GAIN / 2;
        lo = Math.max(0, mid - half); hi = Math.min(255, mid + half);
        if (hi === 255) lo = 255 - 2 * half;
        if (lo === 0) hi = 2 * half;
      }
      return [lo, hi];
    });
  }

  function sharpenData(data, w, h, amount) {
    if (amount <= 0) return;
    const src = new Uint8ClampedArray(data);
    const a = amount;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const o = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        const c = src[o + k];
        const blur = (src[o - 4 + k] + src[o + 4 + k] + src[o - w * 4 + k] + src[o + w * 4 + k]) / 4;
        data[o + k] = c + (c - blur) * a;
      }
    }
  }

  /** Aplica os ajustes e devolve um novo canvas. `levels` vem de computeLevels(). */
  function applyAdjustments(src, opt, levels) {
    const w = src.width, h = src.height;
    const out = makeCanvas(w, h);
    const ctx = out.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const contrast = 1 + opt.contrast / 100 * (opt.contrast > 0 ? 1 : 0.7);
    const bright = opt.brightness * 0.8;
    const sat = 1 + opt.saturation / 100 + (opt.restore ? 0.12 : 0);
    const warm = opt.warmth * 0.25;

    // LUT por canal: níveis -> contraste -> brilho -> temperatura
    const lut = [0, 1, 2].map(ch => {
      const t = new Uint8ClampedArray(256);
      const [lo, hi] = opt.restore && levels ? levels[ch] : [0, 255];
      const shift = ch === 0 ? warm : ch === 2 ? -warm : warm * 0.15;
      for (let v = 0; v < 256; v++) {
        // Mistura 80% da cor restaurada com 20% da original, para um resultado natural.
        let x = v + ((v - lo) / (hi - lo) * 255 - v) * 0.8;
        x = (x - 128) * contrast + 128 + bright + shift;
        t[v] = x;
      }
      return t;
    });

    for (let i = 0; i < d.length; i += 4) {
      let r = lut[0][d[i]], g = lut[1][d[i + 1]], b = lut[2][d[i + 2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (opt.bw) { r = g = b = l; }
      else if (sat !== 1) { r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    // Nitidez proporcional à resolução, para a prévia e o arquivo final ficarem parecidos.
    sharpenData(d, w, h, opt.sharpen / 100 * 1.2);
    ctx.putImageData(img, 0, 0);
    return out;
  }

  return { makeCanvas, scaledCopy, rotate90, detectCorners, defaultCorners, orderCorners, warp, computeLevels, applyAdjustments };
})();
