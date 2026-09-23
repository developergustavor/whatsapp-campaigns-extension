# Campanhas WA • Local

Extensão Chrome Manifest V3 para campanhas com contatos e grupos autorizados. Código JavaScript sem framework, sem backend e sem dependências de build. Banco local persistente em `chrome.storage.local`, restrito aos contextos da extensão. O pacote contém fonte, testes, WA-JS e a pasta `dist` pronta para carregar.

## 1. Instalar sem build

1. Extraia o ZIP para uma pasta permanente, por exemplo `~/Documents/campanhas-wa`.
2. Abra `chrome://extensions/` no Chrome 120 ou superior.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta **`dist`**, onde está o `manifest.json`.
5. Abra `https://web.whatsapp.com/`, faça login e deixe somente uma aba do WhatsApp aberta.
6. No menu de extensões do Chrome, fixe **Campanhas WA • Local** na barra e clique no ícone. O painel lateral abre.
7. Clique em **Conectar WhatsApp**. A extensão injeta o arquivo local WA-JS no contexto da página usando `chrome.scripting` no mundo `MAIN`. Não é necessário abrir o console ou colar código.

Não apague nem mova a pasta instalada. Para atualizar, mantenha a mesma pasta, substitua o código, faça o build e clique em recarregar no cartão da extensão. Recarregue também o WhatsApp, para remover a versão anteriormente injetada. Não desinstale a extensão durante uma atualização: isso pode apagar os dados locais.

## 2. Build a partir do código

Requisitos: Node.js 20+ e npm. Não precisa executar `npm install`.

```bash
cd ~/Documents/campanhas-wa
npm test
npm run build
```

Carregue `dist` pelo procedimento acima. O build copia os arquivos da interface e o WA-JS para `dist` e imprime o SHA-256 do bundle.

## 3. Criar e executar uma campanha

1. Clique em **Nova campanha** e escolha um nome.
2. Escolha **Contatos** ou **Links de grupos** antes de importar o CSV.
3. Selecione o arquivo. A tela informa destinos válidos, inválidos e duplicados removidos. Linhas inválidas permanecem no detalhamento com o motivo, sem envio.
4. Escolha **Mensagem de texto** ou **Convite nativo de grupo**.
5. Escreva a mensagem. São aceitas as variáveis `{{nome}}` e `{{numero}}`. Em grupos, `{{nome}}` pode usar o nome obtido do grupo e `{{numero}}` fica vazio.
6. Para convite, informe o link do grupo a ser convidado. O texto será a legenda do convite. A extensão chama `WPP.chat.sendGroupInviteMessage`; não substitui silenciosamente por link cru se o convite falhar.
7. Defina intervalo mínimo e máximo em segundos, limite diário de tentativas e limite por execução.
8. Clique em **Salvar campanha**. Salvar não inicia envios.
9. Revise e clique em **Iniciar / retomar**. O primeiro destino também aguarda um intervalo sorteado.

### Formatos de CSV

Contatos: aceita as colunas do arquivo anexado `Nome;Numero;ID;Observacao`. `Numero`/`Telefone` é obrigatório. Aceita vírgula, ponto e vírgula ou tabulação como separador, BOM UTF-8, aspas escapadas e quebras de linha em campos entre aspas.

O telefone deve conter DDI. Espaços, `+`, parênteses, pontos e traços de formatação são removidos. Valores vazios, científicos ou não numéricos são inválidos. Não transforma LID em telefone nem adiciona DDI automaticamente. `ID` é preservado como referência da importação, mas o destino de envio é o telefone.

Grupos: aceita **um link `https://chat.whatsapp.com/CODIGO` por linha, sem cabeçalho**, exatamente como os dois arquivos anexados. Também aceita coluna `Link`, `URL`, `Convite`, `Grupo` ou `Link do grupo`. A deduplicação considera o código, ignorando os parâmetros da URL.

Cada campanha usa apenas um tipo de destino. Para trocar a lista ou o tipo após salvar, crie outra campanha. Ao editar uma existente, os destinatários e resultados são preservados e a mensagem, convite, nome e limites podem mudar.

### Grupos

A extensão consulta o convite, verifica se a conta já participa e, caso necessário, solicita entrada pelo link. Depois verifica se só administradores podem escrever. O envio só ocorre quando a preparação retorna um destino utilizável. Link revogado, grupo cheio, restrição de postagem, incompatibilidade ou outros erros são registrados na linha.

Quando há aprovação de administrador, o destino fica **Aguardando aprovação**, sem mensagem. Após a aprovação, pause a campanha, clique em **Revisar** na linha e escolha **REPETIR** para recolocá-la na fila. A extensão não fica tentando entrar em loop.

## 4. Acompanhamento e controles

- Busca e filtro de campanhas por estado.
- Busca e filtro de destinos por nome, telefone, link, resultado e mensagem de erro.
- Cards quantitativos, distribuição por resultado, gráfico de enviados nos últimos sete dias e progresso.
- Contagem regressiva para o próximo destino; mostra “Aguardando Chrome…” se o alarme estiver atrasado.
- Tabela paginada (50 linhas), detalhes e histórico de tentativas.
- **CSV** exporta os resultados completos da campanha, mesmo se houver filtro na tela. Campos com sintaxe de fórmula recebem proteção ao exportar.
- **Pausar** impede novas operações; um envio/entrada já iniciado pode terminar.
- **Cancelar** pede confirmação e encerra a campanha definitivamente, sem desfazer mensagens nem saídas/entradas de grupos.
- **Editar** exige campanha parada e nenhuma operação em andamento.
- **Excluir** pede confirmação e remove a campanha e seu histórico. O contador diário de tentativas é preservado.
- **Exclusões** aceita telefones com DDI (só dígitos) ou links exatos, um por linha. Eles são ignorados antes de preparar o próximo envio. Uma operação já iniciada pode terminar.
- **Janela** abre uma janela independente; **Abrir aba** abre o painel numa aba normal.

O painel lateral não fecha simplesmente ao clicar fora. Uma janela independente pode ficar atrás de outras; “sempre no topo” depende do gerenciador de janelas do sistema operacional. A extensão não implementa esse recurso.

## 5. Persistência e interrupções

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

## 6. Atualizar WA-JS

Incluído: **WA-JS v4.6.0**, baixado do release oficial, sem modificações. Versão fixa facilita diagnóstico. Não há download de código remoto durante o uso da extensão.

Para baixar uma nova versão estável específica:

```bash
node scripts/update-wa.mjs v4.6.0
npm run build
```

Para experimentar a nightly:

```bash
node scripts/update-wa.mjs nightly
npm test
npm run build
```

O atualizador precisa de acesso a GitHub e, como fallback para licenças, unpkg. Se as licenças da versão não estiverem disponíveis, ele preserva o bundle existente e mostra o erro. Alternativamente, coloque o arquivo oficial em `vendor/wppconnect-wa.js`, acompanhando suas licenças, e execute o build. Depois recarregue extensão e WhatsApp.

WA-JS depende das funções internas do WhatsApp Web. Compatibilidade com sua sessão e disponibilidade do convite nativo só podem ser confirmadas num teste real; atualizações do WhatsApp podem exigir atualizar o bundle.

## 7. Teste inicial recomendado

1. Importe um CSV contendo apenas seu contato de teste autorizado.
2. Configure mensagem simples, limites 1/1 e intervalo 30–35s.
3. Inicie e confira no WhatsApp e no resultado da linha.
4. Faça uma campanha separada com o convite nativo e confira a apresentação do cartão.
5. Teste um grupo autorizado, um link inválido e um grupo que exige aprovação.
6. Inicie uma campanha com mais de um destino e feche/reabra a aba antes do primeiro envio. Ela deve permanecer pausada.
7. Teste pausar, cancelar e recarregar o Chrome. Revise qualquer resultado incerto antes de repetir.

## 8. Validação realizada

- 21 testes automatizados passam: parsing, BOM, multiline, deduplicação, LID, validação, exportação, recuperação, agendamento, limite diário, exclusões, pausa durante envio, resultado incerto, aprovação pendente, grupo restrito, convite nativo e troca de conta.
- Os três CSVs anexados foram lidos pelo importador: **988 contatos válidos**, **40 links válidos** e **40 links válidos**, sem duplicados internos. Isso valida formato, não a existência atual dos números/grupos.
- A integração foi testada com simulações de Chrome/WA-JS. **Não foram executados envios reais, entrada em grupos nem login na sua conta.**
- A revisão visual e a instalação real em Chromium não foram concluídas neste ambiente: o navegador não estava instalado e o download falhou. Faça o teste inicial acima antes de uma campanha maior.

## Estrutura

```text
src/manifest.json       Permissões e configuração MV3
src/background.js       Persistência, alarmes e máquina de execução
src/adapter.js          Chamadas WA-JS no contexto da página
src/core.js             Parser CSV, validação e recuperação
src/index.html          Painel e formulários
src/ui.js               Interações, filtros, exportação e gráficos
src/style.css           Layout responsivo
vendor/                 WA-JS e licenças
scripts/build.mjs       Gera dist sem instalar dependências
scripts/update-wa.mjs   Atualiza o bundle local
tests/                  Testes com node:test
dist/                   Extensão pronta para carregar
```

Fontes técnicas: https://wppconnect.io/wa-js/ ; https://github.com/wppconnect-team/wa-js ; https://developer.chrome.com/docs/extensions/reference/api/scripting ; https://developer.chrome.com/docs/extensions/reference/api/alarms ; https://developer.chrome.com/docs/extensions/reference/api/sidePanel .

Os CSVs pessoais anexados não são distribuídos no ZIP. WA-JS e dependências mantêm suas licenças em `vendor/` e `dist/vendor/`.
