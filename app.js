/* Diário do Cachorro — dados salvos no navegador (localStorage) */
'use strict';

const CHAVE = 'diario-pet-v1';
const ESPECIES = { cao: { nome: 'Cão', emoji: '🐶' }, gato: { nome: 'Gato', emoji: '🐱' } };

/* ---------- Estado e armazenamento ---------- */
function estadoVazio() {
  return { versao: 1, petAtual: null, pets: [], pesos: [], racoes: [], saude: [] };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoVazio();
    return Object.assign(estadoVazio(), JSON.parse(bruto));
  } catch (e) {
    console.warn('Falha ao ler dados salvos', e);
    return estadoVazio();
  }
}

let estado = carregar();

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    const av = document.getElementById('aviso-armazenamento');
    if (av) av.hidden = false;
  }
}

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (sel) => document.querySelector(sel);

// Confirmação no próprio botão: o 1º toque pede confirmação, o 2º executa.
// (Evita confirm(), que é bloqueado em alguns visualizadores.)
function pedeConfirmacao(btn, texto = 'Confirmar?') {
  if (btn.dataset.confirmando === '1') return true;
  btn.dataset.confirmando = '1';
  btn.dataset.textoOriginal = btn.textContent;
  btn.textContent = texto;
  btn.classList.add('confirmando');
  setTimeout(() => {
    if (!btn.isConnected) return;
    btn.dataset.confirmando = '';
    btn.textContent = btn.dataset.textoOriginal;
    btn.classList.remove('confirmando');
  }, 4000);
  return false;
}

/* ---------- Datas e números ---------- */
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Converte 'AAAA-MM-DD' para Date local (sem deslocamento de fuso)
function dataLocal(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}
function fmtData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function fmtDataCurta(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(2)}`;
}
const fmtNum = (n, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtKg = (n) => fmtNum(n) + ' kg';
function lerNumero(txt) {
  const n = Number(String(txt).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Pets ---------- */
function petAtual() {
  return estado.pets.find((p) => p.id === estado.petAtual) || null;
}

function renderSeletorPet() {
  const sel = $('#pet-atual');
  if (!estado.pets.length) {
    sel.innerHTML = '<option value="">Nenhum pet</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = estado.pets
    .map((p) => `<option value="${p.id}">${ESPECIES[p.especie].emoji} ${esc(p.nome)}</option>`)
    .join('');
  sel.value = estado.petAtual;
}

function renderListaPets() {
  const ul = $('#lista-pets');
  if (!estado.pets.length) {
    ul.innerHTML = '<li class="vazio">Nenhum pet cadastrado.</li>';
    return;
  }
  ul.innerHTML = estado.pets
    .map((p) => `
      <li>
        <span aria-hidden="true">${ESPECIES[p.especie].emoji}</span>
        <div class="info">
          <div class="principal">${esc(p.nome)}</div>
          <div class="secundario">${ESPECIES[p.especie].nome}${p.raca ? ' · ' + esc(p.raca) : ''}</div>
        </div>
        <button type="button" class="btn pequeno" data-editar-pet="${p.id}">Editar</button>
        <button type="button" class="btn pequeno perigo" data-remover-pet="${p.id}">Excluir</button>
      </li>`)
    .join('');
}

function abrirPainelPets() {
  $('#painel-pets').hidden = false;
  limparFormPet();
  renderListaPets();
  $('#painel-pets').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function fecharPainelPets() {
  $('#painel-pets').hidden = true;
}

function limparFormPet() {
  $('#form-pet').reset();
  $('#pet-id').value = '';
  $('#form-pet-titulo').textContent = 'Adicionar pet';
  $('#btn-salvar-pet').textContent = 'Adicionar';
  $('#btn-cancelar-pet').hidden = true;
  $('#pet-erro').hidden = true;
}

function editarPet(id) {
  const p = estado.pets.find((x) => x.id === id);
  if (!p) return;
  $('#pet-id').value = p.id;
  $('#pet-nome').value = p.nome;
  $('#pet-especie').value = p.especie;
  $('#pet-raca').value = p.raca || '';
  $('#form-pet-titulo').textContent = `Editar ${p.nome}`;
  $('#btn-salvar-pet').textContent = 'Salvar alterações';
  $('#btn-cancelar-pet').hidden = false;
  $('#pet-nome').focus();
}

function removerPet(id, btn) {
  const p = estado.pets.find((x) => x.id === id);
  if (!p) return;
  if (!pedeConfirmacao(btn, 'Apagar tudo?')) return;
  estado.pets = estado.pets.filter((x) => x.id !== id);
  for (const k of ['pesos', 'racoes', 'saude']) estado[k] = estado[k].filter((r) => r.petId !== id);
  if (estado.petAtual === id) estado.petAtual = estado.pets[0]?.id || null;
  salvar();
  renderTudo();
  renderListaPets();
}

$('#form-pet').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('#pet-nome').value.trim();
  const especie = $('#pet-especie').value;
  const raca = $('#pet-raca').value.trim();
  const erro = $('#pet-erro');
  if (!nome) { erro.textContent = 'Informe o nome do pet.'; erro.hidden = false; return; }
  if (!ESPECIES[especie]) { erro.textContent = 'Escolha cão ou gato.'; erro.hidden = false; return; }
  const id = $('#pet-id').value;
  if (id) {
    Object.assign(estado.pets.find((p) => p.id === id), { nome, especie, raca });
  } else {
    const p = { id: novoId(), nome, especie, raca };
    estado.pets.push(p);
    estado.petAtual = p.id;
  }
  salvar();
  limparFormPet();
  renderTudo();
  renderListaPets();
  if (!id) fecharPainelPets();
});

$('#lista-pets').addEventListener('click', (ev) => {
  const ed = ev.target.closest('[data-editar-pet]');
  const rm = ev.target.closest('[data-remover-pet]');
  if (ed) editarPet(ed.dataset.editarPet);
  if (rm) removerPet(rm.dataset.removerPet, rm);
});
$('#btn-cancelar-pet').addEventListener('click', limparFormPet);
$('#btn-pets').addEventListener('click', () => ($('#painel-pets').hidden ? abrirPainelPets() : fecharPainelPets()));
$('#btn-fechar-pets').addEventListener('click', fecharPainelPets);
$('#btn-primeiro-pet').addEventListener('click', abrirPainelPets);
$('#pet-atual').addEventListener('change', (ev) => {
  estado.petAtual = ev.target.value;
  salvar();
  renderTudo();
});

/* ---------- Peso ---------- */
function pesosDoPet() {
  return estado.pesos
    .filter((r) => r.petId === estado.petAtual)
    .sort((a, b) => (a.data === b.data ? a.criado - b.criado : a.data < b.data ? -1 : 1));
}

$('#form-peso').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const erro = $('#peso-erro');
  const data = $('#peso-data').value;
  const kg = lerNumero($('#peso-kg').value);
  const obs = $('#peso-obs').value.trim();
  let msg = '';
  if (!petAtual()) msg = 'Cadastre um pet primeiro.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) msg = 'Informe a data.';
  else if (data > hojeISO()) msg = 'A data não pode estar no futuro.';
  else if (!(kg >= 0.3 && kg <= 120)) msg = 'Informe um peso válido em kg (ex.: 6,2).';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  erro.hidden = true;
  estado.pesos.push({ id: novoId(), petId: estado.petAtual, data, kg: Math.round(kg * 100) / 100, obs, criado: Date.now() });
  salvar();
  $('#peso-kg').value = '';
  $('#peso-obs').value = '';
  renderPeso();
});

$('#lista-peso').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-remover-peso]');
  if (!b) return;
  const r = estado.pesos.find((x) => x.id === b.dataset.removerPeso);
  if (r && pedeConfirmacao(b)) {
    estado.pesos = estado.pesos.filter((x) => x.id !== r.id);
    salvar();
    renderPeso();
  }
});

function renderPeso() {
  const regs = pesosDoPet();

  // Histórico (mais recente primeiro), com variação em relação ao registro anterior
  const ul = $('#lista-peso');
  if (!regs.length) {
    ul.innerHTML = '<li class="vazio">Nenhum peso registrado ainda.</li>';
  } else {
    ul.innerHTML = regs
      .map((r, i) => {
        const ant = regs[i - 1];
        let delta = '';
        if (ant) {
          const d = Math.round((r.kg - ant.kg) * 100) / 100;
          delta = d === 0 ? '= 0,00' : (d > 0 ? '▲ +' : '▼ ') + d.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        }
        return `
        <li>
          <div class="info">
            <div class="principal">${fmtKg(r.kg)} <span class="delta">${delta}</span></div>
            <div class="secundario">${fmtData(r.data)}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
          </div>
          <button type="button" class="btn pequeno perigo" data-remover-peso="${r.id}" aria-label="Excluir registro de ${fmtData(r.data)}">Excluir</button>
        </li>`;
      })
      .reverse()
      .join('');
  }

  // Resumo
  const est = $('#peso-estat');
  if (regs.length) {
    const ult = regs[regs.length - 1];
    const prim = regs[0];
    const var_ = Math.round((ult.kg - prim.kg) * 100) / 100;
    const min = Math.min(...regs.map((r) => r.kg));
    const max = Math.max(...regs.map((r) => r.kg));
    est.innerHTML = `
      <div class="bloco"><div class="rot">Atual</div><div class="val">${fmtKg(ult.kg)}</div></div>
      <div class="bloco"><div class="rot">Variação total</div><div class="val">${var_ > 0 ? '+' : ''}${fmtKg(var_)}</div></div>
      <div class="bloco"><div class="rot">Mín · Máx</div><div class="val">${fmtNum(min)} · ${fmtNum(max)}</div></div>`;
  } else {
    est.innerHTML = '';
  }

  desenharGrafico($('#grafico-peso'), regs);
}

/* ---------- Gráfico de linha (SVG) ---------- */
function desenharGrafico(cont, regs) {
  if (regs.length < 2) {
    cont.innerHTML = `<p class="vazio">${regs.length ? 'Registre mais um peso para ver o gráfico.' : 'Sem dados ainda.'}</p>`;
    return;
  }
  const L = Math.max(280, cont.clientWidth || 320);
  const A = 200;
  const m = { t: 14, r: 12, b: 26, l: 40 };
  const w = L - m.l - m.r;
  const h = A - m.t - m.b;

  const xs = regs.map((r) => dataLocal(r.data).getTime());
  const ys = regs.map((r) => r.kg);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const folga = Math.max((y1 - y0) * 0.15, 0.1);
  y0 -= folga; y1 += folga;

  // Marcas do eixo Y com passo "redondo"
  const passos = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
  const passo = passos.find((p) => (y1 - y0) / p <= 5) || 10;
  const ticksY = [];
  for (let v = Math.ceil(y0 / passo) * passo; v <= y1 + 1e-9; v += passo) ticksY.push(Math.round(v * 100) / 100);

  const casasY = passo < 0.1 ? 2 : passo < 1 ? 1 : 0;
  const px = (t) => m.l + ((t - x0) / (x1 - x0)) * w;
  const py = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * h;

  // Até 4 rótulos de data no eixo X, sem sobreposição
  const nx = Math.min(regs.length, Math.max(2, Math.floor(w / 80)));
  const idxX = [...new Set(Array.from({ length: nx }, (_, i) => Math.round((i * (regs.length - 1)) / (nx - 1))))];

  const pts = regs.map((r, i) => [px(xs[i]), py(r.kg)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const mostrarPontos = regs.length <= 40;

  cont.innerHTML = `
    <svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Gráfico de peso: de ${fmtKg(ys[0])} em ${fmtData(regs[0].data)} a ${fmtKg(ys[ys.length - 1])} em ${fmtData(regs[regs.length - 1].data)}">
      ${ticksY.map((v) => `
        <line class="grade" x1="${m.l}" x2="${L - m.r}" y1="${py(v)}" y2="${py(v)}"/>
        <text class="eixo" x="${m.l - 6}" y="${py(v) + 4}" text-anchor="end">${fmtNum(v, casasY)}</text>`).join('')}
      ${idxX.map((i, k) => `
        <text class="eixo" x="${px(xs[i])}" y="${A - 6}" text-anchor="${k === 0 ? 'start' : k === idxX.length - 1 ? 'end' : 'middle'}">${fmtDataCurta(regs[i].data)}</text>`).join('')}
      <path class="linha-serie" d="${d}"/>
      ${mostrarPontos ? pts.map((p) => `<circle class="ponto" cx="${p[0]}" cy="${p[1]}" r="4"/>`).join('') : ''}
      <line class="mira" x1="0" x2="0" y1="${m.t}" y2="${m.t + h}" visibility="hidden"/>
      <circle class="ponto foco" r="6" visibility="hidden"/>
      <rect x="${m.l}" y="0" width="${w}" height="${A}" fill="transparent" class="alvo"/>
    </svg>
    <div class="dica" hidden></div>`;

  // Camada de interação: dedo/mouse mostra o ponto mais próximo
  const svg = cont.querySelector('svg');
  const mira = svg.querySelector('.mira');
  const foco = svg.querySelector('.foco');
  const dica = cont.querySelector('.dica');
  function mostrar(ev) {
    const caixa = svg.getBoundingClientRect();
    const escala = L / caixa.width;
    const x = (ev.clientX - caixa.left) * escala;
    let i = 0;
    for (let k = 1; k < pts.length; k++) if (Math.abs(pts[k][0] - x) < Math.abs(pts[i][0] - x)) i = k;
    const [cx, cy] = pts[i];
    mira.setAttribute('x1', cx); mira.setAttribute('x2', cx); mira.setAttribute('visibility', 'visible');
    foco.setAttribute('cx', cx); foco.setAttribute('cy', cy); foco.setAttribute('visibility', 'visible');
    dica.hidden = false;
    dica.textContent = `${fmtData(regs[i].data)} · ${fmtKg(regs[i].kg)}`;
    const larg = dica.offsetWidth / 2;
    const left = Math.min(Math.max(cx / escala, larg), caixa.width - larg);
    dica.style.left = left + 'px';
    dica.style.top = cy / escala + 'px';
  }
  function esconder() {
    mira.setAttribute('visibility', 'hidden');
    foco.setAttribute('visibility', 'hidden');
    dica.hidden = true;
  }
  svg.addEventListener('pointermove', mostrar);
  svg.addEventListener('pointerdown', mostrar);
  svg.addEventListener('pointerleave', esconder);
}

let tRedim;
window.addEventListener('resize', () => {
  clearTimeout(tRedim);
  tRedim = setTimeout(() => petAtual() && desenharGrafico($('#grafico-peso'), pesosDoPet()), 150);
});

/* ---------- Render geral ---------- */
function renderTudo() {
  if (estado.petAtual && !petAtual()) estado.petAtual = estado.pets[0]?.id || null;
  if (!estado.petAtual && estado.pets.length) estado.petAtual = estado.pets[0].id;
  renderSeletorPet();
  const temPet = !!petAtual();
  $('#sem-pets').hidden = temPet;
  $('#aba-peso').hidden = !temPet;
  if (temPet) renderPeso();
}

$('#peso-data').value = hojeISO();
$('#peso-data').max = hojeISO();
renderTudo();
