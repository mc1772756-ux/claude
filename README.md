# Digitalizador de Fotos

App web (PWA) para digitalizar fotos impressas usando a câmera do celular.
Tudo é processado **no próprio aparelho** — nenhuma imagem é enviada para servidores.

## Funcionalidades

- 📷 **Fotografar** com a câmera ou **importar** várias imagens da galeria de uma vez
- ✨ **Detecção automática das bordas** da foto sobre a mesa
- ✋ **Ajuste manual dos 4 cantos**, com lupa para precisão
- 📐 **Correção de perspectiva** (endireita fotos tiradas de lado/tortas)
- 🎨 **Restauração de cores** de fotos desbotadas ou amareladas
- 🎚️ Brilho, contraste, saturação, temperatura, nitidez, preto e branco, girar
- 👁️ Botão "Original" (segure) para comparar antes/depois
- 🗂️ Galeria salva no aparelho, com download em JPEG e compartilhamento
- 📴 Funciona offline e pode ser instalado na tela inicial

## Como usar

1. Coloque a foto sobre uma superfície lisa de cor contrastante, com boa luz e sem reflexos.
2. Toque em **Fotografar foto** (ou **Importar da galeria**).
3. Confira os cantos detectados — arraste-os se necessário — e toque em ✓.
4. Ajuste as cores e toque em 💾 para salvar.

## Rodar localmente

```bash
cd app
python3 -m http.server 8000
# abra http://localhost:8000
```

Para usar no celular, hospede a pasta `app/` em um servidor HTTPS
(por exemplo GitHub Pages, Netlify ou Vercel) — o modo offline/instalação exige HTTPS.

## Estrutura

| Arquivo | Função |
|---|---|
| `app/index.html` | Telas do app |
| `app/style.css` | Visual (tema escuro, responsivo) |
| `app/imaging.js` | Detecção de bordas, correção de perspectiva e ajustes de cor |
| `app/app.js` | Interface, recorte interativo, galeria (IndexedDB) |
| `app/sw.js` | Service worker (offline) |
