# Diário do Pet

App para acompanhar a saúde do seu cão ou gato: peso, vacinas (com plano de vacinação
calculado pela idade, espécie, raça, sexo e doses anteriores), vermífugo, antipulgas,
remédios, ração e alimentador, escore corporal (ECC), riscos por raça e sexo, sintomas,
consultas e gastos. Funciona **offline** e pode ser **instalado no celular**.
Na primeira vez que é aberto, um tutorial explica como cadastrar pets e cada aba
(dá para rever em ⚙️ → Ver o tutorial de novo).

### Novidades

- **Sincronizar com outro celular** (⚙️ → Sincronizar agora): os dois aparelhos trocam os dados
  direto entre si (WebRTC), sem servidor. Um mostra um QR code, o outro lê com a câmera (ou cola o
  código recebido por mensagem). Os dados são **juntados**: nada se perde, vale a edição mais
  recente e o que foi apagado em um é apagado no outro. As fotos também vão.
- **Backup com senha** (criptografia AES-256) e importação que **junta** em vez de só substituir.
- **Lembretes** (aba Agenda): atrasados / hoje / 7 dias / 30 dias de todos os pets, compromissos
  que se repetem (toda semana, todo mês…), avisos no celular mesmo com o app fechado (Android com o
  app instalado) e exportação da agenda inteira em `.ics` com alarmes.
- **Padrões nos seus registros** (aba Início): tendência de peso e previsão para o peso ideal,
  sintomas que se repetem em intervalos regulares ou ficam mais frequentes, sintomas depois de
  trocar a ração ou começar um remédio, coceira depois do banho, mudança no escore corporal e
  gastos (alta e projeção anual). Cada cartão explica como foi calculado.
- **Vários pets** (aba Início): visão geral com avisos de cada pet, comparação lado a lado e
  registro em lote (vermífugo, antipulgas, vacina ou banho para vários pets, dividindo o valor).

O app fica na pasta [`docs/`](docs/) e é publicado pelo GitHub Pages.

## Ciclo menstrual

Outro app, separado, em [`docs/ciclo/`](docs/ciclo/): registra o início e o fim da menstruação,
fluxo, sintomas, humor e anotações; calcula o ciclo e a duração médios, a próxima menstruação, a
ovulação estimada e a janela fértil; mostra tudo num calendário. Também funciona **offline**,
instalável no celular, e os dados ficam só no aparelho (backup em ⚙️ → Exportar backup).
Não é método contraceptivo.

Endereço: `https://<usuario>.github.io/claude/ciclo/`. Se mudar arquivos dele, aumente a
`VERSAO` em `docs/ciclo/sw.js`.

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

Códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) e
[jsQR](https://github.com/cozmo/jsQR) (Apache-2.0), na pasta `docs/qr/`.

Leitura de texto por [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0),
com dados de idioma português do projeto Tesseract. O arquivo `docs/ocr/worker.min.js`
tem uma correção de uma linha (inicialização com dados de idioma em memória).
