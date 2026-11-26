/* Diário do Cachorro — dados salvos no navegador (localStorage) */
'use strict';

const CHAVE = 'diario-pet-v1';
const ESPECIES = { cao: { nome: 'Cão', emoji: '🐶' }, gato: { nome: 'Gato', emoji: '🐱' } };

/* ---------- Estado e armazenamento ---------- */
function estadoVazio() {
  return { versao: 1, petAtual: null, pets: [], pesos: [], racoes: [], saude: [], banhos: [], doencas: [], remedios: [], ecc: [] };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoVazio();
    const e = Object.assign(estadoVazio(), JSON.parse(bruto));
    for (const k of ['pets', 'pesos', 'racoes', 'saude', 'banhos', 'doencas', 'remedios', 'ecc']) if (!Array.isArray(e[k])) e[k] = [];
    return e;
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
  const limpo = String(txt).trim().replace(/\s*(kg|g)\.?$/i, '').replace(/\s/g, '').replace(',', '.');
  const n = limpo === '' ? NaN : Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function diasEntre(isoA, isoB) {
  return Math.round((dataLocal(isoB) - dataLocal(isoA)) / 864e5);
}
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Idade a partir da data de nascimento: "3 anos e 2 meses", "5 meses", "12 dias"
function idadeTexto(nasc, ref = hojeISO()) {
  if (!nasc) return '';
  const [a1, m1, d1] = nasc.split('-').map(Number);
  const [a2, m2, d2] = ref.split('-').map(Number);
  const meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 0) return '';
  if (meses === 0) return plural(diasEntre(nasc, ref), 'dia', 'dias');
  const anos = Math.floor(meses / 12), resto = meses % 12;
  if (!anos) return plural(resto, 'mês', 'meses');
  return plural(anos, 'ano', 'anos') + (resto ? ' e ' + plural(resto, 'mês', 'meses') : '');
}
function idadeDoPet(p) {
  const t = idadeTexto(p.nascimento);
  return t ? (p.nascAprox ? '≈ ' : '') + t : '';
}
// Data de nascimento estimada a partir de anos/meses informados hoje
function nascimentoEstimado(anos, meses) {
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - (anos * 12 + meses), 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(hoje.getDate(), ultimo));
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(alvo.getDate()).padStart(2, '0')}`;
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
    .map((p) => `<option value="${p.id}">${ESPECIES[p.especie].emoji} ${esc(p.nome)}${alertasDoPet(p.id).length ? ' ⚠️' : ''}</option>`)
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
          <div class="secundario">${ESPECIES[p.especie].nome}${p.raca ? ' · ' + esc(p.raca) : ''}${idadeDoPet(p) ? ' · ' + idadeDoPet(p) : ''}</div>
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
  $('#pet-nasc').value = p.nascimento || '';
  $('#pet-idade-anos').value = '';
  $('#pet-idade-meses').value = '';
  $('#form-pet-titulo').textContent = `Editar ${p.nome}`;
  $('#btn-salvar-pet').textContent = 'Salvar alterações';
  $('#btn-cancelar-pet').hidden = false;
  $('#pet-nome').focus();
}

function removerPet(id, btn) {
  const p = estado.pets.find((x) => x.id === id);
  if (!p) return;
  if (!pedeConfirmacao(btn, 'Apagar tudo?')) return;
  if ($('#pet-id').value === id) limparFormPet();
  estado.pets = estado.pets.filter((x) => x.id !== id);
  for (const k of ['pesos', 'racoes', 'saude', 'banhos', 'doencas', 'remedios', 'ecc']) estado[k] = estado[k].filter((r) => r.petId !== id);
  const eraAtual = estado.petAtual === id;
  if (eraAtual) estado.petAtual = estado.pets[0]?.id || null;
  salvar();
  if (eraAtual) aoTrocarPet(); else renderTudo();
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
  // Idade: anos/meses aproximados têm prioridade se preenchidos; senão, a data exata
  let nascimento = $('#pet-nasc').value || '';
  let nascAprox = false;
  const anosTxt = $('#pet-idade-anos').value.trim(), mesesTxt = $('#pet-idade-meses').value.trim();
  if ($('#pet-idade-anos').validity.badInput || $('#pet-idade-meses').validity.badInput) {
    erro.textContent = 'Idade aproximada: use só números inteiros (ex.: 3 anos e 2 meses).'; erro.hidden = false; return;
  }
  if (anosTxt || mesesTxt) {
    const anos = anosTxt ? Number(anosTxt) : 0, meses = mesesTxt ? Number(mesesTxt) : 0;
    if (!Number.isInteger(anos) || !Number.isInteger(meses) || anos < 0 || anos > 30 || meses < 0 || meses > 11) {
      erro.textContent = 'Idade aproximada: anos de 0 a 30 e meses de 0 a 11.'; erro.hidden = false; return;
    }
    if (anos === 0 && meses === 0) {
      erro.textContent = 'Com menos de 1 mês, informe a data de nascimento.'; erro.hidden = false; return;
    }
    nascimento = nascimentoEstimado(anos, meses);
    nascAprox = true;
  } else if (nascimento) {
    if (nascimento > hojeISO()) { erro.textContent = 'A data de nascimento não pode estar no futuro.'; erro.hidden = false; return; }
    const antigo = estado.pets.find((p) => p.id === $('#pet-id').value);
    nascAprox = !!(antigo && antigo.nascAprox && antigo.nascimento === nascimento);
  }
  const id = $('#pet-id').value;
  const existente = id && estado.pets.find((p) => p.id === id);
  if (id && !existente) { limparFormPet(); erro.textContent = 'Este pet foi excluído. Cadastre de novo, se quiser.'; erro.hidden = false; return; }
  if (existente) {
    Object.assign(existente, { nome, especie, raca, nascimento, nascAprox });
  } else {
    const p = { id: novoId(), nome, especie, raca, nascimento, nascAprox };
    estado.pets.push(p);
    estado.petAtual = p.id;
  }
  salvar();
  limparFormPet();
  renderTudo();
  renderListaPets();
  if (!id) { fecharPainelPets(); aoTrocarPet(); }
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
  aoTrocarPet();
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
  renderTudo();
});

$('#lista-peso').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-remover-peso]');
  if (!b) return;
  const r = estado.pesos.find((x) => x.id === b.dataset.removerPeso);
  if (r && pedeConfirmacao(b)) {
    estado.pesos = estado.pesos.filter((x) => x.id !== r.id);
    salvar();
    renderTudo();
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

  desenharGrafico($('#grafico-peso'), regs, ultimaAvaliacao()?.pesoIdeal || null);
}

/* ---------- Gráfico de linha (SVG) ---------- */
function desenharGrafico(cont, regs, ideal = null) {
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
  let y0 = Math.min(...ys, ideal ?? Infinity), y1 = Math.max(...ys, ideal ?? -Infinity);
  const folga = Math.max((y1 - y0) * 0.15, 0.1);
  y0 -= folga; y1 += folga;

  // Marcas do eixo Y com passo "redondo"
  const passos = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
  const passo = passos.find((p) => (y1 - y0) / p <= 5) || 10;
  const ticksY = [];
  for (let v = Math.ceil(y0 / passo) * passo; v <= y1 + 1e-9; v += passo) ticksY.push(Math.round(v * 100) / 100);

  const casasY = (String(passo).split('.')[1] || '').length;
  const px = (t) => m.l + ((t - x0) / (x1 - x0)) * w;
  const py = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * h;

  // Rótulos de data espaçados igualmente no tempo (1 a cada ~90px), sem sobreposição
  const nx = Math.max(2, Math.floor(w / 90));
  const isoDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ticksX = [...new Set(Array.from({ length: nx }, (_, i) => isoDe(x0 + ((x1 - x0) * i) / (nx - 1))))];

  const pts = regs.map((r, i) => [px(xs[i]), py(r.kg)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const mostrarPontos = regs.length <= 40;

  cont.innerHTML = `
    <svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Gráfico de peso: de ${fmtKg(ys[0])} em ${fmtData(regs[0].data)} a ${fmtKg(ys[ys.length - 1])} em ${fmtData(regs[regs.length - 1].data)}">
      ${ticksY.map((v) => `
        <line class="grade" x1="${m.l}" x2="${L - m.r}" y1="${py(v)}" y2="${py(v)}"/>
        <text class="eixo" x="${m.l - 6}" y="${py(v) + 4}" text-anchor="end">${fmtNum(v, casasY)}</text>`).join('')}
      ${ticksX.map((iso, k) => `
        <text class="eixo" x="${Math.min(Math.max(px(dataLocal(iso).getTime()), m.l), L - m.r)}" y="${A - 6}" text-anchor="${k === 0 ? 'start' : k === ticksX.length - 1 ? 'end' : 'middle'}">${fmtDataCurta(iso)}</text>`).join('')}
      ${ideal ? `<line class="linha-ideal" x1="${m.l}" x2="${L - m.r}" y1="${py(ideal)}" y2="${py(ideal)}"/>
        <text class="eixo rotulo-ideal" x="${L - m.r}" y="${py(ideal) - 5}" text-anchor="end">peso ideal ${fmtNum(ideal)}</text>` : ''}
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
  tRedim = setTimeout(() => petAtual() && desenharGrafico($('#grafico-peso'), pesosDoPet(), ultimaAvaliacao()?.pesoIdeal || null), 150);
});

/* ---------- Saúde: vacinas, vermífugo, antipulgas ---------- */
const TIPOS = {
  vacina: { nome: 'Vacina', emoji: '💉', sugestoes: { cao: ['V8', 'V10', 'Antirrábica', 'Gripe canina (tosse dos canis)', 'Giárdia', 'Leishmaniose'], gato: ['V3', 'V4', 'V5', 'Antirrábica'] } },
  vermifugo: { nome: 'Vermífugo', emoji: '💊', sugestoes: { cao: [], gato: [] } },
  antipulgas: { nome: 'Antipulgas', emoji: '🛡️', sugestoes: { cao: [], gato: [] } },
};
const AVISO_DIAS = 15; // avisa quando faltarem 15 dias ou menos

const chaveDose = (r) => r.tipo + '|' + r.nome.trim().toLowerCase();

// Mais recente primeiro
function saudeDoPet(petId = estado.petAtual) {
  return estado.saude
    .filter((r) => r.petId === petId)
    .sort((a, b) => (a.data === b.data ? b.criado - a.criado : a.data < b.data ? 1 : -1));
}

// Só o registro mais recente de cada vacina/produto vale para avisos;
// os anteriores ficam como histórico.
function vigentes(regs) {
  const vistos = new Set();
  const ids = new Set();
  for (const r of regs) {
    const k = chaveDose(r);
    if (!vistos.has(k)) { vistos.add(k); ids.add(r.id); }
  }
  return ids;
}

function statusDose(proxima) {
  if (!proxima) return null;
  const dias = diasEntre(hojeISO(), proxima);
  if (dias < 0) return { nivel: 'atrasada', icone: '⛔', texto: `Atrasada há ${plural(-dias, 'dia', 'dias')}`, dias };
  if (dias === 0) return { nivel: 'perto', icone: '⚠️', texto: 'Vence hoje', dias };
  if (dias <= AVISO_DIAS) return { nivel: 'perto', icone: '⚠️', texto: `Vence em ${plural(dias, 'dia', 'dias')}`, dias };
  return { nivel: 'ok', icone: '✓', texto: 'Em dia', dias };
}

function alertasDoPet(petId) {
  const regs = saudeDoPet(petId);
  const ids = vigentes(regs);
  return regs
    .filter((r) => ids.has(r.id))
    .map((r) => ({ r, st: statusDose(r.proxima) }))
    .filter((x) => x.st && x.st.nivel !== 'ok')
    .sort((a, b) => a.st.dias - b.st.dias);
}

function tipoSelecionado() {
  return document.querySelector('input[name="saude-tipo"]:checked').value;
}

function atualizarSugestoes() {
  const p = petAtual();
  if (!p) return;
  const tipo = tipoSelecionado();
  const usados = saudeDoPet().filter((r) => r.tipo === tipo).map((r) => r.nome);
  const lista = [...new Set([...usados, ...TIPOS[tipo].sugestoes[p.especie]])];
  $('#sugestoes-saude').innerHTML = lista.map((n) => `<option value="${esc(n)}"></option>`).join('');
  $('#saude-nome').placeholder = tipo === 'vacina' ? (p.especie === 'gato' ? 'ex.: V4, Antirrábica' : 'ex.: V10, Antirrábica') : 'ex.: nome do produto';
}
document.querySelectorAll('input[name="saude-tipo"]').forEach((el) => el.addEventListener('change', atualizarSugestoes));

function limparFormSaude() {
  const tipo = tipoSelecionado();
  $('#form-saude').reset();
  document.querySelector(`input[name="saude-tipo"][value="${tipo}"]`).checked = true;
  $('#saude-id').value = '';
  $('#saude-data').value = hojeISO();
  $('#saude-data').max = hojeISO();
  $('#form-saude-titulo').textContent = 'Registrar vacina, vermífugo ou antipulgas';
  $('#btn-salvar-saude').textContent = 'Salvar';
  $('#btn-cancelar-saude').hidden = true;
  $('#saude-erro').hidden = true;
  atualizarSugestoes();
}

$('#form-saude').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const erro = $('#saude-erro');
  const tipo = tipoSelecionado();
  const nome = $('#saude-nome').value.trim();
  const data = $('#saude-data').value;
  const proxima = $('#saude-proxima').value || '';
  const obs = $('#saude-obs').value.trim();
  let msg = '';
  if (!nome) msg = 'Informe o nome da vacina ou do produto.';
  else if (!data) msg = 'Informe a data em que foi aplicado.';
  else if (data > hojeISO()) msg = 'A data aplicada não pode estar no futuro.';
  else if (proxima && proxima <= data) msg = 'A próxima dose precisa ser depois da data aplicada.';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const id = $('#saude-id').value;
  const existente = id && estado.saude.find((r) => r.id === id);
  if (existente) {
    Object.assign(existente, { tipo, nome, data, proxima, obs });
  } else {
    estado.saude.push({ id: novoId(), petId: estado.petAtual, tipo, nome, data, proxima, obs, criado: Date.now() });
  }
  salvar();
  limparFormSaude();
  renderTudo();
});
$('#btn-cancelar-saude').addEventListener('click', limparFormSaude);

function editarSaude(id) {
  const r = estado.saude.find((x) => x.id === id);
  if (!r) return;
  document.querySelector(`input[name="saude-tipo"][value="${r.tipo}"]`).checked = true;
  atualizarSugestoes();
  $('#saude-id').value = r.id;
  $('#saude-nome').value = r.nome;
  $('#saude-data').value = r.data;
  $('#saude-proxima').value = r.proxima || '';
  $('#saude-obs').value = r.obs || '';
  $('#form-saude-titulo').textContent = `Editar ${TIPOS[r.tipo].nome.toLowerCase()}: ${r.nome}`;
  $('#btn-salvar-saude').textContent = 'Salvar alterações';
  $('#btn-cancelar-saude').hidden = false;
  $('#form-saude').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Atalho: "Registrar nova dose" já preenche tipo e nome
function novaDose(id) {
  const r = estado.saude.find((x) => x.id === id);
  if (!r) return;
  limparFormSaude();
  document.querySelector(`input[name="saude-tipo"][value="${r.tipo}"]`).checked = true;
  atualizarSugestoes();
  $('#saude-nome').value = r.nome;
  $('#form-saude').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#saude-proxima').focus({ preventScroll: true });
}

document.getElementById('aba-saude').addEventListener('click', (ev) => {
  const ed = ev.target.closest('[data-editar-saude]');
  const nd = ev.target.closest('[data-nova-dose]');
  const rm = ev.target.closest('[data-remover-saude]');
  if (ed) editarSaude(ed.dataset.editarSaude);
  if (nd) novaDose(nd.dataset.novaDose);
  const ag = ev.target.closest('[data-agenda]');
  if (ag) baixarICS(estado.saude.find((x) => x.id === ag.dataset.agenda));
  if (rm && pedeConfirmacao(rm)) {
    if ($('#saude-id').value === rm.dataset.removerSaude) limparFormSaude();
    estado.saude = estado.saude.filter((x) => x.id !== rm.dataset.removerSaude);
    salvar();
    renderTudo();
  }
  const rb = ev.target.closest('[data-remover-banho]');
  if (rb && pedeConfirmacao(rb)) {
    estado.banhos = estado.banhos.filter((x) => x.id !== rb.dataset.removerBanho);
    salvar();
    renderTudo();
  }
});

/* ---------- Lembrete na agenda do celular ---------- */
// Dentro do visualizador do claude.ai (iframe) downloads de .ics são bloqueados:
// lá usamos o link do Google Agenda. Como site normal, geramos o .ics.
const EMBUTIDO = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();

function dadosLembrete(r) {
  const pet = estado.pets.find((p) => p.id === r.petId);
  const titulo = `${TIPOS[r.tipo].emoji} ${pet ? pet.nome : 'Pet'}: ${TIPOS[r.tipo].nome.toLowerCase()} ${r.nome}`;
  const detalhes = `Próxima dose de ${TIPOS[r.tipo].nome.toLowerCase()} (${r.nome}) de ${pet ? pet.nome : 'seu pet'}.\n` +
    `Última aplicação: ${fmtData(r.data)}.${r.obs ? '\nObs.: ' + r.obs : ''}\nRegistrado no Diário do Cachorro.`;
  const ini = r.proxima.replace(/-/g, '');
  const d = dataLocal(r.proxima); d.setDate(d.getDate() + 1);
  const fim = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return { titulo, detalhes, ini, fim };
}

function linkGoogleAgenda(r) {
  const { titulo, detalhes, ini, fim } = dadosLembrete(r);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: `${ini}/${fim}`, details: detalhes });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

function textoICS(r) {
  const { titulo, detalhes, ini, fim } = dadosLembrete(r);
  const escICS = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  // Linhas do iCalendar devem ter no máx. 75 bytes; dobra as maiores
  const dobrar = (linha) => {
    const partes = [];
    let atual = '';
    for (const ch of linha) {
      if (new TextEncoder().encode(atual + ch).length > 73) { partes.push(atual); atual = ' '; }
      atual += ch;
    }
    partes.push(atual);
    return partes.join('\r\n');
  };
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Diario do Cachorro//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${r.id}-${ini}@diario-do-cachorro`,
    `DTSTAMP:${agora}`,
    `DTSTART;VALUE=DATE:${ini}`,
    `DTEND;VALUE=DATE:${fim}`,
    `SUMMARY:${escICS(titulo)}`,
    `DESCRIPTION:${escICS(detalhes)}`,
    // Avisos: 3 dias antes (às 9h) e no dia (às 9h)
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escICS(titulo)}`, 'TRIGGER:-P2DT15H', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escICS(titulo)}`, 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(dobrar).join('\r\n');
}

function baixarICS(r) {
  const pet = estado.pets.find((p) => p.id === r.petId);
  const nome = `${r.tipo}-${r.nome}-${pet ? pet.nome : 'pet'}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([textoICS(r)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome + '.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function botoesAgenda(r) {
  if (!r.proxima) return '';
  const google = `<a class="btn pequeno" href="${esc(linkGoogleAgenda(r))}" target="_blank" rel="noopener">📅 Google Agenda</a>`;
  if (EMBUTIDO) return google;
  return `<button type="button" class="btn pequeno" data-agenda="${r.id}">📅 Agenda do celular</button>${google}`;
}

function seloStatus(st) {
  if (!st) return '<span class="selo neutro">Sem próxima dose</span>';
  return `<span class="selo ${st.nivel}"><span aria-hidden="true">${st.icone}</span> ${st.texto}</span>`;
}

function renderSaude() {
  const regs = saudeDoPet();
  const ids = vigentes(regs);
  for (const tipo of Object.keys(TIPOS)) {
    const ul = document.querySelector(`[data-lista-tipo="${tipo}"]`);
    const doTipo = regs.filter((r) => r.tipo === tipo);
    if (!doTipo.length) {
      ul.innerHTML = `<li class="vazio">Nenhum registro de ${TIPOS[tipo].nome.toLowerCase()}.</li>`;
      continue;
    }
    // Vigentes primeiro (ordenados pela próxima dose), histórico depois
    const atuais = doTipo.filter((r) => ids.has(r.id))
      .sort((a, b) => (a.proxima || '9999').localeCompare(b.proxima || '9999'));
    const antigos = doTipo.filter((r) => !ids.has(r.id));
    const item = (r, atual) => `
      <li class="item-saude${atual ? '' : ' antigo'}">
        <div class="info">
          <div class="principal">${esc(r.nome)}</div>
          <div class="secundario">Aplicada em ${fmtData(r.data)}${r.proxima ? ` · próxima: <strong>${fmtData(r.proxima)}</strong>` : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
          ${atual ? seloStatus(statusDose(r.proxima)) : '<span class="selo neutro">Dose anterior</span>'}
          <div class="acoes">
            ${atual ? `<button type="button" class="btn pequeno" data-nova-dose="${r.id}">+ Nova dose</button>` : ''}
            ${atual ? botoesAgenda(r) : ''}
            <button type="button" class="btn pequeno" data-editar-saude="${r.id}">Editar</button>
            <button type="button" class="btn pequeno perigo" data-remover-saude="${r.id}">Excluir</button>
          </div>
        </div>
      </li>`;
    ul.innerHTML = atuais.map((r) => item(r, true)).join('') + antigos.map((r) => item(r, false)).join('');
  }
  renderBanho();
  atualizarSugestoes();
}

/* ---------- Banho ---------- */
function banhosDoPet() {
  return estado.banhos
    .filter((r) => r.petId === estado.petAtual)
    .sort((a, b) => (a.data === b.data ? b.criado - a.criado : a.data < b.data ? 1 : -1));
}
function textoHaDias(iso) {
  const d = diasEntre(iso, hojeISO());
  return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}

$('#form-banho').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const data = $('#banho-data').value;
  const erro = $('#banho-erro');
  if (!data) { erro.textContent = 'Informe a data do banho.'; erro.hidden = false; return; }
  if (data > hojeISO()) { erro.textContent = 'A data do banho não pode estar no futuro.'; erro.hidden = false; return; }
  erro.hidden = true;
  estado.banhos.push({ id: novoId(), petId: estado.petAtual, data, criado: Date.now() });
  salvar();
  $('#banho-data').value = hojeISO();
  renderTudo();
});

function renderBanho() {
  const regs = banhosDoPet();
  $('#banho-ultimo').innerHTML = regs.length
    ? `Último banho: <strong>${fmtData(regs[0].data)}</strong> (${textoHaDias(regs[0].data)})`
    : 'Nenhum banho registrado ainda.';
  $('#lista-banho').innerHTML = regs.length
    ? regs.map((r) => `
      <li>
        <div class="info"><div class="principal">${fmtData(r.data)}</div><div class="secundario">${textoHaDias(r.data)}</div></div>
        <button type="button" class="btn pequeno perigo" data-remover-banho="${r.id}">Excluir</button>
      </li>`).join('')
    : '<li class="vazio">Sem registros.</li>';
}

/* ---------- Ração e alimentador ---------- */
function racaoDoPet(petId = estado.petAtual) {
  return estado.racoes.find((r) => r.petId === petId) || null;
}
const fmtG = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' g';
function totalDia(refeicoes) {
  return Math.round(refeicoes.reduce((s, x) => s + x.g, 0) * 10) / 10;
}
function agoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function proximaRefeicao(refeicoes) {
  if (!refeicoes.length) return null;
  const agora = agoraHHMM();
  return refeicoes.find((x) => x.hora > agora) || { ...refeicoes[0], amanha: true };
}

function linhaRefeicao(hora = '', g = '') {
  const li = document.createElement('li');
  li.innerHTML = `
    <label>Horário<input type="time" class="ref-hora" value="${esc(hora)}"></label>
    <label>Gramas<input type="text" class="ref-g" inputmode="decimal" placeholder="ex.: 30" value="${g === '' ? '' : esc(String(g).replace('.', ','))}"></label>
    <button type="button" class="btn icone perigo" data-remover-refeicao aria-label="Remover horário">✕</button>`;
  return li;
}

// Lê as linhas do formulário; devolve { refeicoes, erro }
function lerRefeicoes() {
  const refeicoes = [];
  for (const li of document.querySelectorAll('#racao-refeicoes li')) {
    const hora = li.querySelector('.ref-hora').value;
    const gTxt = li.querySelector('.ref-g').value.trim();
    if (!hora && !gTxt) continue; // linha vazia: ignora
    if (!hora) return { erro: 'Preencha o horário de todas as refeições.' };
    const g = lerNumero(gTxt);
    if (!(g > 0 && g <= 2000)) return { erro: `Informe as gramas da refeição das ${hora}.` };
    refeicoes.push({ hora, g: Math.round(g * 10) / 10 });
  }
  refeicoes.sort((a, b) => (a.hora < b.hora ? -1 : 1));
  for (let i = 1; i < refeicoes.length; i++) {
    if (refeicoes[i].hora === refeicoes[i - 1].hora) return { erro: `O horário ${refeicoes[i].hora} está repetido.` };
  }
  return { refeicoes };
}

function atualizarTotalVivo() {
  const { refeicoes, erro } = lerRefeicoes();
  const el = $('#racao-total');
  if (erro || !refeicoes.length) { el.textContent = 'Total por dia: —'; return; }
  el.innerHTML = `Total por dia: <strong>${fmtG(totalDia(refeicoes))}</strong> em ${plural(refeicoes.length, 'refeição', 'refeições')}`;
}

function preencherFormRacao() {
  const r = racaoDoPet();
  $('#racao-erro').hidden = true;
  $('#racao-marca').value = r ? r.marca : '';
  const ul = $('#racao-refeicoes');
  ul.innerHTML = '';
  const linhas = r && r.refeicoes.length ? r.refeicoes : [{ hora: '08:00', g: '' }, { hora: '18:00', g: '' }];
  for (const x of linhas) ul.appendChild(linhaRefeicao(x.hora, x.g));
  atualizarTotalVivo();
}

$('#racao-refeicoes').addEventListener('input', atualizarTotalVivo);
$('#racao-refeicoes').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-remover-refeicao]');
  if (!b) return;
  b.closest('li').remove();
  atualizarTotalVivo();
});
$('#btn-add-refeicao').addEventListener('click', () => {
  const li = linhaRefeicao();
  $('#racao-refeicoes').appendChild(li);
  li.querySelector('.ref-hora').focus();
});
// Copia as gramas da primeira linha preenchida para todas
$('#btn-igualar').addEventListener('click', () => {
  const campos = [...document.querySelectorAll('#racao-refeicoes .ref-g')];
  const base = campos.find((c) => c.value.trim());
  if (!base) { $('#racao-erro').textContent = 'Preencha as gramas de um horário primeiro.'; $('#racao-erro').hidden = false; return; }
  campos.forEach((c) => (c.value = base.value));
  $('#racao-erro').hidden = true;
  atualizarTotalVivo();
});

$('#form-racao').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const erroEl = $('#racao-erro');
  const { refeicoes, erro } = lerRefeicoes();
  const marca = $('#racao-marca').value.trim();
  let msg = erro || '';
  if (!msg && !refeicoes.length) msg = 'Adicione pelo menos um horário com as gramas.';
  if (msg) { erroEl.textContent = msg; erroEl.hidden = false; return; }
  erroEl.hidden = true;
  const atual = racaoDoPet();
  const nova = { petId: estado.petAtual, marca, refeicoes, atualizado: hojeISO() };
  if (atual) Object.assign(atual, nova);
  else estado.racoes.push(nova);
  salvar();
  preencherFormRacao();
  renderTudo();
  $('#racao-resumo').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function renderRacao() {
  const r = racaoDoPet();
  const el = $('#racao-resumo');
  if (!r || !r.refeicoes.length) {
    el.innerHTML = '<p class="vazio-texto">Nenhuma alimentação configurada. Preencha a marca e os horários do alimentador abaixo.</p>';
    return;
  }
  const total = totalDia(r.refeicoes);
  const prox = proximaRefeicao(r.refeicoes);
  const pesos = pesosDoPet();
  const porKg = pesos.length ? total / pesos[pesos.length - 1].kg : null;
  el.innerHTML = `
    <div class="total-dia">
      <span class="numero">${fmtG(total)}</span>
      <span class="rot">por dia · ${plural(r.refeicoes.length, 'refeição', 'refeições')}</span>
    </div>
    ${r.marca ? `<p class="marca">🥣 ${esc(r.marca)}</p>` : ''}
    <ul class="horarios">
      ${r.refeicoes.map((x) => `
        <li class="${prox && x.hora === prox.hora ? 'proxima' : ''}">
          <span class="hora">${x.hora}</span>
          <span class="g">${fmtG(x.g)}</span>
          ${prox && x.hora === prox.hora ? `<span class="selo ok">Próxima${prox.amanha ? ' (amanhã)' : ''}</span>` : ''}
        </li>`).join('')}
    </ul>
    <p class="nota">${petAtual().nutri?.kcalKg ? `≈ ${Math.round((total * petAtual().nutri.kcalKg) / 1000).toLocaleString('pt-BR')} kcal/dia · ` : ''}${porKg ? `≈ ${porKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g por kg de peso · ` : ''}Atualizado em ${fmtData(r.atualizado)}</p>`;
}

/* ---------- Saúde: sub-abas ---------- */
let subabaSaude = 'prevencao';
try { subabaSaude = localStorage.getItem('diario-pet-subaba') === 'clinico' ? 'clinico' : 'prevencao'; } catch (e) { /* ignora */ }
function mostrarSubaba(nome) {
  subabaSaude = nome;
  try { localStorage.setItem('diario-pet-subaba', nome); } catch (e) { /* ignora */ }
  document.querySelectorAll('.subaba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.subaba === nome)));
  $('#saude-prevencao').hidden = nome !== 'prevencao';
  $('#saude-clinico').hidden = nome !== 'clinico';
}
document.querySelector('.subabas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-subaba]');
  if (b) mostrarSubaba(b.dataset.subaba);
});

/* ---------- Doenças e condições ---------- */
const SITUACOES = {
  tratamento: { nome: 'Em tratamento', classe: 'perto' },
  controlada: { nome: 'Controlada', classe: 'ok' },
  observacao: { nome: 'Em observação', classe: 'neutro' },
  curada: { nome: 'Curada / resolvida', classe: 'neutro' },
};
const SUGESTOES_DOENCA = {
  cao: ['Dermatite atópica', 'Alergia alimentar', 'Otite', 'Doença periodontal', 'Luxação de patela', 'Artrose', 'Obesidade',
    'Doença valvar mitral (cardiopatia)', 'Doença renal crônica', 'Epilepsia', 'Hipotireoidismo', 'Erliquiose (doença do carrapato)', 'Giardíase'],
  gato: ['Doença renal crônica', 'Doença do trato urinário inferior (DTUIF)', 'Doença periodontal', 'Hipertireoidismo', 'Diabetes mellitus',
    'Obesidade', 'Rinotraqueíte', 'FIV', 'FeLV', 'Dermatite alérgica'],
};

function doencasDoPet() {
  return estado.doencas
    .filter((r) => r.petId === estado.petAtual)
    .sort((a, b) => (b.diagnostico || '').localeCompare(a.diagnostico || '') || b.criado - a.criado);
}

function limparFormDoenca() {
  $('#form-doenca').reset();
  $('#doenca-id').value = '';
  $('#doenca-data').max = hojeISO();
  $('#form-doenca-titulo').textContent = 'Adicionar doença ou condição';
  $('#btn-salvar-doenca').textContent = 'Adicionar';
  $('#btn-cancelar-doenca').hidden = true;
  $('#doenca-erro').hidden = true;
}

$('#form-doenca').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const erro = $('#doenca-erro');
  const nome = $('#doenca-nome').value.trim();
  const diagnostico = $('#doenca-data').value || '';
  const situacao = $('#doenca-situacao').value;
  const obs = $('#doenca-obs').value.trim();
  let msg = '';
  if (!nome) msg = 'Informe o nome da doença ou condição.';
  else if (diagnostico && diagnostico > hojeISO()) msg = 'A data do diagnóstico não pode estar no futuro.';
  else if (!SITUACOES[situacao]) msg = 'Escolha a situação.';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const id = $('#doenca-id').value;
  const existente = id && estado.doencas.find((r) => r.id === id);
  if (existente) Object.assign(existente, { nome, diagnostico, situacao, obs });
  else estado.doencas.push({ id: novoId(), petId: estado.petAtual, nome, diagnostico, situacao, obs, criado: Date.now() });
  salvar();
  limparFormDoenca();
  renderTudo();
});
$('#btn-cancelar-doenca').addEventListener('click', limparFormDoenca);

function editarDoenca(id) {
  const r = estado.doencas.find((x) => x.id === id);
  if (!r) return;
  $('#doenca-id').value = r.id;
  $('#doenca-nome').value = r.nome;
  $('#doenca-data').value = r.diagnostico || '';
  $('#doenca-situacao').value = r.situacao;
  $('#doenca-obs').value = r.obs || '';
  $('#form-doenca-titulo').textContent = `Editar: ${r.nome}`;
  $('#btn-salvar-doenca').textContent = 'Salvar alterações';
  $('#btn-cancelar-doenca').hidden = false;
  $('#form-doenca').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Remédios ---------- */
function remediosDoPet() {
  return estado.remedios
    .filter((r) => r.petId === estado.petAtual)
    .sort((a, b) => b.inicio.localeCompare(a.inicio) || b.criado - a.criado);
}
const remedioAtivo = (r) => !r.fim || r.fim >= hojeISO();

function statusRemedio(r) {
  const hoje = hojeISO();
  if (r.inicio > hoje) return { classe: 'neutro', texto: `Começa em ${fmtData(r.inicio)}` };
  if (!r.fim) return { classe: 'ok', texto: 'Uso contínuo' };
  const dias = diasEntre(hoje, r.fim);
  if (dias < 0) return { classe: 'neutro', texto: `Encerrado em ${fmtData(r.fim)}` };
  if (dias === 0) return { classe: 'perto', texto: 'Último dia hoje' };
  if (dias <= 3) return { classe: 'perto', texto: `Termina em ${plural(dias, 'dia', 'dias')}` };
  return { classe: 'ok', texto: `Até ${fmtData(r.fim)}` };
}

function limparFormRemedio() {
  $('#form-remedio').reset();
  $('#remedio-id').value = '';
  $('#remedio-inicio').value = hojeISO();
  $('#form-remedio-titulo').textContent = 'Adicionar remédio';
  $('#btn-salvar-remedio').textContent = 'Adicionar remédio';
  $('#btn-cancelar-remedio').hidden = true;
  $('#remedio-erro').hidden = true;
  atualizarSelectDoencas();
}

function atualizarSelectDoencas(valor) {
  const sel = $('#remedio-doenca');
  const atual = valor ?? sel.value;
  const ds = doencasDoPet();
  sel.innerHTML = '<option value="">— Nenhuma —</option>' +
    ds.map((d) => `<option value="${d.id}">${esc(d.nome)}${d.situacao === 'curada' ? ' (curada)' : ''}</option>`).join('');
  sel.value = ds.some((d) => d.id === atual) ? atual : '';
}

$('#form-remedio').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const erro = $('#remedio-erro');
  const nome = $('#remedio-nome').value.trim();
  const dose = $('#remedio-dose').value.trim();
  const frequencia = $('#remedio-freq').value.trim();
  const horarios = $('#remedio-horarios').value.trim();
  const inicio = $('#remedio-inicio').value;
  const fim = $('#remedio-fim').value || '';
  const doencaId = $('#remedio-doenca').value || '';
  const obs = $('#remedio-obs').value.trim();
  let msg = '';
  if (!nome) msg = 'Informe o nome do remédio.';
  else if (!inicio) msg = 'Informe a data de início.';
  else if (fim && fim < inicio) msg = 'O término não pode ser antes do início.';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const id = $('#remedio-id').value;
  const existente = id && estado.remedios.find((r) => r.id === id);
  const dados = { nome, dose, frequencia, horarios, inicio, fim, doencaId, obs };
  if (existente) Object.assign(existente, dados);
  else estado.remedios.push({ id: novoId(), petId: estado.petAtual, ...dados, criado: Date.now() });
  salvar();
  limparFormRemedio();
  renderTudo();
});
$('#btn-cancelar-remedio').addEventListener('click', limparFormRemedio);

function editarRemedio(id) {
  const r = estado.remedios.find((x) => x.id === id);
  if (!r) return;
  $('#remedio-id').value = r.id;
  $('#remedio-nome').value = r.nome;
  $('#remedio-dose').value = r.dose || '';
  $('#remedio-freq').value = r.frequencia || '';
  $('#remedio-horarios').value = r.horarios || '';
  $('#remedio-inicio').value = r.inicio;
  $('#remedio-fim').value = r.fim || '';
  atualizarSelectDoencas(r.doencaId || '');
  $('#remedio-obs').value = r.obs || '';
  $('#form-remedio-titulo').textContent = `Editar: ${r.nome}`;
  $('#btn-salvar-remedio').textContent = 'Salvar alterações';
  $('#btn-cancelar-remedio').hidden = false;
  $('#form-remedio').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Encerrar hoje (ex.: tratamento concluído antes do previsto)
function encerrarRemedio(id) {
  const r = estado.remedios.find((x) => x.id === id);
  if (!r) return;
  const hoje = hojeISO();
  // Encerra ontem para sair da lista "em uso" já hoje; se começou hoje, apaga o término no mesmo dia
  const ontem = (() => { const d = dataLocal(hoje); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  r.fim = r.inicio > ontem ? r.inicio : ontem; // começou hoje ou depois: termina no próprio início
  salvar();
  renderTudo();
}

$('#saude-clinico').addEventListener('click', (ev) => {
  const t = (sel) => ev.target.closest(sel);
  let b;
  if ((b = t('[data-editar-doenca]'))) editarDoenca(b.dataset.editarDoenca);
  if ((b = t('[data-editar-remedio]'))) editarRemedio(b.dataset.editarRemedio);
  if ((b = t('[data-encerrar-remedio]')) && pedeConfirmacao(b, 'Encerrar?')) encerrarRemedio(b.dataset.encerrarRemedio);
  if ((b = t('[data-remover-doenca]')) && pedeConfirmacao(b)) {
    const id = b.dataset.removerDoenca;
    if ($('#doenca-id').value === id) limparFormDoenca();
    estado.doencas = estado.doencas.filter((x) => x.id !== id);
    for (const r of estado.remedios) if (r.doencaId === id) r.doencaId = '';
    salvar();
    renderTudo();
  }
  if ((b = t('[data-remover-remedio]')) && pedeConfirmacao(b)) {
    const id = b.dataset.removerRemedio;
    if ($('#remedio-id').value === id) limparFormRemedio();
    estado.remedios = estado.remedios.filter((x) => x.id !== id);
    salvar();
    renderTudo();
  }
});

function renderClinico() {
  const p = petAtual();
  const ds = doencasDoPet();
  const rs = remediosDoPet();
  const nomeDoenca = (id) => ds.find((d) => d.id === id)?.nome;

  // Remédios
  const itemRemedio = (r, ativo) => {
    const st = statusRemedio(r);
    const linha2 = [r.dose, r.frequencia, r.horarios].filter(Boolean).map(esc).join(' · ');
    const para = nomeDoenca(r.doencaId);
    return `
      <li class="item-saude${ativo ? '' : ' antigo'}">
        <div class="info">
          <div class="principal">${esc(r.nome)}</div>
          ${linha2 ? `<div class="secundario">${linha2}</div>` : ''}
          <div class="secundario">Desde ${fmtData(r.inicio)}${para ? ` · para ${esc(para)}` : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
          <span class="selo ${st.classe}">${st.texto}</span>
          <div class="acoes">
            <button type="button" class="btn pequeno" data-editar-remedio="${r.id}">Editar</button>
            ${ativo ? `<button type="button" class="btn pequeno" data-encerrar-remedio="${r.id}">Encerrar</button>` : ''}
            <button type="button" class="btn pequeno perigo" data-remover-remedio="${r.id}">Excluir</button>
          </div>
        </div>
      </li>`;
  };
  const ativos = rs.filter(remedioAtivo);
  const antigos = rs.filter((r) => !remedioAtivo(r));
  $('#lista-remedios').innerHTML = ativos.length
    ? ativos.map((r) => itemRemedio(r, true)).join('')
    : '<li class="vazio">Nenhum remédio em uso.</li>';
  $('#det-remedios-antigos').hidden = !antigos.length;
  $('#lista-remedios-antigos').innerHTML = antigos.map((r) => itemRemedio(r, false)).join('');
  const cm = $('#contador-remedios');
  cm.hidden = !ativos.length;
  cm.textContent = ativos.length;

  // Doenças
  const itemDoenca = (d) => {
    const sit = SITUACOES[d.situacao] || SITUACOES.observacao;
    const meds = rs.filter((r) => r.doencaId === d.id && remedioAtivo(r)).map((r) => esc(r.nome));
    return `
      <li class="item-saude${d.situacao === 'curada' ? ' antigo' : ''}">
        <div class="info">
          <div class="principal">${esc(d.nome)}</div>
          <div class="secundario">${d.diagnostico ? 'Diagnóstico em ' + fmtData(d.diagnostico) : 'Sem data de diagnóstico'}${meds.length ? ' · remédios: ' + meds.join(', ') : ''}${d.obs ? ' · ' + esc(d.obs) : ''}</div>
          <span class="selo ${sit.classe}">${sit.nome}</span>
          <div class="acoes">
            <button type="button" class="btn pequeno" data-editar-doenca="${d.id}">Editar</button>
            <button type="button" class="btn pequeno perigo" data-remover-doenca="${d.id}">Excluir</button>
          </div>
        </div>
      </li>`;
  };
  const abertas = ds.filter((d) => d.situacao !== 'curada');
  const curadas = ds.filter((d) => d.situacao === 'curada');
  $('#lista-doencas').innerHTML = abertas.length ? abertas.map(itemDoenca).join('') : '<li class="vazio">Nenhuma doença registrada.</li>';
  $('#det-doencas-curadas').hidden = !curadas.length;
  $('#lista-doencas-curadas').innerHTML = curadas.map(itemDoenca).join('');

  // Sugestões e lista de doenças do formulário de remédio
  const usadas = ds.map((d) => d.nome);
  $('#sugestoes-doenca').innerHTML = [...new Set([...usadas, ...SUGESTOES_DOENCA[p.especie]])]
    .map((n) => `<option value="${esc(n)}"></option>`).join('');
  atualizarSelectDoencas();
}

/* ---------- Calculadora ECC (escore de condição corporal 1–9) ---------- */
// Referências: diretrizes nutricionais WSAVA; RER = 70 × peso^0,75;
// cada ponto de ECC acima de 5 ≈ 10% de excesso de peso.
const ECC_DESC = {
  1: ['Muito magro', 'Costelas, coluna e ossos do quadril visíveis à distância. Sem gordura. Perda de músculo evidente.'],
  2: ['Muito magro', 'Costelas, coluna e quadril facilmente visíveis. Sem gordura palpável. Alguma perda de músculo.'],
  3: ['Magro', 'Costelas fáceis de sentir e podem estar visíveis. Topo da coluna visível. Cintura e barriga recolhida bem marcadas.'],
  4: ['Abaixo do ideal', 'Costelas fáceis de sentir, com pouca gordura. Cintura bem visível de cima. Barriga recolhida.'],
  5: ['Ideal', 'Costelas sentidas sem excesso de gordura. Cintura visível de cima, atrás das costelas. Barriga recolhida vista de lado.'],
  6: ['Acima do ideal', 'Costelas sentidas com leve excesso de gordura. Cintura visível de cima, mas pouco marcada.'],
  7: ['Sobrepeso', 'Costelas difíceis de sentir sob a gordura. Gordura na lombar e na base da cauda. Cintura quase ausente.'],
  8: ['Obeso', 'Costelas só sentidas com pressão forte. Muita gordura na lombar e na cauda. Sem cintura; barriga pode ficar saliente.'],
  9: ['Obesidade grave', 'Grandes depósitos de gordura no peito, coluna, cauda, pescoço e patas. Sem cintura; barriga distendida.'],
};

const FASES = {
  cao: [['adulto', 'Adulto'], ['filhote4', 'Filhote até 4 meses'], ['filhote12', 'Filhote 4–12 meses']],
  gato: [['adulto', 'Adulto'], ['filhote12', 'Filhote até 12 meses']],
};

function idadeEmMeses(nasc) {
  if (!nasc) return null;
  const [a1, m1, d1] = nasc.split('-').map(Number);
  const [a2, m2, d2] = hojeISO().split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}
function faseSugerida(p) {
  const m = idadeEmMeses(p.nascimento);
  if (m === null || m >= 12) return 'adulto';
  if (p.especie === 'cao' && m < 4) return 'filhote4';
  return 'filhote12';
}

const RER = (kg) => 70 * Math.pow(kg, 0.75);

function fatorManutencao(especie, fase, castrado, atividade) {
  if (especie === 'cao') {
    if (fase === 'filhote4') return 3.0;
    if (fase === 'filhote12') return 2.0;
    if (atividade === 'baixa') return 1.4;
    if (atividade === 'alta') return 2.0;
    return castrado ? 1.6 : 1.8;
  }
  if (fase === 'filhote12') return 2.5;
  if (atividade === 'baixa') return 1.0;
  if (atividade === 'alta') return 1.6;
  return castrado ? 1.2 : 1.4;
}

// Cálculo puro (sem DOM) — testável isoladamente
function calcularNutricao({ especie, peso, ecc, fase, castrado, atividade, kcalKg }) {
  const filhote = fase !== 'adulto';
  const fator = fatorManutencao(especie, fase, castrado, atividade);
  const r = { filhote, fator };
  if (filhote) {
    r.objetivo = 'crescer';
    r.kcalMeta = r.kcalManter = RER(peso) * fator;
  } else {
    r.pesoIdeal = peso / (1 + (ecc - 5) * 0.1);
    r.difPct = (ecc - 5) * 10; // + excesso, − falta
    r.kcalManter = RER(r.pesoIdeal) * fator;
    if (ecc >= 6) {
      r.objetivo = 'perder';
      r.kcalMeta = RER(r.pesoIdeal) * (especie === 'gato' ? 0.8 : 1.0);
      // perda segura de ~1% do peso por semana
      r.semanas = Math.ceil(Math.log(r.pesoIdeal / peso) / Math.log(0.99));
      r.kgSemana = peso * 0.01;
    } else if (ecc <= 4) {
      r.objetivo = 'ganhar';
      r.kcalMeta = r.kcalManter;
    } else {
      r.objetivo = 'manter';
      r.kcalMeta = r.kcalManter;
    }
  }
  if (kcalKg) {
    r.gMeta = (r.kcalMeta / kcalKg) * 1000;
    r.gManter = (r.kcalManter / kcalKg) * 1000;
  }
  return r;
}

// Aceita "3800", "3.800", "3,800", "3800 kcal/kg"
function lerKcal(txt) {
  let t = String(txt).trim().toLowerCase().replace(/kcal.*$/, '').replace(/\s/g, '');
  if (/^\d{1,2}[.,]\d{3}$/.test(t)) t = t.replace(/[.,]/, '');
  return lerNumero(t);
}

let eccEscolhido = 5;

function ultimaAvaliacao(petId = estado.petAtual) {
  return estado.ecc
    .filter((r) => r.petId === petId)
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado - a.criado)[0] || null;
}

function renderEscala() {
  $('#ecc-escala').innerHTML = Object.keys(ECC_DESC).map((n) => `
    <button type="button" class="nota-ecc nivel-${n < 4 ? 'baixo' : n <= 5 ? 'ideal' : n <= 6 ? 'acima' : 'alto'}" role="radio"
      aria-checked="${Number(n) === eccEscolhido}" data-ecc="${n}" aria-label="ECC ${n}: ${ECC_DESC[n][0]}">${n}</button>`).join('');
  const [nome, desc] = ECC_DESC[eccEscolhido];
  $('#ecc-descricao').innerHTML = `<strong>${eccEscolhido} — ${nome}.</strong> ${desc}`;
}

function preencherFormEcc() {
  const p = petAtual();
  if (!p) return;
  const nutri = p.nutri || {};
  const pesos = pesosDoPet();
  $('#ecc-peso').value = pesos.length ? String(pesos[pesos.length - 1].kg).replace('.', ',') : '';
  eccEscolhido = ultimaAvaliacao()?.escore || 5;
  $('#ecc-fase').innerHTML = FASES[p.especie].map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  $('#ecc-fase').value = faseSugerida(p);
  $('#ecc-castrado').value = nutri.castrado === false ? 'nao' : 'sim';
  $('#ecc-atividade').value = nutri.atividade || 'normal';
  $('#ecc-kcal').value = nutri.kcalKg ? String(nutri.kcalKg) : '';
  renderEscala();
  renderEcc();
}

// Lê o formulário; devolve { entrada } ou { erro }
function lerFormEcc() {
  const p = petAtual();
  const peso = lerNumero($('#ecc-peso').value);
  const kcalTxt = $('#ecc-kcal').value.trim();
  const kcalKg = kcalTxt ? lerKcal(kcalTxt) : null;
  if (!(peso >= 0.3 && peso <= 120)) return { erro: 'Informe o peso atual em kg (ex.: 6,2).' };
  if (kcalTxt && !(kcalKg >= 500 && kcalKg <= 6000)) {
    return { erro: kcalKg >= 50 && kcalKg < 600
      ? `${kcalTxt} parece estar em kcal por 100 g. Multiplique por 10 (ex.: ${Math.round(kcalKg * 10)}).`
      : 'Energia da ração: informe em kcal/kg (ração seca costuma ter entre 3.000 e 4.500).' };
  }
  return { entrada: {
    especie: p.especie, peso, ecc: eccEscolhido, fase: $('#ecc-fase').value,
    castrado: $('#ecc-castrado').value === 'sim', atividade: $('#ecc-atividade').value, kcalKg,
  } };
}

// Guarda castração, atividade e energia da ração no cadastro do pet
function salvarPreferenciasNutri() {
  const p = petAtual();
  if (!p) return;
  const kcalTxt = $('#ecc-kcal').value.trim();
  const kcal = kcalTxt ? lerKcal(kcalTxt) : null;
  p.nutri = {
    castrado: $('#ecc-castrado').value === 'sim',
    atividade: $('#ecc-atividade').value,
    kcalKg: kcal >= 500 && kcal <= 6000 ? Math.round(kcal) : (p.nutri?.kcalKg || null),
  };
  salvar();
}

$('#form-ecc').addEventListener('submit', (ev) => ev.preventDefault());
$('#form-ecc').addEventListener('input', renderEcc);
$('#form-ecc').addEventListener('change', (ev) => {
  if (['ecc-castrado', 'ecc-atividade', 'ecc-kcal'].includes(ev.target.id)) salvarPreferenciasNutri();
  renderEcc();
});
$('#ecc-escala').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-ecc]');
  if (!b) return;
  eccEscolhido = Number(b.dataset.ecc);
  renderEscala();
  renderEcc();
});

const fmtKcal = (n) => Math.round(n).toLocaleString('pt-BR') + ' kcal';
const fmtGInt = (n) => Math.round(n).toLocaleString('pt-BR') + ' g';

function renderEcc() {
  const out = $('#ecc-resultado');
  const { entrada, erro } = lerFormEcc();
  if (erro) { out.innerHTML = `<p class="erro">${esc(erro)}</p>`; return; }
  const r = calcularNutricao(entrada);
  const racao = racaoDoPet();
  const nRef = racao?.refeicoes.length || 2;
  const temKcal = !!entrada.kcalKg;

  const objetivoTxt = { perder: 'para emagrecer', ganhar: 'para ganhar peso', manter: 'para manter', crescer: 'crescimento' }[r.objetivo];
  const ideal = r.filhote
    ? ['Peso ideal', '—', 'filhote em crescimento']
    : ['Peso ideal', fmtKg(r.pesoIdeal), r.difPct > 0 ? `${r.difPct}% acima do ideal` : r.difPct < 0 ? `${-r.difPct}% abaixo do ideal` : 'está no peso ideal'];
  const tiles = [
    ideal,
    ['Meta calórica', fmtKcal(r.kcalMeta) + '/dia', objetivoTxt],
    ['Ração por dia', temKcal ? fmtGInt(r.gMeta) : '—', temKcal ? `≈ ${fmtGInt(r.gMeta / nRef)} × ${nRef} refeições` : 'informe a energia da ração'],
  ];

  let plano = '';
  const g = (v) => (temKcal ? ` ≈ <strong>${fmtGInt(v)}/dia</strong>` : '');
  if (r.objetivo === 'perder') {
    plano = `
      <li><strong>1. Emagrecer até ${fmtKg(r.pesoIdeal)}:</strong> ${fmtKcal(r.kcalMeta)}/dia${g(r.gMeta)}.
        Perda segura de cerca de 1% do peso por semana (≈ ${fmtNum(r.kgSemana * 1000, 0)} g/semana): por volta de <strong>${plural(r.semanas, 'semana', 'semanas')}</strong>.</li>
      <li><strong>2. Depois, para manter ${fmtKg(r.pesoIdeal)}:</strong> ${fmtKcal(r.kcalManter)}/dia${g(r.gManter)}.</li>`;
  } else if (r.objetivo === 'ganhar') {
    plano = `
      <li><strong>Ganhar até ${fmtKg(r.pesoIdeal)}:</strong> ${fmtKcal(r.kcalMeta)}/dia${g(r.gMeta)}. Aumente aos poucos e pese a cada 2 semanas.</li>
      <li><strong>Para manter ${fmtKg(r.pesoIdeal)}:</strong> a mesma quantidade${g(r.gManter)}.</li>
      <li>Magreza pode ter causa médica (vermes, dentes, doenças). Vale uma consulta.</li>`;
  } else if (r.objetivo === 'manter') {
    plano = `<li><strong>Manter ${fmtKg(r.pesoIdeal)}:</strong> ${fmtKcal(r.kcalManter)}/dia${g(r.gManter)}. Reavalie o ECC a cada 1–2 meses.</li>`;
  } else {
    plano = `<li><strong>Crescimento:</strong> ${fmtKcal(r.kcalMeta)}/dia${g(r.gMeta)} com o peso de hoje. Recalcule a cada pesagem: a necessidade muda rápido.</li>
      <li>Use ração própria para filhotes. Para ECC fora de 4–5, converse com o veterinário antes de mudar a quantidade.</li>`;
  }

  let comparacao = '';
  if (temKcal && racao && racao.refeicoes.length) {
    const atual = totalDia(racao.refeicoes);
    const dif = ((atual - r.gMeta) / r.gMeta) * 100;
    const txt = Math.abs(dif) <= 5 ? 'dentro da meta'
      : `${fmtNum(Math.abs(dif), 0)}% ${dif > 0 ? 'acima' : 'abaixo'} da meta (${dif > 0 ? '+' : '−'}${fmtGInt(Math.abs(atual - r.gMeta))})`;
    comparacao = `<p class="comparacao ${Math.abs(dif) <= 5 ? 'ok' : 'perto'}">Hoje o alimentador libera <strong>${fmtG(atual)}/dia</strong>: ${txt}.</p>`;
  }

  out.innerHTML = `
    <dl class="fatos fatos-3">${tiles.map(([rot, val, sub]) => `<div><dt>${rot}</dt><dd>${val}<small>${sub}</small></dd></div>`).join('')}</dl>
    <ul class="plano">${plano}</ul>
    ${comparacao}
    <div class="linha-botoes acoes-ecc">
      ${temKcal ? `<button type="button" class="btn" id="btn-aplicar-alimentador">Programar ${fmtGInt(r.gMeta)}/dia no alimentador</button>` : ''}
      <button type="button" class="btn primario" id="btn-salvar-ecc">Salvar avaliação</button>
    </div>
    <p class="nota">Estimativa pelas diretrizes da WSAVA (energia de repouso = 70 × peso<sup>0,75</sup>; fator ${fmtNum(r.fator, 1)}${r.objetivo === 'perder' ? `; emagrecimento: ${entrada.especie === 'gato' ? '0,8' : '1,0'} × repouso no peso ideal` : ''}). Petiscos entram na conta: no máximo 10% das calorias. Confirme o plano com o veterinário${entrada.especie === 'gato' ? '. Gatos nunca devem ficar em jejum nem ter corte brusco de comida (risco de lipidose hepática)' : ''}.</p>`;
}

$('#ecc-resultado').addEventListener('click', (ev) => {
  const { entrada } = lerFormEcc();
  if (!entrada) return;
  const r = calcularNutricao(entrada);
  if (ev.target.closest('#btn-salvar-ecc')) {
    salvarPreferenciasNutri();
    estado.ecc.push({
      id: novoId(), petId: estado.petAtual, data: hojeISO(), escore: entrada.ecc, peso: Math.round(entrada.peso * 100) / 100,
      pesoIdeal: r.filhote ? null : Math.round(r.pesoIdeal * 100) / 100,
      kcalMeta: Math.round(r.kcalMeta), gMeta: r.gMeta ? Math.round(r.gMeta) : null, criado: Date.now(),
    });
    salvar();
    renderTudo();
    const b = $('#btn-salvar-ecc');
    if (b) { b.textContent = 'Avaliação salva ✓'; b.disabled = true; }
  }
  const ap = ev.target.closest('#btn-aplicar-alimentador');
  if (ap && r.gMeta && pedeConfirmacao(ap, `Trocar as gramas do alimentador por ${fmtGInt(r.gMeta)}/dia?`)) {
    salvarPreferenciasNutri();
    const atual = racaoDoPet();
    const horas = atual && atual.refeicoes.length ? atual.refeicoes.map((x) => x.hora) : ['08:00', '18:00'];
    const porRef = Math.round(r.gMeta / horas.length);
    const refeicoes = horas.map((hora) => ({ hora, g: porRef }));
    if (atual) Object.assign(atual, { refeicoes, atualizado: hojeISO() });
    else estado.racoes.push({ petId: estado.petAtual, marca: '', refeicoes, atualizado: hojeISO() });
    salvar();
    preencherFormRacao();
    renderTudo();
  }
});

$('#lista-ecc').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-remover-ecc]');
  if (b && pedeConfirmacao(b)) {
    estado.ecc = estado.ecc.filter((x) => x.id !== b.dataset.removerEcc);
    salvar();
    renderTudo();
  }
});

function renderListaEcc() {
  const regs = estado.ecc.filter((r) => r.petId === estado.petAtual)
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado - a.criado);
  $('#lista-ecc').innerHTML = regs.length ? regs.map((r) => `
    <li>
      <div class="info">
        <div class="principal">ECC ${r.escore} — ${ECC_DESC[r.escore][0]}</div>
        <div class="secundario">${fmtData(r.data)} · ${fmtKg(r.peso)}${r.pesoIdeal ? ' · ideal ' + fmtKg(r.pesoIdeal) : ''} · ${r.kcalMeta.toLocaleString('pt-BR')} kcal/dia${r.gMeta ? ' · ' + r.gMeta + ' g/dia' : ''}</div>
      </div>
      <button type="button" class="btn pequeno perigo" data-remover-ecc="${r.id}">Excluir</button>
    </li>`).join('') : '<li class="vazio">Nenhuma avaliação salva. Escolha o escore e toque em "Salvar avaliação".</li>';
}

/* ---------- Resumo do pet (topo) ---------- */
function renderResumo() {
  const p = petAtual();
  $('#resumo-emoji').textContent = ESPECIES[p.especie].emoji;
  $('#resumo-nome').textContent = p.nome;
  $('#resumo-det').textContent = [ESPECIES[p.especie].nome, p.raca].filter(Boolean).join(' · ');

  const pesos = pesosDoPet();
  const banho = banhosDoPet()[0];
  const idade = idadeDoPet(p);
  const fatos = [
    ['Idade', idade || '<button type="button" class="link" data-informar-idade>Informar</button>',
      p.nascimento ? (p.nascAprox ? 'estimada' : 'nasc. ' + fmtData(p.nascimento)) : ''],
    ['Peso', pesos.length ? fmtKg(pesos[pesos.length - 1].kg) : '—',
      [pesos.length ? fmtData(pesos[pesos.length - 1].data) : '', ultimaAvaliacao() ? `ECC ${ultimaAvaliacao().escore}/9` : ''].filter(Boolean).join(' · ')],
    ['Ração por dia', racaoDoPet() ? fmtG(totalDia(racaoDoPet().refeicoes)) : '—', racaoDoPet() ? plural(racaoDoPet().refeicoes.length, 'refeição', 'refeições') : ''],
    ['Último banho', banho ? textoHaDias(banho.data) : '—', banho ? fmtData(banho.data) : ''],
  ];
  $('#resumo-fatos').innerHTML = fatos
    .map(([rot, val, sub]) => `<div><dt>${rot}</dt><dd>${val}${sub ? `<small>${sub}</small>` : ''}</dd></div>`)
    .join('');

  const emUso = estado.remedios.filter((r) => r.petId === p.id && remedioAtivo(r) && r.inicio <= hojeISO());
  $('#resumo-remedios').hidden = !emUso.length;
  $('#resumo-remedios').innerHTML = emUso.length
    ? `<span aria-hidden="true">💊</span> <span><strong>Em uso:</strong> ${emUso.map((r) => esc(r.nome) + (r.frequencia ? ` (${esc(r.frequencia)})` : '')).join(', ')}</span>`
    : '';

  const al = alertasDoPet(p.id);
  $('#alertas').innerHTML = al
    .map(({ r, st }) => `
      <li class="alerta ${st.nivel}">
        <span aria-hidden="true">${st.icone}</span>
        <span><strong>${TIPOS[r.tipo].nome}: ${esc(r.nome)}</strong> — ${st.texto.toLowerCase()} (${fmtData(r.proxima)})</span>
      </li>`)
    .join('');
  const cont = $('#contador-saude');
  cont.hidden = !al.length;
  cont.textContent = al.length;
  cont.setAttribute('aria-label', `${al.length} aviso(s)`);
}
$('#resumo-fatos').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-informar-idade]')) {
    abrirPainelPets();
    editarPet(estado.petAtual);
    $('#pet-nasc').focus();
  }
});

/* ---------- Abas ---------- */
let abaAtual = 'peso';
try { abaAtual = localStorage.getItem('diario-pet-aba') || 'peso'; } catch (e) { /* sem armazenamento */ }
function mostrarAba(nome) {
  abaAtual = nome;
  if (nome === 'racao') preencherFormRacao();
  if (nome === 'ecc') preencherFormEcc();
  try { localStorage.setItem('diario-pet-aba', nome); } catch (e) { /* ignora */ }
  document.querySelectorAll('.aba-btn').forEach((b) => {
    if (b.dataset.aba === nome) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  renderTudo();
}
$('#abas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-aba]');
  if (b) { mostrarAba(b.dataset.aba); window.scrollTo({ top: 0 }); }
});

/* ---------- Troca de pet ---------- */
// Formulários com dados de um pet não podem "vazar" para outro
function aoTrocarPet() {
  limparFormSaude();
  limparFormDoenca();
  limparFormRemedio();
  preencherFormRacao();
  preencherFormEcc();
  renderTudo();
}

/* ---------- Mudanças vindas de outra aba/janela ---------- */
window.addEventListener('storage', (ev) => {
  if (ev.key !== CHAVE) return;
  const antes = estado.petAtual;
  estado = carregar();
  const sumiu = (campo, lista) => $(campo).value && !lista.some((r) => r.id === $(campo).value);
  if (estado.petAtual !== antes || sumiu('#saude-id', estado.saude) || sumiu('#doenca-id', estado.doencas) || sumiu('#remedio-id', estado.remedios)) aoTrocarPet();
  else renderTudo();
  if (!$('#painel-pets').hidden) renderListaPets();
});

/* ---------- Virada do dia com o app aberto ---------- */
let diaAtual = hojeISO();
const CAMPOS_DATA = ['#peso-data', '#banho-data', '#saude-data'];
function atualizarDia() {
  const hoje = hojeISO();
  if (hoje !== diaAtual) {
    for (const sel of CAMPOS_DATA) if ($(sel).value === diaAtual) $(sel).value = hoje;
    for (const sel of [...CAMPOS_DATA, '#pet-nasc']) $(sel).max = hoje;
    diaAtual = hoje;
  }
  renderTudo(); // idade, "há X dias", avisos e próxima refeição
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarDia(); });
setInterval(() => { if (!document.hidden && hojeISO() !== diaAtual) atualizarDia(); }, 60000);

/* ---------- Render geral ---------- */
function renderTudo() {
  if (estado.petAtual && !petAtual()) estado.petAtual = estado.pets[0]?.id || null;
  if (!estado.petAtual && estado.pets.length) estado.petAtual = estado.pets[0].id;
  renderSeletorPet();
  const temPet = !!petAtual();
  $('#sem-pets').hidden = temPet;
  $('#resumo-pet').hidden = !temPet;
  $('#abas').hidden = !temPet;
  $('#aba-peso').hidden = !temPet || abaAtual !== 'peso';
  $('#aba-saude').hidden = !temPet || abaAtual !== 'saude';
  $('#aba-racao').hidden = !temPet || abaAtual !== 'racao';
  $('#aba-ecc').hidden = !temPet || abaAtual !== 'ecc';
  if (!temPet) return;
  renderResumo();
  if (abaAtual === 'peso') renderPeso();
  else if (abaAtual === 'racao') renderRacao();
  else if (abaAtual === 'ecc') { renderEcc(); renderListaEcc(); }
  else { renderSaude(); renderClinico(); }
}

$('#peso-data').value = hojeISO();
$('#peso-data').max = hojeISO();
$('#banho-data').value = hojeISO();
$('#banho-data').max = hojeISO();
$('#pet-nasc').max = hojeISO();
mostrarSubaba(subabaSaude);
mostrarAba(['peso', 'racao', 'saude', 'ecc'].includes(abaAtual) ? abaAtual : 'peso');
limparFormDoenca();
limparFormRemedio();
limparFormSaude();
