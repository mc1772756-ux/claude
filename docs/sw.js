/* Diário do Pet — service worker: deixa o app funcionando sem internet.
   Página: busca a versão nova quando há internet (e guarda), senão usa a guardada.
   Demais arquivos (ícones, leitor de fotos): usa o guardado e atualiza em segundo plano.
   Ao mudar a lista de arquivos ou o leitor, aumente a VERSAO. */
const VERSAO = 'diario-pet-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './ocr/tesseract.min.js',
  './ocr/worker.min.js',
  './ocr/tesseract-core-simd-lstm.wasm.js',
  './ocr/tesseract-core-lstm.wasm.js',
  './ocr/por-traineddata-gz.b64.txt',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
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

  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then((guardado) => {
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
