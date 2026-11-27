/* Diário do Pet — service worker: deixa o app funcionando sem internet.
   Página: busca a versão nova quando há internet (e guarda), senão usa a guardada.
   Ícones e manifesto: usa o guardado e atualiza em segundo plano.
   Leitor de fotos (ocr/, ~10 MB): só é baixado na primeira vez que alguém usa o leitor
   e depois sai sempre do guardado (sem baixar de novo a cada uso).
   Ao mudar a lista de arquivos ou o leitor, aumente a VERSAO. */
const VERSAO = 'diario-pet-v5';
const CACHE_LEMBRETES = 'diario-pet-lembretes'; // resumo dos lembretes escrito pela página (não apagar na atualização)
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './qr/qrcode.min.js',
  './qr/jsQR.min.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO && n !== CACHE_LEMBRETES).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put('./index.html', copia)); }
          return resp;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true })),
    );
    return;
  }

  const doLeitor = new URL(req.url).pathname.includes('/ocr/');
  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then((guardado) => {
      if (guardado && doLeitor) return guardado;
      const rede = fetch(req)
        .then((resp) => {
          if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
          return resp;
        })
        .catch(() => guardado);
      return guardado || rede;
    }),
  );
});

/* ---------- Avisos de lembretes com o app fechado (Android/Chrome com o app instalado) ----------
   A página guarda em CACHE_LEMBRETES um resumo dos próximos lembretes de todos os pets.
   Algumas vezes por dia o navegador acorda este service worker (periodicsync); se houver
   algo atrasado, para hoje ou para amanhã, mostra um aviso — no máximo um por dia. */
const urlDe = (nome) => new URL(nome, self.registration.scope).href;
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function somarDiasISO(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return isoLocal(new Date(a, m - 1, d + n));
}
async function avisarLembretes() {
  const c = await caches.open(CACHE_LEMBRETES);
  const resp = await c.match(urlDe('lembretes-dados.json'));
  if (!resp) return;
  const { eventos = [] } = await resp.json();
  const hoje = isoLocal(new Date());
  const controle = await c.match(urlDe('lembretes-ultimo-aviso.txt'));
  if (controle && (await controle.text()) === hoje) return;
  const amanha = somarDiasISO(hoje, 1);
  const atras = eventos.filter((e) => e.data < hoje), deHoje = eventos.filter((e) => e.data === hoje), deAmanha = eventos.filter((e) => e.data === amanha);
  if (!atras.length && !deHoje.length && !deAmanha.length) return;
  const partes = [];
  if (atras.length) partes.push(`${atras.length} ${atras.length === 1 ? 'atrasado' : 'atrasados'}`);
  if (deHoje.length) partes.push(`${deHoje.length} para hoje`);
  if (deAmanha.length) partes.push(`${deAmanha.length} para amanhã`);
  const linhas = [...atras, ...deHoje, ...deAmanha].slice(0, 4)
    .map((e) => `• ${e.pet}: ${e.titulo}${e.data < hoje ? ' (atrasado)' : e.data === amanha ? ' (amanhã)' : ''}`);
  await self.registration.showNotification(`Diário do Pet: ${partes.join(', ')}`, {
    body: linhas.join('\n'), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'diario-pet-lembretes',
  });
  await c.put(urlDe('lembretes-ultimo-aviso.txt'), new Response(hoje));
}
self.addEventListener('periodicsync', (ev) => {
  if (ev.tag === 'diario-pet-lembretes') ev.waitUntil(avisarLembretes().catch(() => {}));
});
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) if ('focus' in j) return j.focus();
      return self.clients.openWindow(self.registration.scope);
    }),
  );
});
