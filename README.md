# Campanhas WA • Local — v1.2.0

[English](#english) · [Português](#portugues)

![Campanhas WA — standalone window and Chrome side panel / janela e painel lateral](./docs/painel.png)

*Screenshot supplied by the user (v1.0 interface). / Captura enviada pelo usuário (interface v1.0).*

> Keep `docs/painel.png` alongside this README using the folder structure provided in the ZIP. / Mantenha `docs/painel.png` junto deste README, na estrutura de pastas fornecida no ZIP.

<a id="english"></a>

## English

### New in 1.2 — editor and CSV preview

Choose **Botão CTA**, **Quick reply** or **Lista** in the visible format buttons in **Nova campanha** (or Edit). CTA provides button text and URL/call action; quick replies provide button text and reply ID; lists provide opening-button text, sections, option IDs, titles and descriptions. Add/remove items, set title/footer and review the illustrative preview. Switching formats preserves drafts while the editor stays open.

Fill **Contato para teste** with an authorized phone including country code, then click **Criar teste de 1 contato**. This saves a separate stopped campaign; open it and click Start to send.

Importing a CSV shows a table with source record, name/ID, normalized destination, original value when changed and validation details. Search and filter valid, invalid or duplicate rows; choose 25/50/100 records per page. Filters only change the preview. Duplicate valid destinations are omitted from the queue; invalid entries remain recorded without sending. The version is visible in the top bar.

DOM tests cover the interactive fields, draft restoration, import filters, pagination and escaping. They do not replace a real WhatsApp delivery test.


A local Chrome Manifest V3 extension for campaigns with authorized contacts and groups. It includes source code, tests, a bundled WA-JS build, and an installable `dist` directory. No backend, remote runtime dependencies, or build dependencies are required. Campaigns are stored in `chrome.storage.local`, with access restricted to trusted extension contexts.

### Features

- Import contact CSVs or group invite links, with validation and deduplication.
- Text messages and native group invitation cards.
- **Experimental CTA buttons:** 1–3 URL or phone-call buttons.
- **Experimental quick replies:** 1–3 reply buttons with unique IDs.
- **Experimental lists:** up to 10 options grouped into sections.
- Campaign creation, editing, start/resume, pause, cancellation with confirmation, and deletion with confirmation.
- Persistent per-recipient status, attempt history, message IDs and manual review of uncertain results.
- Configurable random intervals, daily attempt limit and per-run attempt limit.
- Dedicated campaign dashboard with metrics, charts, configuration, message content, remaining-wait estimate, error breakdown and recent activity.
- Search, filters, pagination and campaign result exports in CSV or XLSX.
- An **Extrair** dropdown for groups with invitation links, participants of selected groups, and contacts; all support CSV and XLSX.
- Side panel, standalone window and normal tab layouts, with narrow-screen table cards.
- A local exclusion list and explicit manual resumption after interruptions.

Interactive formats depend on WhatsApp Web's internal functionality. WA-JS documenting a method does not guarantee that buttons or lists will be rendered on the recipient's device. Use a one-contact test before a campaign. This version does not track button responses or list selections.

### Install without building

1. Extract the ZIP into a permanent directory, for example `~/Documents/campanhas-wa`.
2. Open `chrome://extensions/` in Chrome 120 or newer.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select **`campanhas-wa/dist`**, the directory containing `manifest.json`.
5. Open `https://web.whatsapp.com/`, sign in and keep only one WhatsApp Web tab open when connecting.
6. Pin the extension through Chrome's extensions menu and click its icon to open the side panel.
7. Click **Conectar WhatsApp**. The extension injects its bundled WA-JS into the page's `MAIN` world using `chrome.scripting`. No console commands are needed.

Do not move or delete the installed directory. The side panel stays open when clicking the page. **Janela** opens a separate window; **Abrir aba** opens a normal tab. An always-on-top window depends on the operating system and is not implemented by this extension.

### Update from version 1.0 while preserving campaigns

1. Pause campaigns and wait for in-flight operations to finish.
2. Extract the new package to a temporary location.
3. Copy the new `campanhas-wa` contents over your existing project, keeping the **same installed `dist` path**.
4. In `chrome://extensions/`, click **Reload** on the existing extension. Do not click **Remove**.
5. Reload WhatsApp Web, then close and reopen the extension's panels.
6. Check existing campaigns and resume manually when ready.

Version 1.1 keeps the existing storage key and campaign format. New interactive configuration is optional; previous text/invitation campaigns remain compatible. Uninstalling the extension can delete its local data.

### Build and test

Requirements: Node.js 20+ and npm. Run `npm ci` to install the DOM testing dependency; building alone needs no dependencies.

```bash
cd ~/Documents/campanhas-wa
npm ci
npm test
npm run build
```

The build copies `src` and `vendor` into `dist` and prints the bundled WA-JS SHA-256. Load or reload `dist` in Chrome afterward.

### Create a campaign

1. Click **Nova campanha** and name it.
2. Choose **Contatos** (contacts) or **Links de grupos** (group links) before importing a CSV.
3. Import the file and review the valid, invalid and duplicate counts. Invalid rows remain visible but are never sent to.
4. Choose the message type:
   - **Mensagem de texto:** ordinary text.
   - **Convite nativo de grupo:** an invitation URL sent through `WPP.chat.sendGroupInviteMessage`, with optional caption. It does not silently fall back to a plain URL if the native invitation fails.
   - **CTA:** button text and URL or phone number with country code; optional title/footer.
   - **Quick reply:** button text and a unique reply ID; optional title/footer.
   - **Lista:** opening-button text, sections, option IDs, titles and descriptions; optional title/footer.
5. Write the message. `{{nome}}` substitutes the contact/group name; `{{numero}}` substitutes a contact's phone and is empty for group targets. These substitutions apply to the message/caption, not interactive option fields.
6. Set minimum/maximum interval, daily attempt limit and per-run attempt limit.
7. Click **Salvar campanha**. Saving never starts a campaign.
8. Review and click **Iniciar / retomar**. The first recipient also waits for a randomly selected interval.

**Criar teste de 1 contato** uses the authorized phone filled in **Contato para teste** and creates a separate, stopped one-recipient campaign using the current message configuration. Click Start on that campaign to actually send it. Verify the visual result on the receiving device.

Editing preserves destinations and history. It changes only the configuration for future sends. Create a new campaign to replace the recipient list or change its type.

### CSV formats

#### Contacts

The supplied format is supported: `Nome;Numero;ID;Observacao`. `Numero` or `Telefone` is required; the importer also recognizes common English number/name headers. It supports UTF-8 BOM, comma/semicolon/tab separators, quoted fields, escaped quotes and embedded newlines.

Phone numbers must include country code. Formatting characters such as spaces, `+`, parentheses, dots and hyphens are stripped. Blank, nonnumeric or scientific-notation values are invalid. No country code is added automatically. `ID` is retained as a source reference, but delivery uses the phone number. A LID is never treated as a phone number.

#### Groups

Use one `https://chat.whatsapp.com/CODE` link per line, **without a header**, as in the supplied group files. Header-based files with `Link`, `URL`, `Convite`, `Grupo` or `Link do grupo` are also accepted. Duplicates are removed by invite code, ignoring URL query parameters.

For group campaigns, the extension looks up the invite and joins only if the account is not already a member. If administrator approval is required, it records **Aguardando aprovação** and sends no message. Once approval is granted, manually review the row and return it to the queue. Admin-only posting, revoked invites and other failures appear per destination. Extraction features never join groups.

### Dashboard and controls

Select a campaign and click **Dashboard completo** for its dedicated route. It includes sent/pending/error/uncertain counts, total attempts, sent-to-total percentage, progress, daily chart, message preview, configured limits, interval-only wait estimate, grouped error reasons and recent events. The estimate excludes pauses, limits, request duration and browser delays. Use **Todas as campanhas** to return.

- **Pausar:** prevents future operations. An already-started send or join may finish.
- **Cancelar:** confirms and permanently cancels the campaign; it does not undo sends or group membership changes.
- **Editar:** available while stopped with no operation in flight.
- **Excluir:** confirms deletion of campaign and history. Daily counters are retained.
- **Revisar:** for errors, pending approval or uncertain sends. After checking WhatsApp, type `REPETIR` to queue again, `ENVIADO` to confirm manually, or `IGNORAR` to skip. Repeating an uncertain send can duplicate a message.
- **CSV / XLSX:** exports the entire campaign, regardless of active filters.
- **Exclusões:** one digits-only international phone number or exact group URL per line. Matching pending targets are skipped before preparation. Already-started operations may finish.

### Extract groups, participants and contacts

Open **Extrair** in the top bar:

1. **Grupos e convites:** choose groups, then query their current invitation links. All groups are initially selected. The extension does not create, rotate or revoke links. Permission failures leave the link blank with the reason in `Observacao`.
2. **Participantes de grupos:** select one or more groups. Search and select/clear visible results are available. Each row includes name, phone, ID, group name/ID and observations. A person belonging to multiple selected groups appears once per group to preserve provenance.
3. **Contatos:** defaults to saved address-book contacts. Uncheck the option to include other contacts available in the session cache. This cannot guarantee a complete copy of the phone's address book.

Click **Extrair**, monitor progress, select **CSV** or **Excel (.xlsx)** and click **Baixar resultado**. **Interromper** stops after the current query and leaves partial results available for download. Each query batch is time-limited. Download results before closing/reloading the panel or starting another extraction: extraction results are held in panel memory and are not automatically added to campaigns.

Phone-to-LID mappings are resolved only when available. Unavailable names or numbers remain blank with observations. Changing accounts during extraction rejects subsequent queries.

CSV is UTF-8 with BOM and a semicolon separator. XLSX is a real OOXML workbook with filters and a frozen header row. Cells are stored as text to preserve phone numbers and prevent formula execution from contact names. XLSX cells longer than 32,767 characters are truncated. Neither format requires external services.

### Persistence, limits and interruptions

- One active campaign at a time.
- Campaigns are bound to the WhatsApp account used when first started. A different account cannot resume that campaign.
- Local persistence is per Chrome profile; there is no cloud sync or full database backup/restore feature.
- Closing, discarding or reloading the linked WhatsApp tab pauses campaigns. Another tab is not selected automatically.
- Closing Chrome interrupts execution. Active campaigns are paused on the next browser session and require manual resumption.
- A periodic health check runs roughly every 30 seconds, plus a pre-destination check. A pending operation may take up to 60 seconds to time out.
- Unconfirmed/interrupted sends become **Incerto** and pause the campaign. There is no automatic retry and no exactly-once guarantee from WhatsApp Web.
- **Enviado** means ACK >= 1, or an explicit manual confirmation. It does not prove delivery, reading or rendering of interactive components.
- Interval range: **30 seconds to 24 hours**. Chrome may delay alarms. Delays exceeding two minutes cause a manual-resume pause; overdue sends are not executed in a burst.
- Daily attempts aggregate across all campaigns for that account in this Chrome profile, including deleted campaigns and attempts that fail during preparation. The counter uses the computer's local day. Each campaign applies its configured daily ceiling to that total. It is not an official WhatsApp quota.
- Per-run attempts reset on Start/resume; daily attempts do not.
- Routine service-worker restarts preserve scheduled campaigns. If an operation was in flight, recovery marks it uncertain and pauses the campaign.

Deleting the extension, clearing its storage or losing the Chrome profile may delete campaign data. Export results you need to retain.

### WA-JS updates

The package includes unmodified **WA-JS v4.6.0** from the official release. A pinned version makes failures reproducible. No remote code is downloaded while using the extension.

```bash
# Download a specific stable version
node scripts/update-wa.mjs v4.6.0
npm run build

# Or try the development nightly
node scripts/update-wa.mjs nightly
npm ci
npm test
npm run build
```

The updater needs GitHub access and may use unpkg for license files. If the corresponding licenses cannot be obtained, it preserves the current bundle and reports an error. Reload the extension and WhatsApp after updating. WhatsApp Web changes can break WA-JS functions independently of the extension.

### Validation and initial test

**31 automated tests pass**, covering CSV parsing/deduplication, validation, lifecycle recovery, intervals, limits, exclusions, pause during send, uncertainty, group approval/restrictions, native invitations, interactive dispatch, LID handling, account changes, export structure and dashboard escaping.

The original sample CSVs parsed as 988 contacts and two lists of 40 group links, with no internal duplicates. This validates formatting, not current phone/group availability. Those personal CSVs are not distributed in this package.

XLSX output was independently opened with openpyxl and checked for ZIP/XML integrity, Unicode, text phone preservation, formula safety, filters and frozen headers. Chrome and WA-JS integrations were tested with mocks. **No real messages, group joins or account logins were performed by the developer in this environment.** Automated browser/visual validation could not be completed because a working Chromium binary was unavailable and download attempts did not provide a valid archive. Responsive breakpoints were implemented but are not a claim of verified behavior on every device.

For your first real test, use one authorized contact, a batch limit of 1 and a 30–35 second interval. Verify text, invitation and interactive formats separately on the recipient's phone. Test pausing, closing the WhatsApp tab, restarting Chrome and reviewing an uncertain result before running a larger campaign. Test extraction using a small group selection and verify both file formats.

### Project layout

```text
src/manifest.json       MV3 configuration and permissions
src/background.js       Persistence, scheduling and execution
src/adapter.js          WA-JS message calls in the page context
src/core.js             CSV parsing, validation and recovery
src/index.html          Dashboard, dialogs and forms
src/ui.js               Main interface and routing
src/style.css           Responsive layouts
src/interactive-ui.js   CTA, quick reply and list editors
src/dashboard.js        Dedicated campaign dashboard
src/extractor.js        Read-only WA-JS extraction calls
src/extraction-ui.js    Group selection, progress and downloads
src/export.js           CSV and local XLSX writer
vendor/                 WA-JS and third-party licenses
scripts/                Build and bundle updater
tests/                  node:test suite
docs/painel.png          User-provided screenshot
dist/                   Ready-to-load extension
```

References: https://wppconnect.io/wa-js/ ; https://github.com/wppconnect-team/wa-js ; https://developer.chrome.com/docs/extensions/reference/api/scripting ; https://developer.chrome.com/docs/extensions/reference/api/alarms ; https://developer.chrome.com/docs/extensions/reference/api/sidePanel . Third-party licenses are retained in `vendor` and `dist/vendor`.

---

<a id="portugues"></a>

## Português

### Novidades da 1.2 — formulário e prévia do CSV

Em **Nova campanha** ou **Editar**, escolha os botões visíveis **Botão CTA**, **Quick reply** ou **Lista**. CTA tem texto do botão e ação de URL/ligação; quick reply tem texto e ID da resposta; lista tem texto de abertura, seções, IDs, títulos e descrições das opções. Adicione/remova itens, preencha título/rodapé e confira a prévia ilustrativa. Alternar formatos preserva os rascunhos enquanto o editor estiver aberto.

Preencha **Contato para teste** com DDI e número autorizado e clique em **Criar teste de 1 contato**. A campanha de teste é salva parada; clique em Iniciar nela para enviar.

O CSV importado aparece em uma tabela com registro de origem, nome/ID, destino tratado, valor original quando alterado e detalhes da validação. Busque e filtre válidos, inválidos ou duplicados, com 25/50/100 registros por página. Filtros afetam somente a prévia. Duplicados válidos são retirados da fila; inválidos ficam registrados sem envio. A versão aparece na topbar.

Testes de DOM cobrem os campos interativos, restauração de rascunhos, filtros, paginação e escape de conteúdo. Não substituem um teste real de entrega no WhatsApp.


Extensão Chrome Manifest V3 para campanhas com contatos e grupos autorizados. Código JavaScript sem framework, sem backend e sem dependências de build. Banco local persistente em `chrome.storage.local`, restrito aos contextos da extensão. O pacote contém fonte, testes, WA-JS e a pasta `dist` pronta para carregar.


### Novidades da versão 1.1

- **CTA:** de 1 a 3 botões com URL ou ligação, com título e rodapé opcionais.
- **Quick reply:** de 1 a 3 botões de resposta com texto e ID único.
- **Lista:** até 10 opções, agrupadas em seções, com título, descrição e ID por opção.
- Os três formatos são **experimentais** no WhatsApp Web. Use **Criar teste de 1 contato** no formulário: informa-se o número autorizado e a extensão cria uma campanha parada de um único destino. Clique em Iniciar para efetivamente enviar. Confira o componente no aparelho do destinatário; ACK não comprova renderização de botões/listas. Respostas aos botões não são monitoradas ou contabilizadas nesta versão.
- **Dashboard completo:** botão na campanha abre tela dedicada, com rota própria, indicadores, conteúdo, configuração, estimativa de espera, erros agrupados, atividade recente, gráficos, filtros e resultados. Volte com **Todas as campanhas**.
- **Extrair**, na topbar: grupos e convites; participantes de um ou vários grupos; contatos salvos ou disponíveis na sessão. Escolha **CSV** ou **Excel (.xlsx)** antes de baixar.
- Layout adaptado para larguras de 320px, painel lateral, janela e desktop, com tabelas convertidas em cartões em telas estreitas. A revisão visual automatizada não pôde ser realizada neste ambiente.

### Atualizar da versão 1.0 sem perder campanhas

1. Pause campanhas e aguarde a operação em andamento terminar.
2. Extraia o novo ZIP em uma pasta temporária.
3. Copie o conteúdo da nova pasta `campanhas-wa` sobre **a mesma pasta** que você já usa. Mantenha o mesmo caminho da `dist` cadastrada no Chrome.
4. Abra `chrome://extensions/` e clique no ícone de recarregar da extensão existente. **Não clique em Remover.**
5. Recarregue o WhatsApp Web e feche/reabra os painéis da extensão.
6. Confira as campanhas e retome manualmente. A chave e o formato do banco anterior foram mantidos; mensagens antigas continuam como texto/convite.

### 1. Instalar sem build

1. Extraia o ZIP para uma pasta permanente, por exemplo `~/Documents/campanhas-wa`.
2. Abra `chrome://extensions/` no Chrome 120 ou superior.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta **`dist`**, onde está o `manifest.json`.
5. Abra `https://web.whatsapp.com/`, faça login e deixe somente uma aba do WhatsApp aberta.
6. No menu de extensões do Chrome, fixe **Campanhas WA • Local** na barra e clique no ícone. O painel lateral abre.
7. Clique em **Conectar WhatsApp**. A extensão injeta o arquivo local WA-JS no contexto da página usando `chrome.scripting` no mundo `MAIN`. Não é necessário abrir o console ou colar código.

Não apague nem mova a pasta instalada. Para atualizar, mantenha a mesma pasta, substitua o código, faça o build e clique em recarregar no cartão da extensão. Recarregue também o WhatsApp, para remover a versão anteriormente injetada. Não desinstale a extensão durante uma atualização: isso pode apagar os dados locais.

### 2. Build a partir do código

Requisitos: Node.js 20+ e npm. Execute `npm ci` para instalar a dependência dos testes de DOM; o build isolado não precisa de dependências.

```bash
cd ~/Documents/campanhas-wa
npm ci
npm test
npm run build
```

Carregue `dist` pelo procedimento acima. O build copia os arquivos da interface e o WA-JS para `dist` e imprime o SHA-256 do bundle.

### 3. Criar e executar uma campanha

1. Clique em **Nova campanha** e escolha um nome.
2. Escolha **Contatos** ou **Links de grupos** antes de importar o CSV.
3. Selecione o arquivo. A tela informa destinos válidos, inválidos e duplicados removidos. Linhas inválidas permanecem no detalhamento com o motivo, sem envio.
4. Escolha **Mensagem de texto**, **Convite nativo de grupo**, **CTA**, **Quick reply** ou **Lista**. Nos formatos interativos, preencha os campos adicionais e teste antes de uma campanha maior.
5. Escreva a mensagem. São aceitas as variáveis `{{nome}}` e `{{numero}}`. Em grupos, `{{nome}}` pode usar o nome obtido do grupo e `{{numero}}` fica vazio.
6. Para convite, informe o link do grupo a ser convidado. O texto será a legenda do convite. A extensão chama `WPP.chat.sendGroupInviteMessage`; não substitui silenciosamente por link cru se o convite falhar.
7. Defina intervalo mínimo e máximo em segundos, limite diário de tentativas e limite por execução.
8. Clique em **Salvar campanha**. Salvar não inicia envios.
9. Revise e clique em **Iniciar / retomar**. O primeiro destino também aguarda um intervalo sorteado.

#### Formatos de CSV

Contatos: aceita as colunas do arquivo anexado `Nome;Numero;ID;Observacao`. `Numero`/`Telefone` é obrigatório. Aceita vírgula, ponto e vírgula ou tabulação como separador, BOM UTF-8, aspas escapadas e quebras de linha em campos entre aspas.

O telefone deve conter DDI. Espaços, `+`, parênteses, pontos e traços de formatação são removidos. Valores vazios, científicos ou não numéricos são inválidos. Não transforma LID em telefone nem adiciona DDI automaticamente. `ID` é preservado como referência da importação, mas o destino de envio é o telefone.

Grupos: aceita **um link `https://chat.whatsapp.com/CODIGO` por linha, sem cabeçalho**, exatamente como os dois arquivos anexados. Também aceita coluna `Link`, `URL`, `Convite`, `Grupo` ou `Link do grupo`. A deduplicação considera o código, ignorando os parâmetros da URL.

Cada campanha usa apenas um tipo de destino. Para trocar a lista ou o tipo após salvar, crie outra campanha. Ao editar uma existente, os destinatários e resultados são preservados e a mensagem, convite, nome e limites podem mudar.

#### Grupos

A extensão consulta o convite, verifica se a conta já participa e, caso necessário, solicita entrada pelo link. Depois verifica se só administradores podem escrever. O envio só ocorre quando a preparação retorna um destino utilizável. Link revogado, grupo cheio, restrição de postagem, incompatibilidade ou outros erros são registrados na linha.

Quando há aprovação de administrador, o destino fica **Aguardando aprovação**, sem mensagem. Após a aprovação, pause a campanha, clique em **Revisar** na linha e escolha **REPETIR** para recolocá-la na fila. A extensão não fica tentando entrar em loop.

### 4. Acompanhamento e controles

- Busca e filtro de campanhas por estado.
- Busca e filtro de destinos por nome, telefone, link, resultado e mensagem de erro.
- Cards quantitativos, distribuição por resultado, gráfico de enviados nos últimos sete dias e progresso.
- Contagem regressiva para o próximo destino; mostra “Aguardando Chrome…” se o alarme estiver atrasado.
- Tabela paginada (50 linhas), detalhes e histórico de tentativas.
- **CSV** e **XLSX** exportam os resultados completos da campanha, mesmo se houver filtro na tela. Campos com sintaxe de fórmula recebem proteção ao exportar.
- **Pausar** impede novas operações; um envio/entrada já iniciado pode terminar.
- **Cancelar** pede confirmação e encerra a campanha definitivamente, sem desfazer mensagens nem saídas/entradas de grupos.
- **Editar** exige campanha parada e nenhuma operação em andamento.
- **Excluir** pede confirmação e remove a campanha e seu histórico. O contador diário de tentativas é preservado.
- **Exclusões** aceita telefones com DDI (só dígitos) ou links exatos, um por linha. Eles são ignorados antes de preparar o próximo envio. Uma operação já iniciada pode terminar.
- **Janela** abre uma janela independente; **Abrir aba** abre o painel numa aba normal.

O painel lateral não fecha simplesmente ao clicar fora. Uma janela independente pode ficar atrás de outras; “sempre no topo” depende do gerenciador de janelas do sistema operacional. A extensão não implementa esse recurso.

### 5. Persistência e interrupções

- Uma campanha ativa por vez, para manter a ordem e os limites. Outras ficam salvas e paradas.
- O conteúdo e os resultados ficam no perfil local do Chrome, sem servidor externo. Não há sincronização entre máquinas.
- A campanha se vincula à conta do WhatsApp usada no primeiro início. Troca de conta bloqueia a retomada/envio dessa campanha.
- Fechar/recarregar a aba vinculada pausa a campanha. Não transfere automaticamente para outra aba.
- Fechar o navegador interrompe a execução; na próxima inicialização, campanhas ativas ficam pausadas. É necessário retomar manualmente.
- Há verificação periódica de disponibilidade, aproximadamente a cada 30s, e antes de cada destino. Falhas durante uma chamada podem levar até 60s para aparecer.
- Se uma chamada de envio terminar sem confirmação ou for interrompida, o destino fica **Incerto** e a campanha pausa. Não há retry automático.
- **Revisar** permite confirmar manualmente como enviado, ignorar ou repetir. Confira a conversa antes de repetir: o WhatsApp pode ter aceitado uma mensagem cuja resposta foi perdida. Não há garantia de “exactly once” pela API do WhatsApp Web.
- Mensagens com estado **Enviado** tiveram ACK >= 1 ou foram confirmadas manualmente em Revisar. Isso não comprova entrega ao dispositivo nem leitura.
- A espera sorteada é de **30 segundos a 24 horas**. Chrome pode atrasar alarmes. Se o atraso ultrapassar dois minutos, a campanha pausa para retomada manual. Não tenta compensar atraso com uma sequência de envios.
- Limite diário: tentativas agregadas por conta neste perfil e dia local, inclusive tentativas que falharam na preparação. Apagar campanhas não zera o contador. Cada campanha aplica seu limite configurado a esse total; ele não é uma cota da plataforma.
- Limite por execução: tentativas desde o último Iniciar/retomar. Ao atingir o limite a campanha pausa; uma nova retomada inicia outro lote. O limite diário não é reiniciado pela retomada.
- A reinicialização normal do service worker entre alarmes mantém o agendamento persistido. Se havia operação em voo, marca como incerta e pausa.

Desinstalar a extensão, apagar seu armazenamento ou perder o perfil pode apagar os dados. Exporte os resultados que precisa manter. Não há backup/restauração do banco implementado nesta versão.

### 6. Atualizar WA-JS

Incluído: **WA-JS v4.6.0**, baixado do release oficial, sem modificações. Versão fixa facilita diagnóstico. Não há download de código remoto durante o uso da extensão.

Para baixar uma nova versão estável específica:

```bash
node scripts/update-wa.mjs v4.6.0
npm run build
```

Para experimentar a nightly:

```bash
node scripts/update-wa.mjs nightly
npm ci
npm test
npm run build
```

O atualizador precisa de acesso a GitHub e, como fallback para licenças, unpkg. Se as licenças da versão não estiverem disponíveis, ele preserva o bundle existente e mostra o erro. Alternativamente, coloque o arquivo oficial em `vendor/wppconnect-wa.js`, acompanhando suas licenças, e execute o build. Depois recarregue extensão e WhatsApp.

WA-JS depende das funções internas do WhatsApp Web. Compatibilidade com sua sessão e disponibilidade do convite nativo só podem ser confirmadas num teste real; atualizações do WhatsApp podem exigir atualizar o bundle.

### 7. Teste inicial recomendado

1. Importe um CSV contendo apenas seu contato de teste autorizado.
2. Configure mensagem simples, limites 1/1 e intervalo 30–35s.
3. Inicie e confira no WhatsApp e no resultado da linha.
4. Faça uma campanha separada com o convite nativo e confira a apresentação do cartão.
5. Teste um grupo autorizado, um link inválido e um grupo que exige aprovação.
6. Inicie uma campanha com mais de um destino e feche/reabra a aba antes do primeiro envio. Ela deve permanecer pausada.
7. Teste pausar, cancelar e recarregar o Chrome. Revise qualquer resultado incerto antes de repetir.

### 8. Validação realizada

- 31 testes automatizados passam: parsing, BOM, multiline, deduplicação, LID, validação, exportação, recuperação, agendamento, limite diário, exclusões, pausa durante envio, resultado incerto, aprovação pendente, grupo restrito, convite nativo e troca de conta.
- Os três CSVs anexados foram lidos pelo importador: **988 contatos válidos**, **40 links válidos** e **40 links válidos**, sem duplicados internos. Isso valida formato, não a existência atual dos números/grupos.
- O XLSX foi validado independentemente: estrutura ZIP/XML, abertura pelo openpyxl, preservação de telefones como texto, Unicode, filtro e cabeçalho congelado.
- A integração foi testada com simulações de Chrome/WA-JS. **Não foram executados envios reais, entrada em grupos nem login na sua conta.**
- A revisão visual e a instalação real em Chromium não foram concluídas neste ambiente: o navegador não estava instalado e o download falhou. Faça o teste inicial acima antes de uma campanha maior.

### 9. Extrações

Abra o dropdown **Extrair** na topbar:

- **Grupos e convites:** lista os grupos disponíveis na sessão, com seleção e busca. Todos vêm selecionados inicialmente. A extensão consulta o link atual; não cria, renova nem revoga convite. Se o WhatsApp exigir permissão que a conta não possui, a linha fica sem link e com o erro na coluna `Observacao`.
- **Participantes de grupos:** selecione um ou mais grupos (ou todos os resultados filtrados). O arquivo contém nome, número, ID, nome/ID do grupo e observação. A mesma pessoa em dois grupos tem duas linhas para preservar a origem. Não há entrada automática em grupos durante extrações.
- **Contatos:** por padrão, apenas contatos salvos. Desmarque a opção para incluir outros contatos disponíveis no cache da sessão. Não promete reproduzir a agenda completa do celular.
- **Interromper:** encerra após a consulta atual; o resultado parcial pode ser baixado. A consulta de cada lote tem limite de tempo.
- Resultados são mantidos na memória do painel até fechar/recarregar ou começar outra extração; baixe antes de sair. São independentes das campanhas e não são adicionados automaticamente a uma campanha.
- LIDs são resolvidos quando o cache tem o mapeamento. Um LID nunca é exportado como telefone; número indisponível fica em branco com observação.
- CSV é UTF-8 com BOM e separador `;`. XLSX é um arquivo OOXML real, com filtros, cabeçalho congelado e células de texto para não arredondar telefones nem executar fórmulas presentes em nomes. Conteúdos acima de 32.767 caracteres em uma célula são truncados no XLSX.

### Estrutura

```text
src/manifest.json       Permissões e configuração MV3
src/background.js       Persistência, alarmes e máquina de execução
src/adapter.js          Chamadas WA-JS no contexto da página
src/core.js             Parser CSV, validação e recuperação
src/index.html          Painel e formulários
src/ui.js               Interações, filtros, exportação e gráficos
src/style.css           Layout responsivo
src/interactive-ui.js  Formulários CTA, quick reply e listas
src/extractor.js       Consultas de extração no WhatsApp
src/extraction-ui.js   Seleção, progresso e exportação
src/export.js          CSV e escritor XLSX local
src/dashboard.js       Tela dedicada de campanha
docs/painel.png         Captura fornecida pelo usuário
README.en.md            Documentação em inglês
vendor/                 WA-JS e licenças
scripts/build.mjs       Gera dist sem instalar dependências
scripts/update-wa.mjs   Atualiza o bundle local
tests/                  Testes com node:test
dist/                   Extensão pronta para carregar
```

Fontes técnicas: https://wppconnect.io/wa-js/ ; https://github.com/wppconnect-team/wa-js ; https://developer.chrome.com/docs/extensions/reference/api/scripting ; https://developer.chrome.com/docs/extensions/reference/api/alarms ; https://developer.chrome.com/docs/extensions/reference/api/sidePanel .

Os CSVs pessoais anexados não são distribuídos no ZIP. WA-JS e dependências mantêm suas licenças em `vendor/` e `dist/vendor/`.
