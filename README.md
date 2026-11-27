# Diário do Pet

App para acompanhar a saúde do seu cão ou gato: peso, vacinas (com plano de vacinação
calculado pela idade, espécie, raça, sexo e doses anteriores), vermífugo, antipulgas,
remédios, ração e alimentador, escore corporal (ECC), riscos por raça e sexo, sintomas,
consultas e gastos. Funciona **offline** e pode ser **instalado no celular**.
Na primeira vez que é aberto, um tutorial explica como cadastrar pets e cada aba
(dá para rever em ⚙️ → Ver o tutorial de novo).

O app fica na pasta [`docs/`](docs/) e é publicado pelo GitHub Pages.

## Publicar (uma vez)

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha a branch do app e a pasta **/docs**, e clique em **Save**.
4. Em cerca de 1 minuto o endereço aparece no topo da página (algo como
   `https://<usuario>.github.io/claude/`).

## Instalar no celular

- **Android (Chrome):** abra o endereço e toque em **Instalar** no aviso do app
  (ou menu ⋮ → **Instalar app**).
- **iPhone (Safari):** toque em **Compartilhar** → **Adicionar à Tela de Início**.

## Seus dados

- Ficam só no aparelho (nada vai para servidores). A leitura da embalagem por foto
  também acontece no próprio celular.
- Use **⚙️ → Backup → Exportar backup** de vez em quando e antes de trocar de celular.
  Para restaurar: **Importar backup**.
- Não mude o nome do repositório nem o endereço do site: os dados ficam ligados ao endereço.

## Modificar depois

- Edite `docs/index.html` (direto no GitHub ou pedindo ao Claude). O site atualiza em ~1 minuto
  e o app instalado se atualiza sozinho na próxima vez que abrir com internet.
- Se mudar arquivos do leitor de fotos (`docs/ocr/`) ou a lista de arquivos, aumente a
  `VERSAO` em `docs/sw.js`.

## Créditos

Leitura de texto por [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0),
com dados de idioma português do projeto Tesseract. O arquivo `docs/ocr/worker.min.js`
tem uma correção de uma linha (inicialização com dados de idioma em memória).
