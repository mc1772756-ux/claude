/* Diário do Cachorro — dados salvos no navegador (localStorage) */
'use strict';

const CHAVE = 'diario-pet-v1';
const ESPECIES = { cao: { nome: 'Cão', emoji: '🐶' }, gato: { nome: 'Gato', emoji: '🐱' } };

/* ---------- Estado e armazenamento ---------- */
function estadoVazio() {
  return { versao: 1, petAtual: null, pets: [], pesos: [], racoes: [], saude: [], banhos: [] };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoVazio();
    const e = Object.assign(estadoVazio(), JSON.parse(bruto));
    for (const k of ['pets', 'pesos', 'racoes', 'saude', 'banhos']) if (!Array.isArray(e[k])) e[k] = [];
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
  const n = Number(String(txt).trim().replace(/\s/g, '').replace(',', '.'));
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
  estado.pets = estado.pets.filter((x) => x.id !== id);
  for (const k of ['pesos', 'racoes', 'saude', 'banhos']) estado[k] = estado[k].filter((r) => r.petId !== id);
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
  // Idade: anos/meses aproximados têm prioridade se preenchidos; senão, a data exata
  let nascimento = $('#pet-nasc').value || '';
  let nascAprox = false;
  const anosTxt = $('#pet-idade-anos').value.trim(), mesesTxt = $('#pet-idade-meses').value.trim();
  if (anosTxt || mesesTxt) {
    const anos = anosTxt ? Number(anosTxt) : 0, meses = mesesTxt ? Number(mesesTxt) : 0;
    if (!Number.isInteger(anos) || !Number.isInteger(meses) || anos < 0 || anos > 30 || meses < 0 || meses > 11) {
      erro.textContent = 'Idade aproximada: anos de 0 a 30 e meses de 0 a 11.'; erro.hidden = false; return;
    }
    nascimento = nascimentoEstimado(anos, meses);
    nascAprox = true;
  } else if (nascimento) {
    if (nascimento > hojeISO()) { erro.textContent = 'A data de nascimento não pode estar no futuro.'; erro.hidden = false; return; }
    const antigo = estado.pets.find((p) => p.id === $('#pet-id').value);
    nascAprox = !!(antigo && antigo.nascAprox && antigo.nascimento === nascimento);
  }
  const id = $('#pet-id').value;
  if (id) {
    Object.assign(estado.pets.find((p) => p.id === id), { nome, especie, raca, nascimento, nascAprox });
  } else {
    const p = { id: novoId(), nome, especie, raca, nascimento, nascAprox };
    estado.pets.push(p);
    estado.petAtual = p.id;
  }
  salvar();
  limparFormPet();
  renderTudo();
  renderListaPets();
  if (!id) { fecharPainelPets(); preencherFormRacao(); }
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
  if (id) {
    Object.assign(estado.saude.find((r) => r.id === id), { tipo, nome, data, proxima, obs });
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
  if (rm && pedeConfirmacao(rm)) {
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
      .sort((a, b) => (a.proxima || '9999') < (b.proxima || '9999') ? -1 : 1);
    const antigos = doTipo.filter((r) => !ids.has(r.id));
    const item = (r, atual) => `
      <li class="item-saude${atual ? '' : ' antigo'}">
        <div class="info">
          <div class="principal">${esc(r.nome)}</div>
          <div class="secundario">Aplicada em ${fmtData(r.data)}${r.proxima ? ` · próxima: <strong>${fmtData(r.proxima)}</strong>` : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
          ${atual ? seloStatus(statusDose(r.proxima)) : '<span class="selo neutro">Dose anterior</span>'}
          <div class="acoes">
            ${atual ? `<button type="button" class="btn pequeno" data-nova-dose="${r.id}">+ Nova dose</button>` : ''}
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
    <p class="nota">${porKg ? `≈ ${porKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g por kg de peso · ` : ''}Atualizado em ${fmtData(r.atualizado)}</p>`;
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
    ['Peso', pesos.length ? fmtKg(pesos[pesos.length - 1].kg) : '—', pesos.length ? fmtData(pesos[pesos.length - 1].data) : ''],
    ['Ração por dia', racaoDoPet() ? fmtG(totalDia(racaoDoPet().refeicoes)) : '—', racaoDoPet() ? plural(racaoDoPet().refeicoes.length, 'refeição', 'refeições') : ''],
    ['Último banho', banho ? textoHaDias(banho.data) : '—', banho ? fmtData(banho.data) : ''],
  ];
  $('#resumo-fatos').innerHTML = fatos
    .map(([rot, val, sub]) => `<div><dt>${rot}</dt><dd>${val}${sub ? `<small>${sub}</small>` : ''}</dd></div>`)
    .join('');

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
  if (!temPet) return;
  renderResumo();
  if (abaAtual === 'peso') renderPeso();
  else if (abaAtual === 'racao') renderRacao();
  else renderSaude();
}

$('#pet-atual').addEventListener('change', () => { limparFormSaude(); preencherFormRacao(); });
$('#peso-data').value = hojeISO();
$('#peso-data').max = hojeISO();
$('#banho-data').value = hojeISO();
$('#banho-data').max = hojeISO();
$('#pet-nasc').max = hojeISO();
mostrarAba(['peso', 'racao', 'saude'].includes(abaAtual) ? abaAtual : 'peso');
limparFormSaude();
