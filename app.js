/* Diário do Pet — dados salvos no navegador (localStorage + IndexedDB para fotos) */
'use strict';

const CHAVE = 'diario-pet-v1';
const ESPECIES = { cao: { nome: 'Cão', emoji: '🐶' }, gato: { nome: 'Gato', emoji: '🐱' } };

/* ---------- Estado e armazenamento ---------- */
function estadoVazio() {
  return { versao: 1, petAtual: null, pets: [], pesos: [], racoes: [], saude: [], banhos: [], doencas: [], remedios: [], ecc: [], checagens: [], sintomas: [], consultas: [], gastos: [] };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoVazio();
    const e = Object.assign(estadoVazio(), JSON.parse(bruto));
    for (const k of ['pets', 'pesos', 'racoes', 'saude', 'banhos', 'doencas', 'remedios', 'ecc', 'checagens', 'sintomas', 'consultas', 'gastos']) if (!Array.isArray(e[k])) e[k] = [];
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
// Date → 'AAAA-MM-DD' no fuso local
function paraISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const hojeISO = () => paraISO(new Date());
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
  return paraISO(alvo);
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
    .map((p) => `<option value="${p.id}">${ESPECIES[p.especie].emoji} ${esc(p.nome)}${avisosDoPet(p.id).length ? ' ⚠️' : ''}</option>`)
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
        <span class="avatar pequeno" aria-hidden="true">${avatarHTML(p, 36)}</span>
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
  atualizarSugestoesRaca();
  fotoForm = '';
  iconeForm = '';
  atualizarPreviaAvatar();
}

function editarPet(id) {
  const p = estado.pets.find((x) => x.id === id);
  if (!p) return;
  $('#pet-id').value = p.id;
  $('#pet-nome').value = p.nome;
  $('#pet-especie').value = p.especie;
  $('#pet-raca').value = p.raca || '';
  atualizarSugestoesRaca();
  fotoForm = p.foto || '';
  iconeForm = p.icone || '';
  atualizarPreviaAvatar();
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
  for (const r of [...estado.sintomas, ...estado.consultas]) if (r.petId === id && r.fotoId) FotosDB.apagar(r.fotoId);
  estado.pets = estado.pets.filter((x) => x.id !== id);
  for (const k of ['pesos', 'racoes', 'saude', 'banhos', 'doencas', 'remedios', 'ecc', 'checagens', 'sintomas', 'consultas', 'gastos']) estado[k] = estado[k].filter((r) => r.petId !== id);
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
    if (existente.raca !== raca || existente.especie !== especie) existente.racaGuia = '';
    Object.assign(existente, { nome, especie, raca, nascimento, nascAprox, foto: fotoForm, icone: iconeForm });
  } else {
    const p = { id: novoId(), nome, especie, raca, nascimento, nascAprox, foto: fotoForm, icone: iconeForm };
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
  const isoDe = (t) => paraISO(new Date(t));
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

function eventoVacina(r) {
  const tipo = TIPOS[r.tipo].nome.toLowerCase();
  return {
    uid: `${r.id}-${compacto(r.proxima)}`,
    titulo: `${TIPOS[r.tipo].emoji} ${nomePet(r.petId)}: ${tipo} ${r.nome}`,
    detalhes: `Próxima dose de ${tipo} (${r.nome}) de ${nomePet(r.petId)}.\nÚltima aplicação: ${fmtData(r.data)}.${r.obs ? '\nObs.: ' + r.obs : ''}\nRegistrado no Diário do Pet.`,
    data: r.proxima,
    alarmes: ['-P2DT15H', 'PT9H'], // 3 dias antes às 9h e no dia às 9h
  };
}
const linkGoogleAgenda = (r) => linkGoogle(eventoVacina(r));
const textoICS = (r) => arquivoICS([eventoVacina(r)]);
function baixarICS(r) {
  baixarTexto(nomeArquivo(r.tipo, r.nome, nomePet(r.petId)) + '.ics', textoICS(r));
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
try {
  const salva = localStorage.getItem('diario-pet-subaba');
  subabaSaude = ['prevencao', 'clinico', 'raca'].includes(salva) ? salva : 'prevencao';
} catch (e) { /* ignora */ }
function mostrarSubaba(nome) {
  subabaSaude = nome;
  try { localStorage.setItem('diario-pet-subaba', nome); } catch (e) { /* ignora */ }
  document.querySelectorAll('.subaba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.subaba === nome)));
  $('#saude-prevencao').hidden = nome !== 'prevencao';
  $('#saude-clinico').hidden = nome !== 'clinico';
  $('#saude-raca').hidden = nome !== 'raca';
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
const remedioAtivo = (r) => !r.encerrado && (!r.fim || r.fim >= hojeISO());

function statusRemedio(r) {
  const hoje = hojeISO();
  if (r.encerrado) return { classe: 'neutro', texto: `Encerrado em ${fmtData(r.encerrado)}` };
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
  const horas = [...new Set(['#remedio-hora1', '#remedio-hora2', '#remedio-hora3'].map((h) => $(h).value).filter(Boolean))].sort();
  const estoqueTxt = $('#remedio-estoque').value.trim();
  const dosesTxt = $('#remedio-doses-dia').value.trim();
  const estoque = estoqueTxt ? lerNumero(estoqueTxt) : null;
  const dosesDia = dosesTxt ? lerNumero(dosesTxt) : null;
  let msg = '';
  if ((estoqueTxt || dosesTxt) && !(estoque >= 0 && dosesDia > 0)) msg = 'Estoque: informe as doses em casa e quantas doses por dia (ex.: 30 e 2).';
  else if (!nome) msg = 'Informe o nome do remédio.';
  else if (!inicio) msg = 'Informe a data de início.';
  else if (fim && fim < inicio) msg = 'O término não pode ser antes do início.';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const id = $('#remedio-id').value;
  const existente = id && estado.remedios.find((r) => r.id === id);
  const dados = { nome, dose, frequencia, horarios, inicio, fim, doencaId, obs, horas, dosesDia: dosesDia || null };
  // Estoque: só "recomeça a contar" se o número mudou (compra nova ou correção)
  const atualEst = existente ? estoqueRemedio(existente) : null;
  if (estoque === null) { dados.estoque = null; dados.estoqueData = ''; }
  else if (!atualEst || Math.abs(atualEst.restante - estoque) > 0.05 || existente.dosesDia !== dosesDia) { dados.estoque = estoque; dados.estoqueData = hojeISO(); }
  // Término alterado para hoje ou depois (ou em branco) num remédio encerrado: volta a ficar em uso
  if (existente && existente.encerrado && fim !== existente.fim && (!fim || fim >= hojeISO())) dados.encerrado = '';
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
  ['#remedio-hora1', '#remedio-hora2', '#remedio-hora3'].forEach((h, i) => { $(h).value = (r.horas || [])[i] || ''; });
  const est = estoqueRemedio(r);
  $('#remedio-estoque').value = est ? String(est.restante).replace('.', ',') : '';
  $('#remedio-doses-dia').value = r.dosesDia ? String(r.dosesDia).replace('.', ',') : '';
  $('#form-remedio-titulo').textContent = `Editar: ${r.nome}`;
  $('#btn-salvar-remedio').textContent = 'Salvar alterações';
  $('#btn-cancelar-remedio').hidden = false;
  $('#form-remedio').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Encerrar hoje (ex.: tratamento concluído antes do previsto); "Reativar" desfaz
function encerrarRemedio(id) {
  const r = estado.remedios.find((x) => x.id === id);
  if (!r) return;
  const hoje = hojeISO();
  r.encerrado = hoje;
  if ((!r.fim || r.fim > hoje) && r.inicio <= hoje) r.fim = hoje;
  salvar();
  renderTudo();
}
function reativarRemedio(id) {
  const r = estado.remedios.find((x) => x.id === id);
  if (!r) return;
  r.encerrado = '';
  if (r.fim && r.fim < hojeISO()) r.fim = '';
  salvar();
  renderTudo();
}

$('#saude-clinico').addEventListener('click', (ev) => {
  const t = (sel) => ev.target.closest(sel);
  let b;
  if ((b = t('[data-editar-doenca]'))) editarDoenca(b.dataset.editarDoenca);
  if ((b = t('[data-editar-remedio]'))) editarRemedio(b.dataset.editarRemedio);
  if ((b = t('[data-encerrar-remedio]')) && pedeConfirmacao(b, 'Encerrar?')) encerrarRemedio(b.dataset.encerrarRemedio);
  if ((b = t('[data-reativar-remedio]'))) reativarRemedio(b.dataset.reativarRemedio);
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
          ${ativo && estoqueRemedio(r) ? (() => { const e = estoqueRemedio(r); return `<span class="selo ${e.diasRestantes <= 3 ? 'perto' : 'neutro'}">Restam ~${fmtNum(e.restante, e.restante % 1 ? 1 : 0)} doses (${plural(e.diasRestantes, 'dia', 'dias')})</span>`; })() : ''}
          ${ativo && r.horas && r.horas.length ? `<div class="secundario">⏰ Lembrete: ${r.horas.join(', ')}</div>` : ''}
          <div class="acoes">
            ${ativo && r.horas && r.horas.length ? botoesEvento('rem-' + r.id, eventosRemedio(r), (ev) => `📅 ${ev.hora}`) : ''}
            <button type="button" class="btn pequeno" data-editar-remedio="${r.id}">Editar</button>
            ${ativo && r.inicio <= hojeISO() ? `<button type="button" class="btn pequeno" data-encerrar-remedio="${r.id}">Encerrar</button>` : ''}
            ${!ativo ? `<button type="button" class="btn pequeno" data-reativar-remedio="${r.id}">Voltar a usar</button>` : ''}
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

/* ---------- Guia de cuidados por raça ---------- */
// Predisposições descritas na literatura veterinária. Ter predisposição
// não significa que o pet terá a doença: é o que vale a pena checar.
// Cada item: primeiros sinais (o que dá para notar em casa), sinal de urgência,
// o que fazer, idade típica e fontes consultadas.
const F = {
  vetcompassPatela: ['O\'Neill et al., 2016 (VetCompass)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4898461/'],
  pll: ['Farias et al., 2010 (luxação do cristalino em terriers)', 'https://pubmed.ncbi.nlm.nih.gov/20375329/'],
  ataxiaJrt: ['Ataxia hereditária em Russell terriers (2016)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5057501/'],
  perthes: ['Revisão: Legg-Calvé-Perthes em cães', 'https://www.sciencedirect.com/science/article/abs/pii/S1286011520301211'],
  respiracao: ['VCA: contagem de respirações em casa', 'https://vcahospitals.com/know-your-pet/home-breathing-rate-evaluation'],
  merck: ['Manual Merck: necessidades nutricionais', 'https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals'],
  pkd: ['UC Davis VGL: PKD em gatos', 'https://vgl.ucdavis.edu/test/pkd1-cat'],
  persaOlhos: ['Revisão: saúde do gato Persa', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6748978/'],
  dermatofitose: ['Dermatologia veterinária: dermatofitose', 'https://open.lib.umn.edu/animaldermatology/chapter/dermatophytosis-dogs-and-cats/'],
  cmhMaine: ['UC Davis VGL: CMH no Maine Coon', 'https://vgl.ucdavis.edu/test/maine-coon-hcm'],
  displasiaMaine: ['Loder & Todhunter, 2018 (displasia no Maine Coon)', 'https://catvets.com/publication/demographics-of-hip-dysplasia-in-the-maine-coon-cat/'],
  ame: ['Fyfe et al., 2006 (AME felina)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1557767/'],
  asma: ['Adamama-Moraitou et al., 2004 (doença das vias aéreas)', 'https://pubmed.ncbi.nlm.nih.gov/15265478/'],
  amiloidose: ['UFAW: amiloidose no Siamês', 'https://www.ufaw.org.uk/cats/siamese---amyloidosis'],
  praSiames: ['UC Davis VGL: atrofia de retina rdAc', 'https://vgl.ucdavis.edu/test/pra-rdac'],
  surdezBranco: ['PetMD: Angorá Turco', 'https://www.petmd.com/cat/breeds/turkish-angora'],
  esporotricose: ['Montenegro et al., 2014 (esporotricose em SP)', 'https://link.springer.com/article/10.1186/s12917-014-0269-5'],
  esporotricoseSP: ['Secretaria da Saúde de SP: esporotricose', 'https://www.saude.sp.gov.br/resources/coordenadoria-de-defesa-e-saude-animal/homepage/acesso-rapido/acesso-rapido-zoonoses/esporotricose_serie_zoonoses.pdf'],
  vetcompassYork: ['VetCompass: Yorkshire Terriers no Reino Unido', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12344897/'],
  shunt: ['Tobias & Rohrbach, 2003 (shunt por raça)', 'https://pubmed.ncbi.nlm.nih.gov/14664452/'],
  hipoglicemia: ['AKC: hipoglicemia em cães', 'https://www.akc.org/expert-advice/health/hypoglycemia-in-dogs/'],
  aaha: ['AAHA 2021: nutrição e controle de peso', 'https://www.aaha.org/resources/2021-aaha-nutrition-and-weight-management-guidelines/weight-reduction-in-the-obese-pet/0/'],
};

const CUIDADOS = {
  'colapso-traqueia': {
    idade: [12, Infinity], peso: true,
    nome: 'Colapso de traqueia',
    sinais: ['Tosse seca e alta, parecida com o som de um ganso ou buzina', 'Piora com agitação, ao puxar a guia, no calor ou ao beber água', 'Cansa rápido nos passeios'],
    urgente: 'Dificuldade para respirar ou gengiva azulada: emergência.',
    prevenir: 'Use peitoral em vez de coleira no pescoço. Mantenha o peso ideal e evite fumaça e perfumes perto dele.',
    inicial: 'Na crise de tosse, acalme-o e leve para lugar fresco e arejado. Não puxe pela coleira. Grave um vídeo da tosse para o veterinário.',
    quando: 'Mais comum na meia-idade, mas pode começar cedo em raças toy.',
    fontes: [],
  },
  shunt: {
    idade: [0, 24],
    nome: 'Shunt portossistêmico (desvio no fígado)',
    sinais: ['Filhote menor que os irmãos ou que não ganha peso', 'Fica "aéreo", anda em círculos ou encosta a cabeça na parede, principalmente depois de comer', 'Baba muito', 'Bebe e urina mais'],
    urgente: 'Convulsão ou desorientação forte: emergência.',
    prevenir: 'Não há prevenção: é de nascença. Fique atento aos sinais na fase de filhote e leve às consultas de rotina.',
    inicial: 'Anote se os sinais aparecem depois das refeições e marque consulta. O diagnóstico é por exame de sangue (ácidos biliares) e imagem.',
    quando: 'Geralmente aparece antes dos 2 anos.',
    fontes: [F.shunt],
  },
  hipoglicemia: {
    idade: [0, 4],
    nome: 'Hipoglicemia (açúcar baixo) em filhotes',
    sinais: ['Fraqueza e sonolência fora do normal', 'Tremores', 'Cambaleia ou anda desequilibrado'],
    urgente: 'Desmaio ou convulsão: emergência.',
    prevenir: 'Filhotes de raça pequena precisam de 3 a 4 refeições por dia, sem longos períodos sem comer. Proteja do frio.',
    inicial: 'Se estiver acordado e conseguir engolir, passe um pouco de mel ou xarope de glicose na gengiva e vá ao veterinário. Se estiver desacordado, não coloque nada na boca.',
    quando: 'Filhotes até cerca de 4 meses.',
    fontes: [F.hipoglicemia],
  },
  'dentes-leite': {
    idade: [4, 12],
    nome: 'Dentes de leite que não caem',
    sinais: ['Dois dentes no mesmo lugar, principalmente os caninos (presas)', 'Dentes tortos ou apertados', 'Mau hálito precoce'],
    prevenir: 'Olhe a boca dele entre 4 e 7 meses, quando os dentes de leite deveriam cair.',
    inicial: 'Não tente arrancar. O veterinário costuma remover na castração ou num procedimento rápido.',
    quando: 'Entre 4 e 7 meses de idade.',
    fontes: [F.vetcompassYork],
  },
  'luxacao-patelar': {
    idade: [4, Infinity], peso: true,
    nome: 'Luxação de patela',
    sinais: ['Dá "pulinhos" com uma pata de trás durante a corrida', 'Corre alguns passos em três patas e logo volta ao normal', 'Estica a pata para trás como se "destravasse" o joelho', 'Manqueira que vai e volta'],
    prevenir: 'Mantenha o peso ideal. Evite pulos de lugares altos (sofá, cama, carro): use rampa ou escada. Piso escorregadio piora; tapetes ajudam.',
    inicial: 'Se ele travar a pata, não force o joelho. Deixe descansar e evite corridas e escadas por alguns dias. Grave um vídeo do episódio para mostrar ao veterinário.',
    quando: 'Desde filhote; mais atenção a partir dos 6 meses.',
    fontes: [F.vetcompassPatela],
  },
  'luxacao-cristalino': {
    idade: [36, 96],
    nome: 'Luxação do cristalino',
    sinais: ['Olho vermelho ou lacrimejando de um lado só', 'Pisca muito ou fica apertando o olho', 'Olho turvo, azulado ou com aspecto diferente do outro'],
    urgente: 'Qualquer um desses sinais é emergência: pode virar glaucoma e cegueira em poucas horas. Vá ao veterinário no mesmo dia.',
    prevenir: 'Não há como evitar, mas como é comum na raça, peça exame dos olhos no check-up anual a partir dos 3 anos.',
    inicial: 'Não esfregue nem aperte o olho e não pingue colírio sem orientação. Impeça que ele coce o olho com a pata (um colar elizabetano ajuda). Vá ao veterinário no mesmo dia.',
    quando: 'Geralmente em adultos, entre 3 e 8 anos.',
    fontes: [F.pll],
  },
  perthes: {
    idade: [4, 12],
    nome: 'Doença de Legg-Calvé-Perthes (quadril)',
    sinais: ['Começa a mancar de uma pata traseira', 'A manqueira piora aos poucos em semanas', 'Reclama ou se afasta quando mexem no quadril', 'Coxa daquele lado fica mais fina'],
    prevenir: 'Não há prevenção conhecida. Leve o filhote às consultas de rotina para notar cedo.',
    inicial: 'Repouso: evite pulos, escadas e brincadeiras de correr. Não dê remédio para dor de uso humano. Marque consulta nos próximos dias.',
    quando: 'Filhotes e jovens, geralmente entre 4 e 12 meses.',
    fontes: [F.perthes],
  },
  'surdez-congenita': {
    idade: [0, 6],
    nome: 'Surdez de nascença',
    sinais: ['Não acorda nem vira a cabeça com barulhos', 'Não atende quando chamado sem ver você', 'Sono muito pesado; se assusta quando tocado', 'Late muito alto'],
    prevenir: 'É de nascença. Ao escolher filhote, observe se reage a sons.',
    inicial: 'Se ele não ouve, ande sempre na guia (não percebe carros). Ensine sinais com a mão e acorde-o tocando de leve, perto da cabeça.',
    quando: 'De nascença; dá para notar nas primeiras semanas.',
    fontes: [],
  },
  'ataxia-jrt': {
    idade: [2, 18],
    nome: 'Ataxia hereditária (coordenação)',
    sinais: ['Andar desajeitado, patas de trás "duras" ou abertas', 'Tropeça e cai mais que outros filhotes', 'Dificuldade em escadas e para pular', 'Tremores ou espasmos'],
    prevenir: 'É hereditária: ao comprar um filhote, pergunte sobre problemas neurológicos na família.',
    inicial: 'Evite escadas e lugares altos. Use tapetes em piso liso e passeios curtos. Marque consulta para avaliação.',
    quando: 'Geralmente no primeiro ano de vida.',
    fontes: [F.ataxiaJrt],
  },
  atopia: {
    idade: [6, 72],
    nome: 'Alergias de pele (dermatite atópica)',
    sinais: ['Coça muito, principalmente à noite', 'Lambe ou morde as patas (pelo entre os dedos fica avermelhado)', 'Vermelhidão na barriga, axilas e virilha', 'Coça as orelhas ou balança a cabeça; otites que voltam'],
    prevenir: 'Antipulgas sempre em dia. Banhos só com xampu para cães e seque bem entre os dedos e as dobras. Anote o que piora (estação, comida, lugar).',
    inicial: 'Lave as patas com água após o passeio e seque bem. Não use pomadas ou remédios humanos, como corticoide ou antialérgico, sem orientação. Se ele estiver se ferindo de tanto coçar, consulte logo.',
    quando: 'Costuma começar entre 6 meses e 3 anos.',
    fontes: [],
  },
  'periodontal-cao': {
    comumNaIdade: true,
    idade: [24, Infinity],
    nome: 'Doença periodontal (dentes e gengiva)',
    sinais: ['Mau hálito', 'Tártaro amarelado ou marrom nos dentes de trás', 'Gengiva vermelha ou que sangra', 'Mastiga de um lado só ou deixa a ração cair'],
    prevenir: 'Escove os dentes, o ideal é todo dia, com pasta para cães (a humana não serve). Use brinquedos de mastigar seguros e faça limpeza quando o veterinário indicar.',
    inicial: 'Dente mole, rosto inchado ou recusa de comida: ofereça ração molhada para amolecer e marque consulta. Não tente arrancar dente nem raspar tártaro em casa.',
    quando: 'A partir dos 2–3 anos.',
    fontes: [],
  },
  'valvar-mitral': {
    idade: [84, Infinity],
    nome: 'Doença da válvula mitral (coração)',
    sinais: ['Tosse, principalmente à noite ou ao acordar', 'Cansa mais rápido nos passeios', 'Respiração acelerada enquanto dorme'],
    urgente: 'Respiração difícil, gengiva azulada ou desmaio: emergência.',
    prevenir: 'Peso ideal e passeios regulares, sem esforço extremo no calor. Ausculta do coração em toda consulta a partir dos 6–7 anos.',
    inicial: 'Com tosse ou cansaço, conte as respirações dormindo e anote. Deixe-o em lugar fresco e em repouso. Respiração difícil ou gengiva azulada: vá direto ao pronto-atendimento.',
    quando: 'Idosos de raças pequenas, a partir dos 7–8 anos.',
    fontes: [F.respiracao],
  },
  carrapato: {
    idade: [0, Infinity],
    nome: 'Doenças do carrapato (erliquiose e babesiose)',
    sinais: ['Fica quieto e sem vontade de brincar', 'Come menos', 'Febre (focinho e orelhas quentes, corpo mole)', 'Manchinhas roxas na pele, sangramento pelo nariz, gengiva pálida'],
    prevenir: 'Carrapaticida contínuo (coleira, comprimido ou pipeta) no prazo certo. Revise o corpo após passeios em grama ou mato. Trate o ambiente se aparecerem carrapatos em casa.',
    inicial: 'Para tirar um carrapato, puxe firme com pinça, rente à pele, sem torcer nem esmagar. Não use álcool, fogo ou óleo. Com apatia, febre ou sangramento, consulte no mesmo dia.',
    quando: 'Qualquer idade; mais nos meses quentes.',
    fontes: [],
  },
  leishmaniose: {
    idade: [0, Infinity],
    nome: 'Leishmaniose',
    sinais: ['Perda de pelo ao redor dos olhos ("óculos")', 'Pele descamando como caspa', 'Unhas crescendo demais', 'Feridas nas pontas das orelhas e no focinho', 'Emagrecimento'],
    prevenir: 'Coleira repelente específica, trocada no prazo. Evite passeios ao entardecer e à noite, quando o mosquito-palha é mais ativo. Mantenha o quintal limpo, sem folhas e matéria orgânica. Pergunte sobre a vacina.',
    inicial: 'Não há cuidado caseiro: com perda de pelo nos olhos, unhas grandes ou feridas nas orelhas, marque consulta para teste.',
    quando: 'Qualquer idade.',
    fontes: [],
  },
  dirofilariose: {
    idade: [0, Infinity],
    nome: 'Dirofilariose (verme do coração)',
    sinais: ['Tosse seca', 'Cansa fácil', 'Perde peso. No início pode não ter sinais'],
    prevenir: 'Prevenção mensal indicada pelo veterinário, principalmente no litoral. Use repelente e evite passeios no fim da tarde em áreas com muito mosquito.',
    inicial: 'Com tosse ou cansaço, deixe-o em repouso e marque consulta. Não dê vermífugo comum achando que resolve: o tratamento é diferente.',
    quando: 'Qualquer idade.',
    fontes: [],
  },
  'obesidade-cao': {
    idade: [12, Infinity], obesidade: true,
    nome: 'Sobrepeso e obesidade',
    sinais: ['Fica difícil sentir as costelas', 'Some a "cintura" vista de cima', 'Cansa mais nos passeios'],
    prevenir: 'Pese a ração na balança (copo medidor engana). Petiscos até 10% das calorias. Faça passeios diários e reavalie o ECC na aba ECC.',
    inicial: 'Reduza aos poucos, seguindo a meta da aba ECC. Não faça jejum nem corte brusco. Troque petiscos por pedaços de cenoura ou da própria ração.',
    quando: 'Mais comum após a castração e na meia-idade.',
    fontes: [F.aaha],
  },

  // ----- gatos -----
  pkd: {
    idade: [12, Infinity],
    nome: 'Rins policísticos (PKD)',
    sinais: ['Bebe mais água que o normal', 'Caixa de areia com mais xixi (torrões maiores)', 'Emagrece aos poucos', 'Vômitos e pelo sem brilho'],
    prevenir: 'É genética. Água fresca à vontade e sachê ajudam os rins. Faça ultrassom no check-up de Persas e mestiços.',
    inicial: 'Se começar a beber muito, mantenha a água sempre disponível (nunca restrinja) e marque consulta para exames.',
    quando: 'Cistos desde jovem; sinais geralmente após os 7 anos.',
    fontes: [F.pkd],
  },
  braquicefalica: {
    idade: [0, Infinity],
    nome: 'Problemas do focinho achatado',
    sinais: ['Respiração barulhenta ou ronco', 'Cansa e respira pela boca no calor', 'Dificuldade para pegar a comida'],
    urgente: 'Respirar de boca aberta em repouso é emergência em gatos.',
    prevenir: 'Ambiente fresco e arejado. Peso ideal. Use comedouro raso e largo.',
    inicial: 'Se cansar, leve para lugar fresco e deixe descansar sem estresse. Não molhe com água gelada. Respiração de boca aberta: vá ao veterinário imediatamente.',
    quando: 'Desde filhote.',
    fontes: [F.persaOlhos],
  },
  'olhos-persa': {
    idade: [0, Infinity],
    nome: 'Lacrimejamento e problemas na córnea',
    sinais: ['Lágrima escorrendo e manchando o pelo do rosto', 'Olho vermelho ou semifechado', 'Mancha marrom ou preta no olho'],
    prevenir: 'Limpe ao redor dos olhos todo dia com gaze e soro fisiológico, uma gaze para cada olho. Mantenha os pelos do rosto curtos.',
    inicial: 'Limpe só a secreção com soro, sem tocar no olho. Não use colírio humano nem chá ou camomila. Olho fechado ou com mancha: consulte em até 1–2 dias.',
    quando: 'Qualquer idade.',
    fontes: [F.persaOlhos],
  },
  dermatofitose: {
    idade: [0, Infinity],
    nome: 'Micose de pele (dermatofitose)',
    sinais: ['Falhas de pelo arredondadas', 'Pele descamando', 'Pelos quebradiços', 'Às vezes pouca coceira'],
    prevenir: 'Escove para ver a pele, aspire a casa com frequência e lave as caminhas. Observe gatos novos antes de juntar com os outros.',
    inicial: 'Separe o gato dos outros animais. Use luvas e lave as mãos após manusear. Lave caminhas e cobertas em água quente. Não use pomada humana: marque consulta.',
    quando: 'Mais comum em filhotes. Persas têm formas mais graves e duradouras.',
    fontes: [F.dermatofitose],
  },
  cmh: {
    idade: [12, Infinity],
    nome: 'Cardiomiopatia hipertrófica (CMH)',
    sinais: ['Respiração acelerada enquanto dorme', 'Cansa ou ofega depois de brincar', 'Mais quieto e dormindo mais', 'Muitas vezes não há sinal nenhum antes de uma crise'],
    urgente: 'Respirar de boca aberta, ou paralisia súbita das patas de trás com dor e choro: emergência.',
    prevenir: 'Ausculta do coração em toda consulta. Se houver sopro, faça o ecocardiograma que o veterinário indicar. Conte as respirações dormindo uma vez por mês para conhecer o normal dele.',
    inicial: 'Respiração acelerada: deixe em lugar calmo e fresco, sem manipular muito, e vá ao veterinário. Paralisia das patas de trás: emergência. Transporte com cuidado e sem demora.',
    quando: 'Pode surgir a partir de 1 ano.',
    fontes: [F.cmhMaine, F.respiracao],
  },
  'displasia-quadril': {
    idade: [12, Infinity], peso: true,
    nome: 'Displasia de quadril',
    sinais: ['Evita pular em lugares altos', 'Sobe a escada ou entra na caixa de areia com dificuldade', 'Patas de trás rígidas depois de dormir'],
    prevenir: 'Peso ideal. Use degraus ou rampas para lugares altos e caixa de areia com entrada baixa.',
    inicial: 'Ofereça lugares baixos e macios para dormir. Não dê anti-inflamatório humano: é tóxico para gatos. Marque consulta.',
    quando: 'Sinais geralmente em adultos.',
    fontes: [F.displasiaMaine],
  },
  'ame-maine': {
    idade: [2, 8],
    nome: 'Atrofia muscular espinhal (AME)',
    sinais: ['Filhote com tremores nas patas de trás', 'Anda agachado ou "rebolando"', 'Não consegue pular como os irmãos'],
    prevenir: 'É hereditária: ao comprar, pergunte ao criador sobre a saúde dos pais e dos filhotes anteriores.',
    inicial: 'Proteja de quedas: sem lugares altos e com caixa de areia baixa. Marque consulta para avaliação.',
    quando: 'Por volta dos 3–4 meses.',
    fontes: [F.ame],
  },
  asma: {
    idade: [24, 96],
    nome: 'Asma felina',
    sinais: ['Tosse agachado com o pescoço esticado (parece bola de pelo, mas não sai nada)', 'Chiado ao respirar', 'Cansa mais rápido brincando'],
    urgente: 'Respirar de boca aberta ou com esforço da barriga: emergência.',
    prevenir: 'Evite fumaça de cigarro, incenso, perfumes e sprays em casa. Use areia com pouca poeira. Mantenha a casa ventilada e o peso ideal.',
    inicial: 'Durante a crise, deixe-o em lugar calmo e ventilado, longe de fumaça e poeira, e grave um vídeo. Se respirar de boca aberta ou a crise não passar em alguns minutos, vá ao veterinário.',
    quando: 'Geralmente entre 2 e 8 anos.',
    fontes: [F.asma],
  },
  amiloidose: {
    idade: [12, 84],
    nome: 'Amiloidose (fígado)',
    sinais: ['Come menos e emagrece', 'Mais quieto', 'Gengiva mais clara que o normal'],
    urgente: 'Fraqueza súbita, gengiva muito pálida ou barriga aumentada podem ser sangramento interno: emergência.',
    prevenir: 'Não há prevenção conhecida. Faça exames de sangue de rotina e trate infecções e inflamações (gengivite, por exemplo).',
    inicial: 'Com fraqueza súbita ou gengiva muito pálida, evite que ele pule ou faça esforço e leve ao veterinário imediatamente.',
    quando: 'Adultos jovens, entre 1 e 7 anos.',
    fontes: [F.amiloidose],
  },
  'pra-siames': {
    idade: [6, Infinity],
    nome: 'Atrofia progressiva da retina',
    sinais: ['Hesita ou esbarra em objetos à noite ou no escuro', 'Pupilas grandes mesmo com luz', 'Pula com menos confiança'],
    prevenir: 'Não há prevenção. Exame de olhos no check-up permite planejar a adaptação.',
    inicial: 'Não mude os móveis de lugar. Use luz noturna. Mantenha água, comida e caixa de areia sempre no mesmo lugar. Gato com visão ruim não deve sair à rua.',
    quando: 'Começa em jovens e piora com os anos.',
    fontes: [F.praSiames],
  },
  'surdez-branco': {
    idade: [0, 6],
    nome: 'Surdez (gatos brancos de olhos azuis)',
    sinais: ['Não reage a barulhos fora do campo de visão', 'Mia muito alto', 'Se assusta quando tocado dormindo'],
    prevenir: 'É de nascença. Gatos brancos de olhos azuis também precisam de protetor solar veterinário nas orelhas.',
    inicial: 'Mantenha dentro de casa. Chame-o com gestos e vibração no chão. Ao acordá-lo, toque de leve.',
    quando: 'De nascença.',
    fontes: [F.surdezBranco],
  },
  'bolas-pelo': {
    idade: [0, Infinity],
    nome: 'Bolas de pelo',
    sinais: ['Vomita pelo com frequência', 'Ânsia sem vomitar nada', 'Prisão de ventre'],
    prevenir: 'Escovação regular, água à vontade e fibras se o veterinário indicar.',
    inicial: 'Ânsia ocasional é comum. Vômitos repetidos no mesmo dia, recusa de comida ou barriga dura: consulte. Não dê óleo mineral nem laxante humano.',
    quando: 'Qualquer idade.',
    fontes: [],
  },
  drc: {
    comumNaIdade: true,
    idade: [84, Infinity],
    nome: 'Doença renal crônica',
    sinais: ['Bebe mais água', 'Mais xixi na caixa (torrões maiores)', 'Emagrece aos poucos', 'Mau hálito, vômitos, pelo sem brilho'],
    prevenir: 'Água fresca em vários pontos ou fonte; parte da dieta úmida (sachê). Exames anuais a partir dos 7 anos.',
    inicial: 'Se começar a beber muito, nunca restrinja a água. Ofereça sachê para hidratar. Marque consulta para exames de sangue e urina.',
    quando: 'Principalmente acima dos 7 anos.',
    fontes: [],
  },
  dtuif: {
    idade: [24, 72], peso: true,
    nome: 'Cistite e problemas urinários (DTUIF)',
    sinais: ['Vai várias vezes à caixa e sai pouco xixi', 'Xixi com sangue', 'Faz xixi fora da caixa', 'Lambe muito a região genital'],
    urgente: 'Gato macho que vai à caixa e não sai xixi é emergência: pode ser obstrução.',
    prevenir: 'Mais água (fonte, sachê). Caixas limpas todo dia, uma por gato e mais uma. Rotina estável e peso ideal.',
    inicial: 'Se for macho e não sair xixi: emergência, vá agora (risco de vida em horas). Com sangue ou idas frequentes, mantenha o gato calmo, ofereça água e marque consulta no mesmo dia.',
    quando: 'Mais comum entre 2 e 6 anos.',
    fontes: [],
  },
  'dentes-gato': {
    comumNaIdade: true,
    idade: [36, Infinity],
    nome: 'Doença periodontal e reabsorção dentária',
    sinais: ['Mau hálito', 'Baba', 'Mastiga de um lado só ou deixa a comida cair', 'Prefere sachê à ração seca'],
    prevenir: 'Escovação com pasta veterinária, se ele aceitar. Avaliação odontológica anual.',
    inicial: 'Ofereça comida úmida enquanto não consulta. Não use pasta humana: o flúor e o xilitol fazem mal.',
    quando: 'A partir dos 3 anos.',
    fontes: [],
  },
  'obesidade-gato': {
    idade: [12, Infinity], obesidade: true,
    nome: 'Obesidade e diabetes',
    sinais: ['Barriga pendurada, sem cintura', 'Dificuldade para se limpar nas costas', 'Diabetes: bebe e urina muito, come mais e emagrece'],
    prevenir: 'Porções medidas na balança e brincadeiras diárias (varinha, bolinha). Comedouros interativos ajudam.',
    inicial: 'Reduza só um pouco por vez, seguindo a meta da aba ECC. Nunca deixe sem comer: o jejum causa lipidose hepática. Se ele parar de comer por 1–2 dias, vá ao veterinário.',
    quando: 'Castrados e gatos de apartamento, a partir dos 5 anos.',
    fontes: [F.aaha],
  },
  'fiv-felv': {
    idade: [0, Infinity],
    nome: 'FIV e FeLV',
    sinais: ['Infecções que voltam (gripes, feridas)', 'Gengiva muito inflamada', 'Emagrecimento', 'Gengiva pálida'],
    prevenir: 'Castração (diminui brigas), sem acesso à rua, teste de todo gato novo e vacina de FeLV conforme indicação.',
    inicial: 'Separe o gato suspeito dos outros, com potes e caixa próprios, até sair o resultado do teste.',
    quando: 'Qualquer idade; risco maior com acesso à rua.',
    fontes: [],
  },
  esporotricose: {
    idade: [0, Infinity],
    nome: 'Esporotricose',
    sinais: ['Ferida que não cicatriza, principalmente no focinho, cabeça ou patas', 'Nódulos que abrem e soltam secreção', 'Espirros com ferida no nariz'],
    urgente: 'Passa para pessoas e outros animais por arranhão e mordida: use luvas ao manusear e leve ao veterinário logo.',
    prevenir: 'Gato dentro de casa e castrado. Telas nas janelas.',
    inicial: 'Use luvas sempre. Separe o gato num cômodo e não deixe a ferida em contato com outras pessoas e animais. Não aperte nem esprema a ferida. Leve ao veterinário em caixa de transporte. Se alguém for arranhado, procure um posto de saúde.',
    quando: 'Qualquer idade; mais em machos com acesso à rua.',
    fontes: [F.esporotricose, F.esporotricoseSP],
  },
  hipertireoidismo: {
    comumNaIdade: true,
    idade: [120, Infinity],
    nome: 'Hipertireoidismo',
    sinais: ['Emagrece mesmo comendo muito', 'Agitado, mia mais à noite', 'Vômitos', 'Pelo malcuidado'],
    prevenir: 'Não há prevenção conhecida; exames anuais a partir dos 10 anos permitem descobrir cedo.',
    inicial: 'Anote o peso e o apetite e marque consulta. Mantenha água e comida disponíveis.',
    quando: 'Idosos, acima de 10 anos.',
    fontes: [],
  },
};

const RACAS = {
  cao: {
    'jack-russell': {
      nome: 'Jack Russell Terrier', apelidos: ['jack russell', 'jack russel', 'jack', 'jrt', 'parson russell'],
      itens: ['luxacao-patelar', 'luxacao-cristalino', 'perthes', 'surdez-congenita', 'ataxia-jrt', 'atopia', 'periodontal-cao'],
    },
    'fox-paulistinha': {
      nome: 'Fox Paulistinha (Terrier Brasileiro)', apelidos: ['fox paulistinha', 'paulistinha', 'terrier brasileiro', 'fox brasileiro'],
      nota: 'Não há estudos de saúde publicados específicos para o Fox Paulistinha. A lista reúne problemas comuns em terriers e cães de porte pequeno.',
      itens: ['luxacao-patelar', 'perthes', 'periodontal-cao', 'atopia', 'valvar-mitral'],
    },
    yorkshire: {
      nome: 'Yorkshire Terrier', apelidos: ['yorkshire', 'yorkshire terrier', 'yorkie', 'york'],
      nota: 'Raça de vida longa (média de 13 a 14 anos). A doença dos dentes é o problema mais comum na raça.',
      itens: ['periodontal-cao', 'dentes-leite', 'luxacao-patelar', 'colapso-traqueia', 'shunt', 'hipoglicemia', 'perthes', 'valvar-mitral'],
    },
    srd: { nome: 'Sem raça definida (SRD)', apelidos: ['srd', 'sem raca', 'vira lata', 'viralata', 'mestico', 'misturado'], itens: [] },
  },
  gato: {
    srd: {
      nome: 'Sem raça definida (SRD)', apelidos: ['srd', 'sem raca', 'vira lata', 'viralata', 'mestico', 'comum', 'europeu'],
      nota: 'O gato mais comum no Brasil. Valem os cuidados gerais abaixo.', itens: [],
    },
    persa: {
      nome: 'Persa', apelidos: ['persa', 'persian'],
      itens: ['pkd', 'braquicefalica', 'olhos-persa', 'dermatofitose', 'bolas-pelo'],
    },
    siames: {
      nome: 'Siamês', apelidos: ['siames', 'siamese', 'siamesa'],
      itens: ['asma', 'amiloidose', 'pra-siames'],
    },
    'maine-coon': {
      nome: 'Maine Coon', apelidos: ['maine coon', 'maine'],
      itens: ['cmh', 'displasia-quadril', 'ame-maine', 'bolas-pelo'],
    },
    angora: {
      nome: 'Angorá', apelidos: ['angora', 'angora turco', 'turkish angora'],
      nota: 'No Brasil, "angorá" muitas vezes é um gato de pelo longo sem raça definida; nesse caso valem os cuidados gerais e as bolas de pelo.',
      itens: ['surdez-branco', 'bolas-pelo'],
    },
  },
};
const GERAIS = {
  cao: { titulo: 'Para todos os cães no Brasil', itens: ['carrapato', 'leishmaniose', 'dirofilariose', 'periodontal-cao', 'obesidade-cao'] },
  gato: { titulo: 'Para todos os gatos no Brasil', itens: ['drc', 'dtuif', 'dentes-gato', 'obesidade-gato', 'fiv-felv', 'esporotricose', 'hipertireoidismo'] },
};

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Reconhece a raça pelo texto cadastrado (apelido mais longo vence: "fox paulistinha" antes de "fox")
function racaReconhecida(p) {
  const txt = ' ' + normalizar(p.raca) + ' ';
  if (!txt.trim()) return null;
  let melhor = null, tam = 0;
  for (const [chave, r] of Object.entries(RACAS[p.especie])) {
    for (const a of r.apelidos) {
      if (txt.includes(' ' + a + ' ') && a.length > tam) { melhor = chave; tam = a.length; }
    }
  }
  return melhor;
}
function racaDoGuia(p) {
  if (p.racaGuia && RACAS[p.especie][p.racaGuia]) return p.racaGuia;
  return racaReconhecida(p);
}

function checagemDe(chave) {
  return estado.checagens.find((c) => c.petId === estado.petAtual && c.chave === chave) || null;
}

function itemCuidado(chave, origem = null, motivos = []) {
  const c = CUIDADOS[chave];
  const ch = checagemDe(chave);
  return `
    <li class="cuidado">
      <div class="cuidado-nome">${c.nome}</div>
      ${motivos.length || origem ? `<ul class="motivos">${origem ? `<li>risco para ${origem}</li>` : ''}${motivos.map((m) => `<li>${m}</li>`).join('')}</ul>` : ''}
      <div class="cuidado-rot">Primeiros sinais</div>
      <ul class="sinais">${c.sinais.map((x) => `<li>${x}</li>`).join('')}</ul>
      ${c.urgente ? `<p class="urgente"><span aria-hidden="true">🚨</span> ${c.urgente}</p>` : ''}
      <div class="cuidado-rot">🛡️ Prevenção</div>
      <p class="cuidado-txt">${c.prevenir}</p>
      <div class="cuidado-rot">🩹 Até chegar ao veterinário</div>
      <p class="cuidado-txt">${c.inicial}</p>
      <p class="cuidado-quando"><strong>Quando:</strong> ${c.quando}</p>
      ${c.fontes.length ? `<p class="fontes">Fonte: ${c.fontes.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join(' · ')}</p>` : ''}
      <div class="cuidado-rodape">
        <span class="selo ${ch ? 'ok' : 'neutro'}">${ch ? `✓ Checado em ${fmtData(ch.data)} (${textoHaDias(ch.data)})` : 'Ainda não checado'}</span>
        <div class="acoes">
          <button type="button" class="btn pequeno" data-checar="${chave}">${ch ? 'Checado de novo hoje' : 'Checado hoje'}</button>
          ${ch ? `<button type="button" class="btn pequeno" data-desfazer-checagem="${chave}">Desmarcar</button>` : ''}
          <button type="button" class="btn pequeno" data-diagnostico="${chave}">Registrar diagnóstico</button>
        </div>
      </div>
    </li>`;
}

const fmtMeses = (m) => (m < 12 ? plural(m, 'mês', 'meses') : plural(Math.round(m / 12), 'ano', 'anos'));

// Pontua cada cuidado para este pet: raça + faixa de idade + ECC
function avaliarCuidado(chave, daRaca, meses, ecc) {
  const c = CUIDADOS[chave];
  let pontos = daRaca ? 3 : 1;
  const motivos = [daRaca ? 'predisposição da raça' : null];
  if (meses === null) {
    pontos += daRaca ? 1 : 2; // sem idade não dá para descartar: tudo fica em "fique de olho"
  } else {
    const [min, max] = c.idade;
    if (meses >= min && meses <= max) {
      pontos += 2;
      if (c.comumNaIdade) { pontos += 2; motivos.push('muito comum nessa idade'); } else motivos.push('idade de risco');
    }
    else if (meses < min) {
      if (min - meses <= 12) motivos.push(`risco começa por volta de ${fmtMeses(min)}`);
      else { pontos -= 2; motivos.push(`mais comum a partir de ${fmtMeses(min)}`); }
    } else { pontos -= 3; motivos.push('já passou da idade em que costuma aparecer'); }
  }
  if (ecc !== null) {
    if (c.obesidade && ecc >= 6) { pontos += 3; motivos.push(`ECC ${ecc}: já está acima do peso`); }
    else if (c.obesidade && ecc <= 5) { pontos -= 1; motivos.push(`ECC ${ecc}: peso em ordem`); }
    else if (c.peso && ecc >= 6) { pontos += 2; motivos.push(`ECC ${ecc}: excesso de peso aumenta o risco`); }
  }
  return { chave, daRaca, pontos, motivos: motivos.filter(Boolean) };
}

function renderRaca() {
  const p = petAtual();
  const chave = racaDoGuia(p);
  const raca = chave ? RACAS[p.especie][chave] : null;
  const sel = $('#raca-guia');
  sel.innerHTML = `<option value="">${racaReconhecida(p) ? 'Pela raça cadastrada' : 'Escolha a raça'}</option>` +
    Object.entries(RACAS[p.especie]).map(([k, r]) => `<option value="${k}">${r.nome}</option>`).join('');
  sel.value = p.racaGuia && RACAS[p.especie][p.racaGuia] ? p.racaGuia : '';

  const meses = idadeEmMeses(p.nascimento);
  const aval = ultimaAvaliacao();
  const ecc = aval ? aval.escore : null;

  // Perfil usado na personalização
  const perfil = [
    raca ? raca.nome : (p.raca ? `${esc(p.raca)} (sem guia)` : 'raça não informada'),
    meses !== null ? (p.nascAprox ? '≈ ' : '') + idadeTexto(p.nascimento) : 'idade não informada',
    ecc !== null ? `ECC ${ecc}/9 (${ECC_DESC[ecc][0].toLowerCase()})` : 'sem avaliação de ECC',
  ];
  const faltando = [];
  if (meses === null) faltando.push('<button type="button" class="link" data-informar-idade-raca>informe a idade</button>');
  if (ecc === null) faltando.push('<button type="button" class="link" data-ir-ecc>faça a avaliação de ECC</button>');

  $('#raca-cabecalho').innerHTML = `
    <h2>Riscos para ${esc(p.nome)}</h2>
    <p class="intro">Ordenado pelo que é mais provável agora, cruzando raça, idade e peso.</p>
    <ul class="perfil">${perfil.map((t) => `<li>${t}</li>`).join('')}</ul>
    ${faltando.length ? `<p class="dica-campo">Para personalizar melhor, ${faltando.join(' e ')}.</p>` : ''}
    ${!raca ? `<p class="dica-campo">${p.raca ? `Ainda não há guia para "${esc(p.raca)}".` : 'Raça não informada.'} Escolha abaixo ou veja só os riscos gerais.</p>` : ''}
    ${raca && raca.nota ? `<p class="nota-raca">${raca.nota}</p>` : ''}`;

  const itensRaca = raca ? raca.itens : [];
  const todos = [
    ...itensRaca.map((k) => avaliarCuidado(k, true, meses, ecc)),
    ...GERAIS[p.especie].itens.filter((k) => !itensRaca.includes(k)).map((k) => avaliarCuidado(k, false, meses, ecc)),
  ].sort((a, b) => b.pontos - a.pontos || (b.daRaca - a.daRaca));

  const grupos = [
    ['agora', 'Mais provável agora', (x) => x.pontos >= 5],
    ['olho', 'Fique de olho', (x) => x.pontos >= 3 && x.pontos < 5],
  ];
  const origem = p.especie === 'gato' ? 'todos os gatos' : 'todos os cães';
  const improvaveis = todos.filter((x) => x.pontos < 3);
  $('#grupos-cuidados').innerHTML = grupos.map(([id, titulo, filtro]) => {
    const itens = todos.filter(filtro);
    if (!itens.length) return '';
    return `
      <section class="grupo-risco risco-${id}">
        <h3>${titulo} <span class="qtd">${itens.length}</span></h3>
        <ul class="lista-cuidados">${itens.map((x) => itemCuidado(x.chave, x.daRaca ? null : origem, x.motivos)).join('')}</ul>
      </section>`;
  }).join('') + (improvaveis.length ? `
      <p class="improvaveis"><strong>Fora da lista por serem improváveis agora:</strong>
        ${improvaveis.map((x) => `${CUIDADOS[x.chave].nome} <span>(${x.motivos.filter((m) => m !== 'predisposição da raça').join('; ') || 'baixo risco'})</span>`).join(' · ')}.
        Elas voltam para a lista sozinhas se a idade ou o peso mudarem.</p>` : '');
}

$('#raca-guia').addEventListener('change', (ev) => {
  const p = petAtual();
  p.racaGuia = ev.target.value || '';
  salvar();
  renderRaca();
});

$('#saude-raca').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-informar-idade-raca]')) { abrirPainelPets(); editarPet(estado.petAtual); $('#pet-nasc').focus(); }
  if (ev.target.closest('[data-ir-ecc]')) { mostrarAba('ecc'); window.scrollTo({ top: 0 }); }
  let b;
  if ((b = ev.target.closest('[data-checar]'))) {
    const chave = b.dataset.checar;
    const ch = checagemDe(chave);
    if (ch) ch.data = hojeISO();
    else estado.checagens.push({ id: novoId(), petId: estado.petAtual, chave, data: hojeISO() });
    salvar();
    renderRaca();
  }
  if ((b = ev.target.closest('[data-desfazer-checagem]'))) {
    const chave = b.dataset.desfazerChecagem;
    estado.checagens = estado.checagens.filter((c) => !(c.petId === estado.petAtual && c.chave === chave));
    salvar();
    renderRaca();
  }
  if ((b = ev.target.closest('[data-diagnostico]'))) {
    limparFormDoenca();
    mostrarSubaba('clinico');
    $('#doenca-nome').value = CUIDADOS[b.dataset.diagnostico].nome;
    $('#doenca-situacao').value = 'tratamento';
    $('#form-doenca').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#doenca-data').focus({ preventScroll: true });
  }
});

// Sugestões de raça no cadastro do pet, conforme a espécie
function atualizarSugestoesRaca() {
  const esp = $('#pet-especie').value;
  $('#sugestoes-raca').innerHTML = Object.values(RACAS[esp] || {})
    .map((r) => `<option value="${r.nome}"></option>`).join('');
}
$('#pet-especie').addEventListener('change', atualizarSugestoesRaca);

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
    <p class="nota">Estimativa (energia de repouso = 70 × peso<sup>0,75</sup>; fator ${fmtNum(r.fator, 1)}${r.objetivo === 'perder' ? `; emagrecimento: ${entrada.especie === 'gato' ? '0,8' : '1,0'} × repouso no peso ideal` : ''}). Petiscos entram na conta: no máximo 10% das calorias. Confirme o plano com o veterinário${entrada.especie === 'gato' ? '. Gatos nunca devem ficar em jejum nem ter corte brusco de comida (risco de lipidose hepática)' : ''}.</p>
    <p class="fontes">Fontes: <a href="${F.merck[1]}" target="_blank" rel="noopener">fatores de energia (Manual Merck)</a> · <a href="${F.aaha[1]}" target="_blank" rel="noopener">10% de excesso por ponto de ECC (AAHA 2021)</a> · <a href="https://wsava.org/global-guidelines/global-nutrition-guidelines/" target="_blank" rel="noopener">escala de ECC (WSAVA)</a></p>`;
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

/* ---------- Valores em reais ---------- */
// Aceita "189,90", "R$ 1.234,56", "59.9"
function lerValor(txt) {
  let t = String(txt || '').replace(/r\$/i, '').replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
const fmtReais = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mesDe = (iso) => iso.slice(0, 7);
function somarDias(iso, n) { const d = dataLocal(iso); d.setDate(d.getDate() + n); return paraISO(d); }
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtMes = (ym) => `${NOMES_MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
function agoraHM() { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

/* ---------- Fotos (IndexedDB: cabe muito mais que o localStorage) ---------- */
const FotosDB = (() => {
  let conexao = null;
  function abrir() {
    if (!conexao) {
      conexao = new Promise((ok, falha) => {
        try {
          const req = indexedDB.open('diario-pet-fotos', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('fotos');
          req.onsuccess = () => ok(req.result);
          req.onerror = () => falha(req.error);
        } catch (e) { falha(e); }
      });
    }
    return conexao;
  }
  async function operar(modo, fn) {
    const db = await abrir();
    return new Promise((ok, falha) => {
      const tx = db.transaction('fotos', modo);
      const req = fn(tx.objectStore('fotos'));
      tx.oncomplete = () => ok(req ? req.result : undefined);
      tx.onerror = () => falha(tx.error);
    });
  }
  return {
    salvar: (id, url) => operar('readwrite', (st) => st.put(url, id)),
    ler: (id) => operar('readonly', (st) => st.get(id)),
    apagar: (id) => operar('readwrite', (st) => st.delete(id)).catch(() => {}),
  };
})();
const cacheFotos = new Map();

// Reduz a foto antes de guardar (celulares tiram fotos de vários MB)
function comprimirImagem(arquivo, max = 1024, qualidade = 0.78, quadrado = false) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
      if (quadrado) { const lado = Math.min(w, h); sx = (w - lado) / 2; sy = (h - lado) / 2; sw = sh = w = h = lado; }
      const f = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * f); c.height = Math.round(h * f);
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('imagem inválida')); };
    img.src = url;
  });
}

// Preenche <img data-foto="id"> depois de desenhar a lista
function carregarFotos(raiz) {
  raiz.querySelectorAll('img[data-foto]').forEach((img) => {
    const id = img.dataset.foto;
    if (cacheFotos.has(id)) { img.src = cacheFotos.get(id); return; }
    FotosDB.ler(id).then((url) => { if (url) { cacheFotos.set(id, url); img.src = url; } }).catch(() => {});
  });
}
const miniatura = (fotoId) => (fotoId ? `<button type="button" class="foto-mini" data-ver-foto="${fotoId}" aria-label="Ver foto"><img data-foto="${fotoId}" alt=""></button>` : '');

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-ver-foto]');
  if (b) {
    const img = b.querySelector('img');
    if (img && img.src) { $('#visor-foto img').src = img.src; $('#visor-foto').hidden = false; }
  }
});
$('#visor-foto').addEventListener('click', () => { $('#visor-foto').hidden = true; });

async function guardarFotoDoCampo(campo, idFoto, max = 1024) {
  const arquivo = campo.files && campo.files[0];
  if (!arquivo) return null;
  const url = await comprimirImagem(arquivo, max);
  await FotosDB.salvar(idFoto, url);
  cacheFotos.set(idFoto, url);
  return idFoto;
}

/* ---------- Avatar do pet: foto ou ícone de raça ---------- */
const PALAVRAS_ICONE = [
  ['caramelo', 'cao-caramelo'], ['yorkshire', 'cao-yorkshire'], ['york', 'cao-yorkshire'], ['shih', 'cao-shih-tzu'],
  ['poodle', 'cao-poodle'], ['labrador', 'cao-labrador'], ['golden', 'cao-golden'], ['pinscher', 'cao-pinscher'],
  ['dachshund', 'cao-dachshund'], ['salsicha', 'cao-dachshund'], ['teckel', 'cao-dachshund'], ['bulldog', 'cao-bulldog-frances'],
  ['buldogue', 'cao-bulldog-frances'], ['pug', 'cao-pug'], ['spitz', 'cao-spitz'], ['lulu', 'cao-spitz'], ['beagle', 'cao-beagle'],
  ['border', 'cao-border-collie'], ['husky', 'cao-husky'], ['jack', 'cao-jack-russell'], ['paulistinha', 'cao-fox-paulistinha'],
  ['terrier brasileiro', 'cao-fox-paulistinha'], ['preto', 'cao-srd-preto'],
  ['siames', 'gato-siames'], ['persa', 'gato-persa'], ['maine', 'gato-maine-coon'], ['angora', 'gato-angora'], ['frajola', 'gato-frajola'],
  ['escaminha', 'gato-escaminha'], ['preto', 'gato-preto'], ['branco', 'gato-branco'], ['laranja', 'gato-laranja'], ['cinza', 'gato-cinza'],
];
function iconePadrao(p) {
  const txt = normalizar(p.raca);
  for (const [palavra, id] of PALAVRAS_ICONE) if (txt.includes(palavra) && ICONES[id].especie === p.especie) return id;
  return p.especie === 'gato' ? 'gato-laranja' : 'cao-caramelo';
}
function avatarHTML(p, tam = 48) {
  if (p.foto) return `<img class="foto-pet" src="${p.foto}" alt="" width="${tam}" height="${tam}">`;
  const id = p.icone && ICONES[p.icone]?.especie === p.especie ? p.icone : iconePadrao(p);
  return svgIcone(id, tam);
}

let fotoForm = '';
let iconeForm = '';
function atualizarPreviaAvatar() {
  const especie = $('#pet-especie').value;
  if (iconeForm && ICONES[iconeForm]?.especie !== especie) iconeForm = '';
  const previa = { especie, raca: $('#pet-raca').value, foto: fotoForm, icone: iconeForm };
  $('#pet-avatar-previa').innerHTML = avatarHTML(previa, 72);
  $('#btn-remover-foto').hidden = !fotoForm;
  const escolhido = fotoForm ? null : (iconeForm || iconePadrao(previa));
  $('#galeria-icones').innerHTML = Object.entries(ICONES).filter(([, o]) => o.especie === especie).map(([id, o]) => `
    <button type="button" class="opcao-icone" role="radio" aria-checked="${id === escolhido}" data-icone="${id}" title="${o.nome}">
      ${svgIcone(id, 44)}<span>${o.nome}</span>
    </button>`).join('');
}
$('#galeria-icones').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-icone]');
  if (!b) return;
  iconeForm = b.dataset.icone;
  fotoForm = '';
  atualizarPreviaAvatar();
});
$('#pet-foto').addEventListener('change', async (ev) => {
  const arquivo = ev.target.files[0];
  if (!arquivo) return;
  try {
    fotoForm = await comprimirImagem(arquivo, 256, 0.82, true);
    atualizarPreviaAvatar();
  } catch (e) {
    $('#pet-erro').textContent = 'Não foi possível abrir essa imagem. Tente outra foto.';
    $('#pet-erro').hidden = false;
  }
  ev.target.value = '';
});
$('#btn-remover-foto').addEventListener('click', () => { fotoForm = ''; atualizarPreviaAvatar(); });
$('#pet-especie').addEventListener('change', atualizarPreviaAvatar);
$('#pet-raca').addEventListener('input', atualizarPreviaAvatar);

/* ---------- Agenda: eventos genéricos (.ics e Google Agenda) ---------- */
const escICS = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function dobrarICS(linha) {
  const partes = [];
  let atual = '';
  for (const ch of linha) {
    if (new TextEncoder().encode(atual + ch).length > 73) { partes.push(atual); atual = ' '; }
    atual += ch;
  }
  partes.push(atual);
  return partes.join('\r\n');
}
const compacto = (iso) => iso.replace(/-/g, '');
function inicioFimHora(ev) {
  const [h, m] = ev.hora.split(':').map(Number);
  const fim = dataLocal(ev.data);
  fim.setHours(h, m + (ev.duracaoMin || 10));
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
  return [`${compacto(ev.data)}T${ev.hora.replace(':', '')}00`, `${compacto(paraISO(fim))}T${hm(fim)}`];
}
// ev: { uid, titulo, detalhes, data, hora?, rrule?, alarmes? }
function veventICS(ev) {
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const l = ['BEGIN:VEVENT', `UID:${ev.uid}@diario-do-pet`, `DTSTAMP:${agora}`];
  if (ev.hora) { const [ini, fim] = inicioFimHora(ev); l.push(`DTSTART:${ini}`, `DTEND:${fim}`); }
  else l.push(`DTSTART;VALUE=DATE:${compacto(ev.data)}`, `DTEND;VALUE=DATE:${compacto(somarDias(ev.data, 1))}`);
  if (ev.rrule) l.push(`RRULE:${ev.rrule}`);
  l.push(`SUMMARY:${escICS(ev.titulo)}`, `DESCRIPTION:${escICS(ev.detalhes)}`);
  for (const t of ev.alarmes || []) l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escICS(ev.titulo)}`, `TRIGGER:${t}`, 'END:VALARM');
  l.push('END:VEVENT');
  return l;
}
function arquivoICS(eventos) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Diario do Pet//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...eventos.flatMap(veventICS), 'END:VCALENDAR', ''].map(dobrarICS).join('\r\n');
}
function linkGoogle(ev) {
  const dates = ev.hora ? inicioFimHora(ev).join('/') : `${compacto(ev.data)}/${compacto(somarDias(ev.data, 1))}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.titulo, dates, details: ev.detalhes });
  if (ev.rrule) q.set('recur', 'RRULE:' + ev.rrule);
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
const nomeArquivo = (...partes) => partes.join('-').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function baixarTexto(nome, texto, tipo = 'text/calendar;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
// Botões: no claude.ai só o Google Agenda funciona; como site, também o .ics
const EVENTOS = new Map();
function botoesEvento(chave, eventos, rotuloGoogle = (ev) => '📅 Google Agenda') {
  EVENTOS.set(chave, eventos);
  const google = eventos.map((ev) => `<a class="btn pequeno" href="${esc(linkGoogle(ev))}" target="_blank" rel="noopener">${rotuloGoogle(ev)}</a>`).join('');
  return (EMBUTIDO ? '' : `<button type="button" class="btn pequeno" data-agenda-evento="${chave}">📅 Agenda do celular</button>`) + google;
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-agenda-evento]');
  if (!b) return;
  const evs = EVENTOS.get(b.dataset.agendaEvento);
  if (evs) baixarTexto(nomeArquivo('lembrete', evs[0].titulo) + '.ics', arquivoICS(evs));
});
const nomePet = (petId) => estado.pets.find((p) => p.id === petId)?.nome || 'Pet';

/* ---------- Remédios: estoque e lembretes ---------- */
function estoqueRemedio(r) {
  if (!(r.estoque > 0) || !(r.dosesDia > 0)) return null;
  const base = r.estoqueData && r.estoqueData > r.inicio ? r.estoqueData : r.inicio;
  const diasUso = Math.max(0, diasEntre(base, hojeISO()));
  const restante = Math.max(0, Math.round((r.estoque - r.dosesDia * diasUso) * 10) / 10);
  const diasRestantes = Math.floor(restante / r.dosesDia);
  return { restante, diasRestantes, acaba: somarDias(hojeISO(), diasRestantes) };
}
function eventosRemedio(r) {
  const ate = r.fim ? `;UNTIL=${compacto(r.fim)}T235959` : '';
  const inicio = r.inicio > hojeISO() ? r.inicio : hojeISO();
  return (r.horas || []).map((hora) => ({
    uid: `rem-${r.id}-${hora.replace(':', '')}`,
    titulo: `💊 ${nomePet(r.petId)}: ${r.nome}${r.dose ? ` (${r.dose})` : ''}`,
    detalhes: `Dar ${r.nome}${r.dose ? ', ' + r.dose : ''}${r.horarios ? '. ' + r.horarios : ''}.\nRegistrado no Diário do Pet.`,
    data: inicio, hora, rrule: 'FREQ=DAILY' + ate, alarmes: ['PT0M'],
  }));
}

/* ---------- Estoque de ração ---------- */
function estoqueRacao(p) {
  const s = p.saco;
  if (!s || !(s.kg > 0)) return null;
  const r = racaoDoPet(p.id);
  const consumo = r && r.refeicoes.length ? totalDia(r.refeicoes) : 0;
  const total = s.kg * 1000;
  const restanteG = Math.max(0, total - consumo * Math.max(0, diasEntre(s.abertura, hojeISO())));
  const diasRestantes = consumo ? Math.floor(restanteG / consumo) : null;
  return {
    consumo, restanteG, diasRestantes, pct: restanteG / total,
    acaba: diasRestantes !== null ? somarDias(hojeISO(), diasRestantes) : null,
    duracao: consumo ? Math.floor(total / consumo) : null,
    custoDia: s.preco && consumo ? s.preco / (total / consumo) : null,
  };
}

function preencherFormSaco() {
  const p = petAtual();
  if (!p) return;
  const s = p.saco;
  $('#saco-kg').value = s ? String(s.kg).replace('.', ',') : '';
  $('#saco-abertura').value = s ? s.abertura : hojeISO();
  $('#saco-abertura').max = hojeISO();
  $('#saco-preco').value = s && s.preco ? String(s.preco.toFixed(2)).replace('.', ',') : '';
  $('#saco-erro').hidden = true;
  $('#btn-salvar-saco').textContent = s ? 'Salvar alterações do saco' : 'Salvar saco';
}

function salvarSaco(p, kg, abertura, preco, novo) {
  const id = novo || !p.saco?.id ? novoId() : p.saco.id;
  p.saco = { id, kg, abertura, preco: preco || null };
  sincronizarGasto({ tipo: 'saco', id }, p.id, preco ? { data: abertura, valor: preco, categoria: 'racao', descricao: `Saco de ração ${fmtNum(kg, kg % 1 ? 1 : 0)} kg` } : null);
}

$('#form-saco').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const p = petAtual();
  const erro = $('#saco-erro');
  const kg = lerNumero($('#saco-kg').value);
  const abertura = $('#saco-abertura').value;
  const precoTxt = $('#saco-preco').value.trim();
  const preco = precoTxt ? lerValor(precoTxt) : null;
  let msg = '';
  if (!(kg >= 0.1 && kg <= 50)) msg = 'Informe o tamanho do saco em kg (ex.: 10,1).';
  else if (!abertura) msg = 'Informe quando o saco foi aberto.';
  else if (abertura > hojeISO()) msg = 'A data de abertura não pode estar no futuro.';
  else if (precoTxt && !(preco > 0)) msg = 'Preço inválido (ex.: 189,90).';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  salvarSaco(p, kg, abertura, preco, false);
  salvar();
  preencherFormSaco();
  renderTudo();
});

$('#saco-resumo').addEventListener('click', (ev) => {
  const b = ev.target.closest('#btn-saco-novo');
  if (!b || !pedeConfirmacao(b, 'Abri hoje um saco igual?')) return;
  const p = petAtual();
  salvarSaco(p, p.saco.kg, hojeISO(), p.saco.preco, true);
  salvar();
  preencherFormSaco();
  renderTudo();
});

function renderSaco() {
  const p = petAtual();
  const el = $('#saco-resumo');
  const e = estoqueRacao(p);
  if (!e) { el.innerHTML = '<p class="vazio-texto">Informe o saco de ração aberto para saber quando vai acabar.</p>'; return; }
  const s = p.saco;
  let linha;
  if (!e.consumo) linha = 'Configure os horários do alimentador abaixo para calcular quando a ração acaba.';
  else if (e.diasRestantes <= 0) linha = '<strong>A ração deste saco já deve ter acabado.</strong> Abriu outro? Toque em "Abri um saco novo".';
  else linha = `Restam cerca de <strong>${fmtNum(e.restanteG / 1000, 1)} kg</strong>: acaba por volta de <strong>${fmtData(e.acaba)}</strong> (${plural(e.diasRestantes, 'dia', 'dias')}).`;
  const nivel = e.diasRestantes !== null && e.diasRestantes <= 5 ? 'baixo' : 'ok';
  el.innerHTML = `
    <div class="barra-estoque ${nivel}" role="img" aria-label="Estoque: ${Math.round(e.pct * 100)}%"><span style="width:${Math.max(2, Math.round(e.pct * 100))}%"></span></div>
    <p class="estoque-txt">${linha}</p>
    <p class="nota">Saco de ${fmtNum(s.kg, s.kg % 1 ? 1 : 0)} kg aberto em ${fmtData(s.abertura)}${e.duracao ? ` · dura ~${plural(e.duracao, 'dia', 'dias')}` : ''}${e.custoDia ? ` · ≈ ${fmtReais(e.custoDia)} por dia` : ''}</p>
    <button type="button" class="btn" id="btn-saco-novo">Abri um saco novo hoje</button>`;
}

/* ---------- Gastos ---------- */
const CATEGORIAS = {
  racao: '🥣 Ração', veterinario: '🩺 Veterinário', exames: '🧪 Exames', vacinas: '💉 Vacinas', remedios: '💊 Remédios',
  higiene: '🛁 Banho e tosa', petiscos: '🦴 Petiscos e brinquedos', acessorios: '🎒 Acessórios', outros: '📦 Outros',
};
// Mantém um gasto automático ligado a uma origem (consulta, saco de ração)
function sincronizarGasto(origem, petId, dados) {
  const i = estado.gastos.findIndex((g) => g.origem && g.origem.tipo === origem.tipo && g.origem.id === origem.id);
  if (!dados) { if (i >= 0) estado.gastos.splice(i, 1); return; }
  if (i >= 0) Object.assign(estado.gastos[i], dados);
  else estado.gastos.push({ id: novoId(), petId, origem, criado: Date.now(), ...dados });
}

let escopoGastos = 'pet';
try { escopoGastos = localStorage.getItem('diario-pet-gastos-escopo') === 'todos' ? 'todos' : 'pet'; } catch (e) { /* ignora */ }
document.querySelectorAll('input[name="gastos-escopo"]').forEach((el) => {
  el.checked = el.value === escopoGastos;
  el.addEventListener('change', () => {
    escopoGastos = el.value;
    try { localStorage.setItem('diario-pet-gastos-escopo', escopoGastos); } catch (e) { /* ignora */ }
    renderGastos();
  });
});

function limparFormGasto() {
  $('#form-gasto').reset();
  $('#gasto-id').value = '';
  $('#gasto-data').value = hojeISO();
  $('#gasto-data').max = hojeISO();
  $('#gasto-categoria').innerHTML = Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#form-gasto-titulo').textContent = 'Adicionar gasto';
  $('#btn-salvar-gasto').textContent = 'Adicionar';
  $('#btn-cancelar-gasto').hidden = true;
  $('#gasto-erro').hidden = true;
}
$('#btn-cancelar-gasto').addEventListener('click', limparFormGasto);

$('#form-gasto').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const erro = $('#gasto-erro');
  const data = $('#gasto-data').value;
  const valor = lerValor($('#gasto-valor').value);
  const categoria = $('#gasto-categoria').value;
  const descricao = $('#gasto-descricao').value.trim();
  let msg = '';
  if (!data) msg = 'Informe a data.';
  else if (data > hojeISO()) msg = 'A data não pode estar no futuro.';
  else if (!(valor > 0)) msg = 'Informe o valor (ex.: 59,90).';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const id = $('#gasto-id').value;
  const existente = id && estado.gastos.find((g) => g.id === id);
  if (existente) Object.assign(existente, { data, valor, categoria, descricao });
  else estado.gastos.push({ id: novoId(), petId: estado.petAtual, data, valor, categoria, descricao, criado: Date.now() });
  salvar();
  limparFormGasto();
  renderTudo();
});

$('#diario-gastos').addEventListener('click', (ev) => {
  let b;
  if ((b = ev.target.closest('[data-editar-gasto]'))) {
    const g = estado.gastos.find((x) => x.id === b.dataset.editarGasto);
    if (!g) return;
    $('#gasto-id').value = g.id;
    $('#gasto-data').value = g.data;
    $('#gasto-valor').value = g.valor.toFixed(2).replace('.', ',');
    $('#gasto-categoria').value = g.categoria;
    $('#gasto-descricao').value = g.descricao || '';
    $('#form-gasto-titulo').textContent = 'Editar gasto';
    $('#btn-salvar-gasto').textContent = 'Salvar alterações';
    $('#btn-cancelar-gasto').hidden = false;
    $('#form-gasto').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if ((b = ev.target.closest('[data-remover-gasto]')) && pedeConfirmacao(b)) {
    if ($('#gasto-id').value === b.dataset.removerGasto) limparFormGasto();
    estado.gastos = estado.gastos.filter((x) => x.id !== b.dataset.removerGasto);
    salvar();
    renderTudo();
  }
});

function renderGastos() {
  const p = petAtual();
  $('#gastos-escopo-pet').textContent = p.nome;
  const todos = escopoGastos === 'todos';
  const regs = estado.gastos.filter((g) => todos || g.petId === p.id)
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado - a.criado);
  const mesAtual = mesDe(hojeISO());
  const meses = [];
  for (let i = 5; i >= 0; i--) { const d = dataLocal(hojeISO()); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(mesDe(paraISO(d))); }
  const somaMes = (m) => regs.filter((g) => mesDe(g.data) === m).reduce((s, g) => s + g.valor, 0);
  const totais = meses.map((m) => [m, somaMes(m)]);
  const atual = somaMes(mesAtual), anterior = totais[4][1];
  const media = totais.reduce((s, [, v]) => s + v, 0) / 6;
  const max = Math.max(...totais.map(([, v]) => v), 1);
  const doMes = regs.filter((g) => mesDe(g.data) === mesAtual);
  const porCat = Object.keys(CATEGORIAS).map((k) => [k, doMes.filter((g) => g.categoria === k).reduce((s, g) => s + g.valor, 0)])
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  $('#gastos-resumo').innerHTML = regs.length ? `
    <dl class="fatos fatos-3">
      <div><dt>Este mês</dt><dd>${fmtReais(atual)}</dd></div>
      <div><dt>Mês passado</dt><dd>${fmtReais(anterior)}</dd></div>
      <div><dt>Média 6 meses</dt><dd>${fmtReais(media)}</dd></div>
    </dl>
    <h3>Últimos 6 meses</h3>
    <ul class="barras">${totais.map(([m, v]) => `
      <li class="${m === mesAtual ? 'atual' : ''}"><span class="rot">${fmtMes(m)}</span>
        <span class="trilho"><span class="barra" style="width:${v ? Math.max(2, (v / max) * 100) : 0}%"></span></span>
        <span class="val">${fmtReais(v)}</span></li>`).join('')}</ul>
    ${porCat.length ? `<h3>Este mês por categoria</h3>
    <ul class="barras categorias">${porCat.map(([k, v]) => `
      <li><span class="rot">${CATEGORIAS[k]}</span>
        <span class="trilho"><span class="barra" style="width:${Math.max(2, (v / porCat[0][1]) * 100)}%"></span></span>
        <span class="val">${fmtReais(v)}</span></li>`).join('')}</ul>` : ''}`
    : '<p class="vazio-texto">Nenhum gasto ainda. Adicione abaixo; consultas com valor e sacos de ração com preço entram sozinhos.</p>';

  const item = (g) => {
    const auto = g.origem ? (g.origem.tipo === 'consulta' ? 'veio de Consultas' : 'veio do estoque de ração') : '';
    return `
      <li>
        <div class="info">
          <div class="principal">${fmtReais(g.valor)} <span class="delta">${CATEGORIAS[g.categoria] || g.categoria}</span></div>
          <div class="secundario">${fmtData(g.data)}${g.descricao ? ' · ' + esc(g.descricao) : ''}${todos ? ' · ' + esc(nomePet(g.petId)) : ''}${auto ? ` · <em>${auto}</em>` : ''}</div>
        </div>
        ${auto ? '' : `<button type="button" class="btn pequeno" data-editar-gasto="${g.id}">Editar</button>
        <button type="button" class="btn pequeno perigo" data-remover-gasto="${g.id}">Excluir</button>`}
      </li>`;
  };
  const antigos = regs.filter((g) => mesDe(g.data) !== mesAtual);
  $('#lista-gastos').innerHTML = doMes.length ? doMes.map(item).join('') : '<li class="vazio">Nenhum gasto neste mês.</li>';
  $('#det-gastos-antigos').hidden = !antigos.length;
  $('#lista-gastos-antigos').innerHTML = antigos.map(item).join('');
}

/* ---------- Sintomas ---------- */
const SINTOMAS = {
  vomito: { nome: 'Vômito', emoji: '🤮' },
  diarreia: { nome: 'Diarreia', emoji: '💩' },
  coceira: { nome: 'Coceira', emoji: '🐾' },
  tosse: { nome: 'Tosse', emoji: '😮‍💨' },
  espirro: { nome: 'Espirros', emoji: '🤧' },
  apetite: { nome: 'Sem apetite', emoji: '🍽️' },
  apatia: { nome: 'Apatia / cansaço', emoji: '😴' },
  mancando: { nome: 'Mancando', emoji: '🦵' },
  olho: { nome: 'Olho vermelho ou com secreção', emoji: '👁️' },
  xixi: { nome: 'Xixi alterado', emoji: '🚽', urgente: 'Gato macho que tenta urinar e não sai nada é emergência: vá ao veterinário agora.' },
  sangue: { nome: 'Sangue nas fezes, urina ou vômito', emoji: '🩸', urgente: 'Sangue no vômito, nas fezes ou na urina: procure o veterinário hoje.' },
  convulsao: { nome: 'Convulsão', emoji: '⚡', urgente: 'Durante a crise, afaste objetos e não coloque a mão na boca dele. Cronometre. Mais de 5 minutos ou crises seguidas: emergência.' },
  respiracao: { nome: 'Dificuldade para respirar', emoji: '🫁', urgente: 'Respiração difícil, gato respirando de boca aberta ou gengiva azulada: emergência.' },
  outro: { nome: 'Outro', emoji: '📝' },
};
const INTENSIDADES = { leve: 'leve', moderada: 'moderada', forte: 'forte' };

function sintomasDoPet(petId = estado.petAtual) {
  return estado.sintomas.filter((s) => s.petId === petId)
    .sort((a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || '')) || b.criado - a.criado);
}
function atualizarAlertaSintoma() {
  const t = SINTOMAS[$('#sintoma-tipo').value];
  $('#sintoma-alerta').hidden = !t?.urgente;
  $('#sintoma-alerta').textContent = t?.urgente ? '🚨 ' + t.urgente : '';
}
function limparFormSintoma() {
  $('#form-sintoma').reset();
  $('#sintoma-id').value = '';
  $('#sintoma-tipo').innerHTML = Object.entries(SINTOMAS).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.nome}</option>`).join('');
  $('#sintoma-data').value = hojeISO();
  $('#sintoma-data').max = hojeISO();
  $('#sintoma-hora').value = agoraHM();
  $('#sintoma-foto-nome').textContent = '';
  $('#form-sintoma-titulo').textContent = 'Registrar sintoma';
  $('#btn-salvar-sintoma').textContent = 'Registrar';
  $('#btn-cancelar-sintoma').hidden = true;
  $('#sintoma-erro').hidden = true;
  atualizarAlertaSintoma();
}
$('#sintoma-tipo').addEventListener('change', atualizarAlertaSintoma);
$('#btn-cancelar-sintoma').addEventListener('click', limparFormSintoma);
for (const campo of ['sintoma', 'consulta']) {
  $(`#${campo}-foto`).addEventListener('change', (ev) => {
    $(`#${campo}-foto-nome`).textContent = ev.target.files[0] ? '✓ foto escolhida' : '';
  });
}

$('#form-sintoma').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('#sintoma-erro');
  const tipo = $('#sintoma-tipo').value;
  const data = $('#sintoma-data').value;
  const hora = $('#sintoma-hora').value || '';
  const intensidade = document.querySelector('input[name="sintoma-intensidade"]:checked').value;
  const obs = $('#sintoma-obs').value.trim();
  let msg = '';
  if (!SINTOMAS[tipo]) msg = 'Escolha o sintoma.';
  else if (!data) msg = 'Informe a data.';
  else if (data > hojeISO()) msg = 'A data não pode estar no futuro.';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const btn = $('#btn-salvar-sintoma');
  btn.disabled = true;
  try {
    const id = $('#sintoma-id').value;
    const existente = id && estado.sintomas.find((s) => s.id === id);
    const novoIdSintoma = existente ? existente.id : novoId();
    let fotoId = existente?.fotoId || '';
    try {
      const f = await guardarFotoDoCampo($('#sintoma-foto'), 'sin-' + novoIdSintoma + '-' + Date.now());
      if (f) { if (fotoId) FotosDB.apagar(fotoId); fotoId = f; }
    } catch (e) {
      erro.textContent = 'Não foi possível guardar a foto neste navegador. O sintoma foi salvo sem foto.';
      erro.hidden = false;
    }
    const dados = { tipo, data, hora, intensidade, obs, fotoId };
    if (existente) Object.assign(existente, dados);
    else estado.sintomas.push({ id: novoIdSintoma, petId: estado.petAtual, ...dados, criado: Date.now() });
    salvar();
    const erroVisivel = !erro.hidden;
    limparFormSintoma();
    if (erroVisivel) erro.hidden = false;
    renderTudo();
  } finally { btn.disabled = false; }
});

$('#diario-sintomas').addEventListener('click', (ev) => {
  let b;
  if ((b = ev.target.closest('[data-editar-sintoma]'))) {
    const s = estado.sintomas.find((x) => x.id === b.dataset.editarSintoma);
    if (!s) return;
    $('#sintoma-id').value = s.id;
    $('#sintoma-tipo').value = s.tipo;
    $('#sintoma-data').value = s.data;
    $('#sintoma-hora').value = s.hora || '';
    document.querySelector(`input[name="sintoma-intensidade"][value="${s.intensidade}"]`).checked = true;
    $('#sintoma-obs').value = s.obs || '';
    $('#sintoma-foto-nome').textContent = s.fotoId ? 'já tem foto (escolha outra para trocar)' : '';
    $('#form-sintoma-titulo').textContent = 'Editar sintoma';
    $('#btn-salvar-sintoma').textContent = 'Salvar alterações';
    $('#btn-cancelar-sintoma').hidden = false;
    atualizarAlertaSintoma();
    $('#form-sintoma').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if ((b = ev.target.closest('[data-remover-sintoma]')) && pedeConfirmacao(b)) {
    const s = estado.sintomas.find((x) => x.id === b.dataset.removerSintoma);
    if ($('#sintoma-id').value === s?.id) limparFormSintoma();
    if (s?.fotoId) FotosDB.apagar(s.fotoId);
    estado.sintomas = estado.sintomas.filter((x) => x.id !== b.dataset.removerSintoma);
    salvar();
    renderTudo();
  }
});

// Sintomas repetidos nos últimos 7 dias
function repeticoesSintomas(petId) {
  const limite = somarDias(hojeISO(), -6);
  const cont = {};
  for (const s of estado.sintomas) if (s.petId === petId && s.data >= limite) cont[s.tipo] = (cont[s.tipo] || 0) + 1;
  return cont;
}

function renderSintomas() {
  const regs = sintomasDoPet();
  const limite30 = somarDias(hojeISO(), -29);
  const recentes = regs.filter((s) => s.data >= limite30);
  const antigos = regs.filter((s) => s.data < limite30);
  const cont = repeticoesSintomas(estado.petAtual);
  const chips = Object.entries(cont).sort((a, b) => b[1] - a[1]);
  $('#sintomas-resumo').innerHTML = chips.length ? `
    <p class="dica-campo">Últimos 7 dias:</p>
    <ul class="motivos chips-sintomas">${chips.map(([k, n]) => `<li class="${n >= 3 ? 'repetido' : ''}">${SINTOMAS[k].emoji} ${SINTOMAS[k].nome} ×${n}</li>`).join('')}</ul>
    ${chips.some(([, n]) => n >= 3) ? '<p class="nota-raca">Sintoma repetido 3 vezes ou mais em uma semana: vale marcar uma consulta. Mostre este diário ao veterinário.</p>' : ''}` : '';
  const item = (s) => {
    const t = SINTOMAS[s.tipo] || SINTOMAS.outro;
    return `
      <li class="item-sintoma">
        <span class="emoji-sintoma" aria-hidden="true">${t.emoji}</span>
        <div class="info">
          <div class="principal">${t.nome} <span class="delta">${INTENSIDADES[s.intensidade] || ''}</span></div>
          <div class="secundario">${fmtData(s.data)}${s.hora ? ' às ' + s.hora : ''}${s.obs ? ' · ' + esc(s.obs) : ''}</div>
          <div class="acoes">
            <button type="button" class="btn pequeno" data-editar-sintoma="${s.id}">Editar</button>
            <button type="button" class="btn pequeno perigo" data-remover-sintoma="${s.id}">Excluir</button>
          </div>
        </div>
        ${miniatura(s.fotoId)}
      </li>`;
  };
  $('#lista-sintomas').innerHTML = recentes.length ? recentes.map(item).join('') : '<li class="vazio">Nenhum sintoma nos últimos 30 dias. 🎉</li>';
  $('#det-sintomas-antigos').hidden = !antigos.length;
  $('#lista-sintomas-antigos').innerHTML = antigos.map(item).join('');
  carregarFotos($('#diario-sintomas'));
}

/* ---------- Consultas e exames ---------- */
const TIPOS_CONSULTA = {
  consulta: { nome: 'Consulta', emoji: '🩺', categoria: 'veterinario' },
  retorno: { nome: 'Retorno', emoji: '🔁', categoria: 'veterinario' },
  exame: { nome: 'Exame', emoji: '🧪', categoria: 'exames' },
  vacinacao: { nome: 'Vacinação', emoji: '💉', categoria: 'vacinas' },
  cirurgia: { nome: 'Cirurgia', emoji: '🏥', categoria: 'veterinario' },
  emergencia: { nome: 'Emergência', emoji: '🚑', categoria: 'veterinario' },
};
function consultasDoPet(petId = estado.petAtual) {
  return estado.consultas.filter((c) => c.petId === petId).sort((a, b) => b.data.localeCompare(a.data) || b.criado - a.criado);
}
// Retorno ainda pendente: nenhuma outra consulta registrada perto ou depois da data marcada
function retornoPendente(c) {
  if (!c.retorno) return false;
  const limite = somarDias(c.retorno, -7);
  return !estado.consultas.some((o) => o.petId === c.petId && o.id !== c.id && o.data > c.data && o.data >= limite);
}
function eventoRetorno(c) {
  return {
    uid: `ret-${c.id}`,
    titulo: `🩺 ${nomePet(c.petId)}: retorno${c.clinica ? ' — ' + c.clinica : ''}`,
    detalhes: `Retorno da consulta de ${fmtData(c.data)}${c.motivo ? ' (' + c.motivo + ')' : ''}.\nRegistrado no Diário do Pet.`,
    data: c.retorno, alarmes: ['-PT15H', 'PT8H'],
  };
}

function limparFormConsulta() {
  $('#form-consulta').reset();
  $('#consulta-id').value = '';
  $('#consulta-data').value = hojeISO();
  $('#consulta-data').max = hojeISO();
  $('#consulta-foto-nome').textContent = '';
  $('#form-consulta-titulo').textContent = 'Registrar consulta ou exame';
  $('#btn-salvar-consulta').textContent = 'Registrar';
  $('#btn-cancelar-consulta').hidden = true;
  $('#consulta-erro').hidden = true;
  const clinicas = [...new Set(estado.consultas.map((c) => c.clinica).filter(Boolean))];
  $('#sugestoes-clinica').innerHTML = clinicas.map((c) => `<option value="${esc(c)}"></option>`).join('');
}
$('#btn-cancelar-consulta').addEventListener('click', limparFormConsulta);

$('#form-consulta').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('#consulta-erro');
  const data = $('#consulta-data').value;
  const tipo = $('#consulta-tipo').value;
  const clinica = $('#consulta-clinica').value.trim();
  const motivo = $('#consulta-motivo').value.trim();
  const resultado = $('#consulta-resultado').value.trim();
  const valorTxt = $('#consulta-valor').value.trim();
  const valor = valorTxt ? lerValor(valorTxt) : null;
  const retorno = $('#consulta-retorno').value || '';
  let msg = '';
  if (!data) msg = 'Informe a data.';
  else if (data > hojeISO()) msg = 'A data não pode estar no futuro. Para marcar uma consulta futura, use "Retorno em".';
  else if (!motivo && !clinica) msg = 'Informe pelo menos o motivo ou a clínica.';
  else if (valorTxt && !(valor >= 0)) msg = 'Valor inválido (ex.: 180,00).';
  else if (retorno && retorno <= data) msg = 'O retorno precisa ser depois da data da consulta.';
  if (msg) { erro.textContent = msg; erro.hidden = false; return; }
  const btn = $('#btn-salvar-consulta');
  btn.disabled = true;
  try {
    const id = $('#consulta-id').value;
    const existente = id && estado.consultas.find((c) => c.id === id);
    const idConsulta = existente ? existente.id : novoId();
    let fotoId = existente?.fotoId || '';
    try {
      const f = await guardarFotoDoCampo($('#consulta-foto'), 'con-' + idConsulta + '-' + Date.now(), 1600);
      if (f) { if (fotoId) FotosDB.apagar(fotoId); fotoId = f; }
    } catch (e) {
      erro.textContent = 'Não foi possível guardar a foto neste navegador. A consulta foi salva sem foto.';
      erro.hidden = false;
    }
    const dados = { data, tipo, clinica, motivo, resultado, valor, retorno, fotoId };
    if (existente) Object.assign(existente, dados);
    else estado.consultas.push({ id: idConsulta, petId: estado.petAtual, ...dados, criado: Date.now() });
    sincronizarGasto({ tipo: 'consulta', id: idConsulta }, estado.petAtual, valor > 0 ? {
      data, valor, categoria: TIPOS_CONSULTA[tipo].categoria,
      descricao: [TIPOS_CONSULTA[tipo].nome, clinica].filter(Boolean).join(' — '),
    } : null);
    salvar();
    const erroVisivel = !erro.hidden;
    limparFormConsulta();
    if (erroVisivel) erro.hidden = false;
    renderTudo();
  } finally { btn.disabled = false; }
});

$('#diario-consultas').addEventListener('click', (ev) => {
  let b;
  if ((b = ev.target.closest('[data-editar-consulta]'))) {
    const c = estado.consultas.find((x) => x.id === b.dataset.editarConsulta);
    if (!c) return;
    $('#consulta-id').value = c.id;
    $('#consulta-data').value = c.data;
    $('#consulta-tipo').value = c.tipo;
    $('#consulta-clinica').value = c.clinica || '';
    $('#consulta-motivo').value = c.motivo || '';
    $('#consulta-resultado').value = c.resultado || '';
    $('#consulta-valor').value = c.valor ? c.valor.toFixed(2).replace('.', ',') : '';
    $('#consulta-retorno').value = c.retorno || '';
    $('#consulta-foto-nome').textContent = c.fotoId ? 'já tem foto (escolha outra para trocar)' : '';
    $('#form-consulta-titulo').textContent = 'Editar consulta';
    $('#btn-salvar-consulta').textContent = 'Salvar alterações';
    $('#btn-cancelar-consulta').hidden = false;
    $('#form-consulta').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if ((b = ev.target.closest('[data-remover-consulta]')) && pedeConfirmacao(b)) {
    const c = estado.consultas.find((x) => x.id === b.dataset.removerConsulta);
    if ($('#consulta-id').value === c?.id) limparFormConsulta();
    if (c?.fotoId) FotosDB.apagar(c.fotoId);
    sincronizarGasto({ tipo: 'consulta', id: c.id }, c.petId, null);
    estado.consultas = estado.consultas.filter((x) => x.id !== c.id);
    salvar();
    renderTudo();
  }
});

function renderConsultas() {
  const regs = consultasDoPet();
  $('#lista-consultas').innerHTML = regs.length ? regs.map((c) => {
    const t = TIPOS_CONSULTA[c.tipo] || TIPOS_CONSULTA.consulta;
    let retorno = '';
    if (c.retorno) {
      const pend = retornoPendente(c);
      const d = diasEntre(hojeISO(), c.retorno);
      const st = !pend ? ['neutro', `Retorno ${fmtData(c.retorno)} (feito)`]
        : d < 0 ? ['atrasada', `Retorno atrasado: era ${fmtData(c.retorno)}`]
        : d === 0 ? ['perto', 'Retorno hoje'] : d <= 7 ? ['perto', `Retorno em ${plural(d, 'dia', 'dias')} (${fmtData(c.retorno)})`]
        : ['ok', `Retorno em ${fmtData(c.retorno)}`];
      retorno = `<span class="selo ${st[0]}">${st[1]}</span>`;
    }
    return `
      <li class="item-consulta">
        <div class="info">
          <div class="principal">${t.emoji} ${t.nome}${c.motivo ? ': ' + esc(c.motivo) : ''}</div>
          <div class="secundario">${fmtData(c.data)}${c.clinica ? ' · ' + esc(c.clinica) : ''}${c.valor ? ' · ' + fmtReais(c.valor) : ''}</div>
          ${c.resultado ? `<p class="resultado">${esc(c.resultado)}</p>` : ''}
          ${retorno}
          <div class="acoes">
            ${c.retorno && retornoPendente(c) && c.retorno >= hojeISO() ? botoesEvento('ret-' + c.id, [eventoRetorno(c)]) : ''}
            <button type="button" class="btn pequeno" data-editar-consulta="${c.id}">Editar</button>
            <button type="button" class="btn pequeno perigo" data-remover-consulta="${c.id}">Excluir</button>
          </div>
        </div>
        ${miniatura(c.fotoId)}
      </li>`;
  }).join('') : '<li class="vazio">Nenhuma consulta registrada.</li>';
  carregarFotos($('#diario-consultas'));
}

/* ---------- Sub-abas do Diário ---------- */
let subabaDiario = 'sintomas';
try {
  const salva = localStorage.getItem('diario-pet-subaba-diario');
  if (['sintomas', 'consultas', 'gastos'].includes(salva)) subabaDiario = salva;
} catch (e) { /* ignora */ }
function mostrarSubabaDiario(nome) {
  subabaDiario = nome;
  try { localStorage.setItem('diario-pet-subaba-diario', nome); } catch (e) { /* ignora */ }
  document.querySelectorAll('[data-subaba-diario]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.subabaDiario === nome)));
  for (const k of ['sintomas', 'consultas', 'gastos']) $(`#diario-${k}`).hidden = k !== nome;
}
$('#subabas-diario').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-subaba-diario]');
  if (b) mostrarSubabaDiario(b.dataset.subabaDiario);
});
function renderDiario() {
  renderSintomas();
  renderConsultas();
  renderGastos();
}

/* ---------- Avisos do pet (todos os tipos) ---------- */
// nivel: 'atrasada' (vermelho) | 'perto' (amarelo); aba: onde resolver
function avisosDoPet(petId) {
  const p = estado.pets.find((x) => x.id === petId);
  if (!p) return [];
  const hoje = hojeISO();
  const lista = alertasDoPet(petId).map(({ r, st }) => ({
    nivel: st.nivel, icone: st.icone, aba: 'saude', ordem: st.dias,
    html: `<strong>${TIPOS[r.tipo].nome}: ${esc(r.nome)}</strong> — ${st.texto.toLowerCase()} (${fmtData(r.proxima)})`,
  }));
  for (const r of estado.remedios.filter((x) => x.petId === petId && remedioAtivo(x) && x.inicio <= hoje)) {
    const e = estoqueRemedio(r);
    if (e && e.diasRestantes <= 3 && (!r.fim || e.acaba < r.fim)) {
      lista.push({ nivel: e.diasRestantes <= 1 ? 'atrasada' : 'perto', icone: '💊', aba: 'saude', ordem: e.diasRestantes,
        html: `<strong>${esc(r.nome)}</strong> — ${e.restante <= 0 ? 'o estoque acabou' : `acaba em ~${plural(e.diasRestantes, 'dia', 'dias')}`}: compre mais` });
    }
    if (r.fim) {
      const d = diasEntre(hoje, r.fim);
      if (d === 0 || d === 1) lista.push({ nivel: 'perto', icone: '💊', aba: 'saude', ordem: d,
        html: `<strong>${esc(r.nome)}</strong> — ${d === 0 ? 'último dia hoje' : 'termina amanhã'}` });
    }
  }
  const er = estoqueRacao(p);
  if (er && er.diasRestantes !== null && er.diasRestantes <= 5) {
    lista.push({ nivel: er.diasRestantes <= 1 ? 'atrasada' : 'perto', icone: '🥣', aba: 'racao', ordem: er.diasRestantes,
      html: er.diasRestantes <= 0 ? '<strong>Ração</strong> — o saco já deve ter acabado: registre o novo'
        : `<strong>Ração</strong> — acaba em ~${plural(er.diasRestantes, 'dia', 'dias')} (${fmtData(er.acaba)})` });
  }
  for (const c of consultasDoPet(petId).filter(retornoPendente)) {
    const d = diasEntre(hoje, c.retorno);
    if (d <= 7 && d >= -30) lista.push({ nivel: d < 0 ? 'atrasada' : 'perto', icone: '🩺', aba: 'diario', ordem: d,
      html: `<strong>Retorno${c.clinica ? ' — ' + esc(c.clinica) : ''}</strong> — ${d < 0 ? `atrasado (era ${fmtData(c.retorno)})` : d === 0 ? 'hoje' : `em ${plural(d, 'dia', 'dias')} (${fmtData(c.retorno)})`}` });
  }
  const cont = repeticoesSintomas(petId);
  for (const [k, n] of Object.entries(cont)) {
    if (n >= 3) lista.push({ nivel: 'perto', icone: SINTOMAS[k].emoji, aba: 'diario', ordem: 2,
      html: `<strong>${SINTOMAS[k].nome}</strong> — ${n} vezes em 7 dias: vale consultar o veterinário` });
  }
  const urgente = estado.sintomas.find((s) => s.petId === petId && SINTOMAS[s.tipo]?.urgente && s.data >= somarDias(hoje, -1));
  if (urgente) lista.push({ nivel: 'atrasada', icone: '🚨', aba: 'diario', ordem: -99,
    html: `<strong>${SINTOMAS[urgente.tipo].nome}</strong> registrado: ${SINTOMAS[urgente.tipo].urgente}` });
  return lista.sort((a, b) => (a.nivel === b.nivel ? a.ordem - b.ordem : a.nivel === 'atrasada' ? -1 : 1));
}

/* ---------- Resumo do pet (topo) ---------- */
function renderResumo() {
  const p = petAtual();
  $('#resumo-emoji').innerHTML = avatarHTML(p, 52);
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

  const al = avisosDoPet(p.id);
  $('#alertas').innerHTML = al.map((a) => `
      <li class="alerta ${a.nivel}">
        <span aria-hidden="true">${a.icone}</span>
        <span>${a.html}</span>
      </li>`).join('');
  for (const [aba, el] of [['saude', '#contador-saude'], ['diario', '#contador-diario']]) {
    const n = al.filter((a) => a.aba === aba).length;
    $(el).hidden = !n;
    $(el).textContent = n;
    $(el).setAttribute('aria-label', `${n} aviso(s)`);
  }
}
let resumoAberto = true;
try { resumoAberto = localStorage.getItem('diario-pet-resumo') !== 'fechado'; } catch (e) { /* ignora */ }
function aplicarResumo() {
  $('#resumo-corpo').hidden = !resumoAberto;
  $('#btn-resumo').setAttribute('aria-expanded', String(resumoAberto));
  $('#btn-resumo').textContent = resumoAberto ? 'Recolher' : 'Ver resumo';
}
$('#btn-resumo').addEventListener('click', () => {
  resumoAberto = !resumoAberto;
  try { localStorage.setItem('diario-pet-resumo', resumoAberto ? 'aberto' : 'fechado'); } catch (e) { /* ignora */ }
  aplicarResumo();
});
aplicarResumo();
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
  if (nome === 'racao') preencherFormSaco();
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
  preencherFormSaco();
  limparFormSintoma();
  limparFormConsulta();
  limparFormGasto();
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
const CAMPOS_DATA = ['#peso-data', '#banho-data', '#saude-data', '#sintoma-data', '#consulta-data', '#gasto-data'];
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
  $('#aba-diario').hidden = !temPet || abaAtual !== 'diario';
  if (!temPet) return;
  renderResumo();
  if (abaAtual === 'peso') renderPeso();
  else if (abaAtual === 'racao') { renderRacao(); renderSaco(); }
  else if (abaAtual === 'diario') renderDiario();
  else if (abaAtual === 'ecc') { renderEcc(); renderListaEcc(); }
  else { renderSaude(); renderClinico(); renderRaca(); }
}

$('#peso-data').value = hojeISO();
$('#peso-data').max = hojeISO();
$('#banho-data').value = hojeISO();
$('#banho-data').max = hojeISO();
$('#pet-nasc').max = hojeISO();
mostrarSubaba(subabaSaude);
mostrarSubabaDiario(subabaDiario);
limparFormSintoma();
limparFormConsulta();
limparFormGasto();
mostrarAba(['peso', 'racao', 'saude', 'ecc', 'diario'].includes(abaAtual) ? abaAtual : 'peso');
limparFormDoenca();
limparFormRemedio();
limparFormSaude();
