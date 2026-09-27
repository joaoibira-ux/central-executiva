# Central Executiva — Regras para o Claude

Sistema independente (repo, Firebase e hospedagem próprios), no mesmo modo de operar do NATIVA/IBIRÁ:
hospedagem estática no GitHub Pages + Firestore. Só o modo de operar é replicado, nenhum módulo do NATIVA.

## Versão obrigatória a cada alteração

1. Atualizar `app.js`: `const VERSAO_CENTRAL = "X.XX";`
2. Atualizar `version.json` (`{ "versao": "X.XX" }`) com o MESMO número — é o que aciona a
   atualização forçada no iPhone (ver.js `verificarVersaoNova()`); se ficar dessincronizado
   do `VERSAO_CENTRAL`, o app entra em loop de recarregar sozinho
3. Atualizar a query string de `app.js` e dos demais arquivos nos HTMLs, e `sw.js`: `const VERSION = "central-vXX";` (incrementar sempre) + lista `ASSETS`
4. Commit + push sem perguntar
5. Informar ao usuário no fim da resposta: `Versão atual: vX.XX`

## Atualização forçada (iPhone demorava demais pra pegar versão nova)

`app.js` compara `VERSAO_CENTRAL` com `version.json` (buscado sempre sem cache) a cada
abertura e ao voltar pro app (sem checagem periódica — o João pediu pra tirar, achava
desnecessário); se diferente, apaga Service Worker + caches e recarrega sozinho.
`version.json` é excluído do cache do Service Worker (`sw.js`). Por isso o passo 2 acima é
obrigatório — sem ele o app nunca vai achar que atualizou.

## Login e isolamento por usuário (2026-09-26 — mudança grande, ver abaixo)

O João pediu login obrigatório com banco 100% isolado por usuário ("nada pode ser usado
para todos"). Implementado assim:
- **Firebase Authentication** (e-mail/senha) ativado no console (passo único que só dá pra
  fazer por lá, igual ao Storage — mas esse é grátis, sem exigir Blaze).
- **Autocadastro aberto**: qualquer um pode criar a própria conta em `login.html` (decisão
  explícita do João) — sem convite/aprovação manual.
- **Dados isolados por UID**: `colecao()` em `app.js` agora aponta pra
  `usuarios/{uid}/<nome>` em vez de coleções soltas no topo. `app.js` expõe `auth`,
  `uidAtual` e a Promise `prontoAuth` (resolve com o uid, ou `null` em modo local sem
  Firebase) — toda página exceto `login.html` é redirecionada pra lá se ninguém estiver
  logado (`onAuthStateChanged` guardado em `app.js`).
- **`firestore.rules`**: só permite acesso a `usuarios/{uid}/**`, e só pro dono
  (`request.auth.uid == uid`) — nada mais é acessível. As coleções antigas soltas
  (`contatos`, `agenda`, `desenvolvimento`, `datasImportantes` no topo) ficaram
  inacessíveis pelas regras novas; foram migradas pra dentro de um usuário específico (ver
  "Migração dos dados antigos" abaixo) e não devem ser recriadas soltas de novo.
- **Perfil do usuário** (`usuarios/{uid}` — o documento raiz, não uma subcoleção): campos
  `email`, `whatsapp`, `criadoEm`, `confirmacaoEnviada` (bool). Criado em `login.js` no
  momento do cadastro.
- **Confirmação automática por WhatsApp** (2026-09-26, a pedido do João — ele quis usar o
  mesmo "assistente"/número já usado pelos alertas do GW, não um canal novo): rodando na
  MESMA VM que já hospeda a Evolution API do GW (`instance-20260726-022533`, projeto
  `sistema-ibira`, ver [[evolution_api_vm]] e [[gcp_monitor_vm]]), cron a cada 5 min em
  `~/ce-whatsapp-confirmacao/index.js` (Node + `firebase-admin` — atenção: firebase-admin
  v14 mudou pra API modular, `require("firebase-admin/app")`/`require("firebase-admin/firestore")`,
  não `admin.credential.cert`/`admin.firestore()` do jeito antigo). Autentica em
  `central-executiva-jab` via uma service account dedicada
  (`central-executiva-bot@central-executiva-jab.iam.gserviceaccount.com`, role
  `roles/datastore.user`, chave em `~/ce-bot-key.json` na VM, permissão 600 — bypassa as
  regras do Firestore, é acesso via IAM/Admin SDK). Verifica `usuarios` com
  `confirmacaoEnviada == false`, manda mensagem de boas-vindas pro campo `whatsapp` via
  `POST http://localhost:8080/message/sendText/gw` (mesma instância "gw" do GW,
  `AUTHENTICATION_API_KEY` lida direto de `~/evolution-api/.env`, nunca hardcoded no
  script), e marca `confirmacaoEnviada: true`. Log em `~/ce-whatsapp-confirmacao/log.txt`
  na VM. **Antes de mexer nessa VM de novo, checar `free -h`/`df -h /` primeiro — histórico
  de RAM/disco apertados (ver [[gcp_monitor_vm]]).**
- **Migração dos dados antigos**: o sistema já tinha dados reais (contatos, agenda com
  fotos, datas importantes) de antes do login existir. Decisão do João: viram os dados da
  **Anne (Jaciane)**, que se cadastra sozinha (autocadastro) informando o WhatsApp dela na
  hora. Script pronto em `~/ce-whatsapp-confirmacao/migrar-dados.js` na VM (`node
  migrar-dados.js <UID>`) — copia `contatos`/`agenda`/`desenvolvimento`/`datasImportantes`
  soltas pra `usuarios/{UID}/...`, preservando os IDs originais dos documentos (importante:
  `contatoId` e outras referências dependem disso). **Só roda depois que a Anne criar a
  conta de verdade** — pegar o UID dela em Authentication no console, ou perguntar ao João.
  As coleções soltas originais não são apagadas automaticamente pela migração (decisão
  deliberada, pra conferir visualmente antes de decidir apagar).

## Regras gerais

- Arquivos do site ficam na raiz do repositório
- Credenciais do Firebase em `firebase-config.js`; se vazio, o app roda em modo local (localStorage) — modo local não tem login (não existe multi-usuário sem Firebase)
- Firestore com regras restritas por usuário (`usuarios/{uid}/**`, só o dono) — ver seção de login acima. NÃO são mais regras abertas.
- Coleções (todas agora dentro de `usuarios/{uid}/...`): `contatos` (agora com `aniversarioDia`/`aniversarioMes` opcionais), `agenda`,
  `desenvolvimento` (backlog do próprio sistema, mesmo padrão do NATIVA/GW: campos
  texto/status "aberto"|"concluido"/criadoEm/concluidoEm/notaConclusao), `datasImportantes`
  (aniversários/reuniões/feriados/eventos recorrentes — campos nome/dia/mes/tipo
  "aniversario"|"reuniao"|"feriado"|"evento"|"outro"/obs/contatoId; SEM ano, porque repete
  todo ano; `datas.js` calcula a próxima ocorrência a partir de dia+mês)
- Vínculo Datas↔Contatos (2026-09-24): totalmente bidirecional, sem perguntar.
  De Datas→Contatos: em "Datas importantes" dá pra vincular a um contato existente — se ele já
  tem aniversário salvo, a data é puxada de lá; se não tem (e o tipo é aniversário), salvar a
  data ali também grava em `contatos.aniversarioDia/Mes`.
  De Contatos→Datas: preencher/editar o campo Aniversário em Contatos cria (ou atualiza, se já
  existir — acha pelo `contatoId`) um item "Aniversário de <nome>" em `datasImportantes`
  automaticamente. Limite conhecido: apagar o aniversário em Contatos NÃO apaga o item já
  criado em Datas (decisão deliberada, pra não arriscar excluir algo que o usuário customizou
  lá — precisa apagar manualmente em Datas se for o caso).
  `contatos.html?abrir=ID` abre
  direto um contato (usado pelo link "Ver contato" na tela de Datas).
- Lembrete de parabéns (2026-09-24): NÃO envia mensagem sozinho — o João preferiu revisar
  antes de mandar (decisão explícita, ver conversa). Em "Datas importantes", um item de
  aniversário que caia hoje e tenha contato vinculado com telefone ganha destaque visual
  (`.card.hoje`) e um botão "🎉 Parabéns" que abre o WhatsApp com mensagem padrão já escrita
  ("Feliz aniversário, {primeiro nome}! 🎉🎂 ...") — só falta o João tocar em enviar. O menu
  principal (`index.html`) também mostra um aviso no topo quando há qualquer data importante
  hoje (não só aniversário), linkando pra tela de Datas. Nunca trocar isso por envio automático
  de verdade sem o João pedir de novo — ele já escolheu explicitamente essa opção mais segura
  em vez de usar a Evolution API da VM pra mandar sozinho.
- Anexos da Agenda (`agenda.anexos`, array): guardados como base64 embutido no próprio
  documento, NÃO no Firebase Storage — o Storage passou a exigir plano pago (Blaze) até pra
  ativar, e o João não quer pagar. Por isso `agenda.js` comprime fotos no navegador (canvas)
  até ~450KB por arquivo e limita a soma de anexos de um mesmo compromisso a ~900KB (o
  documento inteiro no Firestore tem limite de ~1MB). Não tentar ativar o Storage de novo
  sem confirmar com o João.
- Menu (`index.html`): HUD circular com título CENTRAL EXECUTIVA; ícones ativos = módulos existentes, os demais são decorativos
- NUNCA commitar `CNAME` antes do DNS estar propagado (derruba o site inteiro)