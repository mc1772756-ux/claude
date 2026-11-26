/* Diário do Pet — ícones de raças desenhados em SVG (originais, sem imagens externas).
   Cada ícone é uma combinação de orelha, focinho, pelagem e manchas. */
'use strict';

const ICONES = {
  // ---------- cães ----------
  'cao-caramelo': { nome: 'Vira-lata caramelo', especie: 'cao', fundo: '#fde7c8', base: '#d8913c', focinho: '#f0c48a', orelha: 'caida', lingua: true },
  'cao-srd-preto': { nome: 'Vira-lata preto', especie: 'cao', fundo: '#e3e6ee', base: '#2f2f35', focinho: '#4a4a52', orelha: 'dobrada', peito: '#f4f1ea', olhos: '#8a5a2b' },
  'cao-jack-russell': { nome: 'Jack Russell', especie: 'cao', fundo: '#e4f1e2', base: '#f7f4ee', focinho: '#f7f4ee', orelha: 'dobrada', orelhaCor: '#b8742f', mancha: 'olho', manchaCor: '#b8742f' },
  'cao-fox-paulistinha': { nome: 'Fox Paulistinha', especie: 'cao', fundo: '#e2ecf6', base: '#f7f4ee', focinho: '#f7f4ee', orelha: 'dobrada', orelhaCor: '#222226', mancha: 'tricolor', manchaCor: '#222226', tanCor: '#c98a45' },
  'cao-yorkshire': { nome: 'Yorkshire', especie: 'cao', fundo: '#f6e6ef', base: '#c99555', focinho: '#d9a868', orelha: 'empe', orelhaCor: '#c99555', topo: '#59606e', pelo: 'longo', laco: '#e0457b' },
  'cao-shih-tzu': { nome: 'Shih Tzu', especie: 'cao', fundo: '#f3ecdf', base: '#f6f1e7', focinho: '#f6f1e7', orelha: 'longa', orelhaCor: '#c9a06a', mancha: 'olho2', manchaCor: '#c9a06a', pelo: 'longo', focinhoTipo: 'curto', laco: '#3b82f6' },
  'cao-poodle': { nome: 'Poodle', especie: 'cao', fundo: '#ddd0ec', base: '#f2ebe0', focinho: '#f2ebe0', orelha: 'cacheada', pelo: 'cacheado' },
  'cao-poodle-preto': { nome: 'Poodle preto', especie: 'cao', fundo: '#e6e8ee', base: '#2c2c31', focinho: '#3a3a40', orelha: 'cacheada', pelo: 'cacheado', olhos: '#8a5a2b' },
  'cao-labrador': { nome: 'Labrador', especie: 'cao', fundo: '#fbefcf', base: '#e7c27a', focinho: '#efd39c', orelha: 'caida', orelhaCor: '#d8ad5f' },
  'cao-golden': { nome: 'Golden Retriever', especie: 'cao', fundo: '#fde4c4', base: '#d99a45', focinho: '#e8b673', orelha: 'caida', orelhaCor: '#c4822e', pelo: 'fofo' },
  'cao-pinscher': { nome: 'Pinscher', especie: 'cao', fundo: '#f7e1dc', base: '#26262b', focinho: '#b0642c', orelha: 'empe', tan: true, tanCor: '#b0642c', olhos: '#8a5a2b' },
  'cao-dachshund': { nome: 'Dachshund (salsicha)', especie: 'cao', fundo: '#f6e3d3', base: '#a8582a', focinho: '#b96a3a', orelha: 'longa', orelhaCor: '#8e4720', focinhoTipo: 'longo' },
  'cao-bulldog-frances': { nome: 'Bulldog Francês', especie: 'cao', fundo: '#e7eef6', base: '#dcc6a6', focinho: '#cdb08a', orelha: 'morcego', focinhoTipo: 'achatado', mascara: '#4a4038' },
  'cao-pug': { nome: 'Pug', especie: 'cao', fundo: '#f2ead9', base: '#e5cfa5', focinho: '#2e2a28', orelha: 'dobrada', orelhaCor: '#2e2a28', focinhoTipo: 'achatado', lingua: true },
  'cao-spitz': { nome: 'Spitz Alemão (Lulu)', especie: 'cao', fundo: '#fde6d2', base: '#ec9a48', focinho: '#f6c08a', orelha: 'empe', pelo: 'fofo', focinhoTipo: 'curto' },
  'cao-beagle': { nome: 'Beagle', especie: 'cao', fundo: '#eaf3e4', base: '#c47f3a', focinho: '#f7f4ee', orelha: 'longa', orelhaCor: '#9b5d24', mancha: 'blaze' },
  'cao-border-collie': { nome: 'Border Collie', especie: 'cao', fundo: '#e1edf5', base: '#24242a', focinho: '#f5f2ec', orelha: 'dobrada', mancha: 'blaze', peito: '#f5f2ec', olhos: '#8a5a2b' },
  'cao-husky': { nome: 'Husky', especie: 'cao', fundo: '#dfeaf6', base: '#6f7785', focinho: '#f5f5f5', orelha: 'empe', mancha: 'husky', olhos: '#4aa3df' },
  // ---------- gatos ----------
  'gato-laranja': { nome: 'Laranja tigrado', especie: 'gato', fundo: '#fde3c9', base: '#e89a4e', listra: '#c06a24', olhos: '#7fb04a' },
  'gato-cinza': { nome: 'Cinza tigrado', especie: 'gato', fundo: '#e6e9ef', base: '#9aa0aa', listra: '#5f6570', olhos: '#c9a83b' },
  'gato-preto': { nome: 'Preto', especie: 'gato', fundo: '#ece6f5', base: '#26262b', olhos: '#d8b93a' },
  'gato-branco': { nome: 'Branco', especie: 'gato', fundo: '#e3eef8', base: '#f7f6f2', olhos: '#5aa6d8' },
  'gato-frajola': { nome: 'Frajola', especie: 'gato', fundo: '#e7ecf2', base: '#26262b', padrao: 'frajola', olhos: '#9cc24a' },
  'gato-escaminha': { nome: 'Escaminha', especie: 'gato', fundo: '#f7e6dc', base: '#2b2522', padrao: 'escaminha', olhos: '#d9a23a' },
  'gato-siames': { nome: 'Siamês', especie: 'gato', fundo: '#e1eef8', base: '#efe3cf', padrao: 'pontas', pontaCor: '#5a4232', olhos: '#4aa3df' },
  'gato-persa': { nome: 'Persa', especie: 'gato', fundo: '#dbe7f3', base: '#efdcc2', pelo: 'longo', rosto: 'achatado', olhos: '#d38b2e' },
  'gato-maine-coon': { nome: 'Maine Coon', especie: 'gato', fundo: '#efe5d8', base: '#8a6a4c', listra: '#4f3a28', pelo: 'longo', tufos: true, olhos: '#9fbf3e' },
  'gato-angora': { nome: 'Angorá', especie: 'gato', fundo: '#cfe0f1', base: '#fbfaf6', pelo: 'longo', olhos: '#4aa3df' },
};

function svgIcone(id, tam = 64) {
  const o = ICONES[id] || ICONES['cao-caramelo'];
  const corpo = o.especie === 'gato' ? desenharGato(o) : desenharCao(o);
  return `<svg class="icone-pet" viewBox="0 0 64 64" width="${tam}" height="${tam}" role="img" aria-label="${o.nome}">` +
    `<circle cx="32" cy="32" r="32" fill="${o.fundo}"/>${corpo}</svg>`;
}

// Contorno "fofo" ao redor da cabeça (pelo longo)
function fofo(cx, cy, r1, r2, n, cor) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${cor}" stroke-linejoin="round"/>`;
}

function desenharCao(o) {
  const oc = o.orelhaCor || o.base;
  const escuro = '#2a2a2e';
  let s = '';
  // pelo fofo / longo atrás
  if (o.pelo === 'fofo') s += fofo(32, 35, 23, 19, 14, o.base);
  if (o.peito) s += `<path d="M22,52 Q32,62 42,52 L40,64 L24,64 Z" fill="${o.peito}"/>`;
  // orelhas de trás
  if (o.orelha === 'empe') {
    s += `<polygon points="15,28 15,5 29,18" fill="${oc}"/><polygon points="49,28 49,5 35,18" fill="${oc}"/>`;
    s += `<polygon points="17.5,24 17.5,11 26,18.5" fill="#f2b8b0" opacity=".8"/><polygon points="46.5,24 46.5,11 38,18.5" fill="#f2b8b0" opacity=".8"/>`;
  } else if (o.orelha === 'morcego') {
    s += `<path d="M16,27 Q6,3 29,17 Z" fill="${oc}"/><path d="M48,27 Q58,3 35,17 Z" fill="${oc}"/>`;
    s += `<path d="M18,24 Q12,9 27,18 Z" fill="#f0b0a8"/><path d="M46,24 Q52,9 37,18 Z" fill="#f0b0a8"/>`;
  } else if (o.orelha === 'caida') {
    s += `<ellipse cx="15" cy="35" rx="7" ry="12" transform="rotate(18 15 35)" fill="${oc}"/><ellipse cx="49" cy="35" rx="7" ry="12" transform="rotate(-18 49 35)" fill="${oc}"/>`;
  } else if (o.orelha === 'longa') {
    s += `<ellipse cx="14" cy="40" rx="7" ry="15" transform="rotate(10 14 40)" fill="${oc}"/><ellipse cx="50" cy="40" rx="7" ry="15" transform="rotate(-10 50 40)" fill="${oc}"/>`;
  } else if (o.orelha === 'cacheada') {
    for (const [x, y] of [[13, 34], [11, 41], [14, 47], [51, 34], [53, 41], [50, 47]]) s += `<circle cx="${x}" cy="${y}" r="6" fill="${o.base}"/>`;
  }
  // cabeça
  const rx = o.focinhoTipo === 'achatado' ? 18.5 : 17;
  s += `<ellipse cx="32" cy="34" rx="${rx}" ry="16.5" fill="${o.base}"/>`;
  if (o.pelo === 'cacheado') for (const [x, y, r] of [[24, 19, 6], [32, 16, 7], [40, 19, 6], [28, 14, 5], [36, 14, 5]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${o.base}"/>`;
  // manchas e máscaras
  if (o.topo) s += `<path d="M15.5,30 Q16,17.5 32,17.5 Q48,17.5 48.5,30 Q40,24 32,25 Q24,24 15.5,30 Z" fill="${o.topo}"/>`;
  if (o.mancha === 'olho') s += `<ellipse cx="24" cy="30" rx="7.5" ry="7" fill="${o.manchaCor}"/>`;
  if (o.mancha === 'olho2') s += `<ellipse cx="24" cy="30" rx="6.5" ry="6" fill="${o.manchaCor}"/><ellipse cx="40" cy="30" rx="6.5" ry="6" fill="${o.manchaCor}"/>`;
  if (o.mancha === 'tricolor') {
    s += `<path d="M15.5,36 Q15,18 32,17.5 Q49,18 48.5,36 Q44,30 36,31 L35,22 Q32,20 29,22 L28,31 Q20,30 15.5,36 Z" fill="${o.manchaCor}"/>`;
    s += `<circle cx="25" cy="27" r="1.8" fill="${o.tanCor}"/><circle cx="39" cy="27" r="1.8" fill="${o.tanCor}"/>`;
    s += `<ellipse cx="22" cy="38" rx="4" ry="3" fill="${o.tanCor}"/><ellipse cx="42" cy="38" rx="4" ry="3" fill="${o.tanCor}"/>`;
  }
  if (o.mancha === 'blaze') s += `<path d="M29.5,18 Q32,16.5 34.5,18 L35,34 L29,34 Z" fill="${o.focinho}"/>`;
  if (o.mancha === 'husky') {
    s += `<path d="M15.5,36 Q20,30 26,33 Q29,27 32,27 Q35,27 38,33 Q44,30 48.5,36 Q47,50 32,50.5 Q17,50 15.5,36 Z" fill="#f5f5f5"/>`;
    s += `<ellipse cx="25" cy="27" rx="2.6" ry="1.6" fill="#f5f5f5"/><ellipse cx="39" cy="27" rx="2.6" ry="1.6" fill="#f5f5f5"/>`;
  }
  if (o.tan) s += `<circle cx="25.5" cy="27" r="1.9" fill="${o.tanCor}"/><circle cx="38.5" cy="27" r="1.9" fill="${o.tanCor}"/>`;
  // orelhas dobradas (na frente)
  if (o.orelha === 'dobrada') s += `<path d="M16,25 Q17,14 27,17 Q24,22 21,27 Z" fill="${oc}"/><path d="M48,25 Q47,14 37,17 Q40,22 43,27 Z" fill="${oc}"/>`;
  // pelo longo caindo nas laterais (Yorkshire, Shih Tzu)
  if (o.pelo === 'longo') s += `<path d="M15,32 Q11,48 17,58 Q22,56 24,40 Z" fill="${o.base}"/><path d="M49,32 Q53,48 47,58 Q42,56 40,40 Z" fill="${o.base}"/>`;
  // focinho
  const [fy, frx, fry] = o.focinhoTipo === 'longo' ? [43, 8.5, 8] : o.focinhoTipo === 'achatado' ? [40.5, 10, 6] : o.focinhoTipo === 'curto' ? [41, 8.5, 6] : [42, 10, 7];
  s += `<ellipse cx="32" cy="${fy}" rx="${frx}" ry="${fry}" fill="${o.focinho}"/>`;
  if (o.mascara) s += `<ellipse cx="32" cy="${fy - 1}" rx="${frx - 2}" ry="${fry - 1.5}" fill="${o.mascara}" opacity=".6"/>`;
  // olhos
  const olho = o.olhos || escuro;
  const oy = 31.5;
  for (const x of [25, 39]) {
    s += `<circle cx="${x}" cy="${oy}" r="2.7" fill="${olho}"/>`;
    if (o.olhos) s += `<circle cx="${x}" cy="${oy}" r="1.2" fill="${escuro}"/>`;
    s += `<circle cx="${x + 0.9}" cy="${oy - 0.9}" r="0.8" fill="#fff"/>`;
  }
  // nariz e boca
  const ny = fy - fry + 2.6;
  s += `<ellipse cx="32" cy="${ny}" rx="3.6" ry="2.6" fill="${escuro}"/><ellipse cx="31" cy="${ny - 0.8}" rx="1" ry="0.6" fill="#fff" opacity=".5"/>`;
  const traco = o.focinho === escuro || o.mascara || o.focinho === '#2e2a28' ? '#cfc6bd' : '#3a3330';
  s += `<path d="M32,${ny + 2.4} v2 M32,${ny + 4.4} q-3,2.2 -5.2,0.2 M32,${ny + 4.4} q3,2.2 5.2,0.2" stroke="${traco}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  if (o.lingua) s += `<path d="M30,${ny + 5.4} q2,4.5 4,0 Z" fill="#e97a8a"/>`;
  // laço
  if (o.laco) s += `<path d="M32,15 L25,11 L25,19 Z M32,15 L39,11 L39,19 Z" fill="${o.laco}"/><circle cx="32" cy="15" r="2.2" fill="${o.laco}"/>`;
  return s;
}

function desenharGato(o) {
  const escuro = o.base === '#26262b' || o.base === '#2b2522';
  let s = '';
  if (o.pelo === 'longo') s += fofo(32, 36, 24, 20, 16, o.base);
  // orelhas
  const orelhaCor = o.padrao === 'pontas' ? o.pontaCor : o.base;
  const pequenas = o.rosto === 'achatado';
  const [e1, e2] = pequenas ? ['16,27 18,13 28,20', '48,27 46,13 36,20'] : ['13,28 15,5 29,18', '51,28 49,5 35,18'];
  s += `<polygon points="${e1}" fill="${orelhaCor}" stroke="${orelhaCor}" stroke-width="2" stroke-linejoin="round"/><polygon points="${e2}" fill="${orelhaCor}" stroke="${orelhaCor}" stroke-width="2" stroke-linejoin="round"/>`;
  const [i1, i2] = pequenas ? ['18.5,24 19.5,16 25.5,20.5', '45.5,24 44.5,16 38.5,20.5'] : ['16.5,24 17.5,12 26,18.5', '47.5,24 46.5,12 38,18.5'];
  s += `<polygon points="${i1}" fill="#f4b6b8" opacity=".85"/><polygon points="${i2}" fill="#f4b6b8" opacity=".85"/>`;
  if (o.tufos) s += `<path d="M15,6 l-0.8,-2.6 M15,6 l1.2,-2.6 M49,6 l0.8,-2.6 M49,6 l-1.2,-2.6" stroke="${o.base}" stroke-width="1.6" stroke-linecap="round"/>`;
  // cabeça
  s += `<ellipse cx="32" cy="35" rx="19.5" ry="16.5" fill="${o.base}"/>`;
  // padrões
  if (o.listra) {
    s += `<path d="M26,21 l2,6 M32,19.5 v7 M38,21 l-2,6" stroke="${o.listra}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    s += `<path d="M13.5,33 l6,1.5 M13.5,38 l6,0 M50.5,33 l-6,1.5 M50.5,38 l-6,0" stroke="${o.listra}" stroke-width="2" stroke-linecap="round"/>`;
  }
  if (o.padrao === 'frajola') s += `<path d="M22,51 Q20,40 26,37 Q29,33 32,33 Q35,33 38,37 Q44,40 42,51 Q37,52 32,52 Q27,52 22,51 Z" fill="#f6f4ef"/>`;
  if (o.padrao === 'escaminha') s += `<ellipse cx="22" cy="27" rx="8" ry="6" fill="#d9822b"/><ellipse cx="42" cy="42" rx="7" ry="6" fill="#e9a24a"/><ellipse cx="37" cy="23" rx="4" ry="3" fill="#e9a24a"/>`;
  if (o.padrao === 'pontas') s += `<ellipse cx="32" cy="40" rx="11" ry="10" fill="${o.pontaCor}" opacity=".85"/>`;
  // olhos amendoados
  const achatado = o.rosto === 'achatado';
  const oy = achatado ? 33 : 32;
  const orx = achatado ? 4 : 3.6, ory = achatado ? 3.4 : 2.8;
  for (const x of [24.5, 39.5]) {
    s += `<ellipse cx="${x}" cy="${oy}" rx="${orx}" ry="${ory}" fill="${o.olhos}"/>`;
    s += `<ellipse cx="${x}" cy="${oy}" rx="${achatado ? 1.6 : 0.9}" ry="${ory - 0.4}" fill="#151515"/>`;
    s += `<circle cx="${x + 1.1}" cy="${oy - 1}" r="0.75" fill="#fff"/>`;
  }
  // nariz, boca, bigodes
  const ny = achatado ? 38.5 : 39.5;
  s += `<path d="M29.8,${ny} L34.2,${ny} L32,${ny + 2.4} Z" fill="#e88d97" stroke="#e88d97" stroke-linejoin="round"/>`;
  const traco = escuro || o.padrao === 'pontas' ? '#d9d3cc' : '#5a4f4a';
  s += `<path d="M32,${ny + 2.4} q-2,2.8 -4.4,1.2 M32,${ny + 2.4} q2,2.8 4.4,1.2" stroke="${traco}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M24,${ny + 1} L10,${ny - 1.5} M24,${ny + 2.6} L10,${ny + 3} M40,${ny + 1} L54,${ny - 1.5} M40,${ny + 2.6} L54,${ny + 3}" stroke="${traco}" stroke-width="0.8" opacity=".75" stroke-linecap="round"/>`;
  return s;
}
