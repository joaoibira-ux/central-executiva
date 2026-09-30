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
- Agenda — concluídos numa página separada (2026-09-29): `agenda.js` filtra `feito:true` pra
  fora da lista principal (só fica visível 2s, na animação do check, via `atrasoDescida`).
  Compromissos concluídos ficam em `agenda-concluidos.html`/`.js` (link "✓" no cabeçalho da
  Agenda), com o mesmo modal de visualização/edição/exclusão — desmarcar "Concluído" lá
  manda o item de volta pra Agenda automaticamente.
- Alarme de compromisso + indicador de pendência no ícone (2026-09-29, em `app.js`, roda em
  toda página): enquanto o app está aberto, compara a cada 60s (e a cada mudança na coleção
  `agenda`) se algum compromisso de hoje não concluído acabou de chegar na hora (até 5min de
  atraso) — dispara um beep (Web Audio, sem arquivo de áudio) + banner (`.alarme-banner`,
  persistente — só some se o usuário clicar no ×, não desaparece sozinho).
  Isso sozinho NÃO é confiável no iPhone (Safari só libera áudio depois de um toque real na
  própria página, e suspende o contexto nesse meio-tempo) — ver a solução de push abaixo,
  que é a que vale de verdade. O ícone "Agenda" no menu (`index.html`) ganha um badge
  vermelho (`.badge-pendencia`) com a contagem de compromissos não concluídos de hoje ou
  atrasados.
- **Alarme de verdade via Web Push (2026-09-30)** — funciona com o app fechado/tela
  bloqueada, ao contrário do beep acima (o João reclamou explicitamente que "uma agenda sem
  alarme não serve pra nada", isso resolve de vez):
  - Chaves VAPID geradas com `web-push generate-vapid-keys` — a pública está hardcoded em
    `app.js` (`VAPID_PUBLIC`, seguro expor), a privada fica **só** em
    `~/ce-push-alarmes/vapid-keys.json` na VM (`instance-20260726-022533`, chmod 600, nunca
    commitada).
  - Cliente (`app.js`, roda em toda página exceto login): se o navegador suporta
    Notification/ServiceWorker/PushManager e o usuário está logado, mostra um banner
    "🔔 Ativar notificações" (uma vez só, `localStorage.central_push_dispensado` se
    recusar). Ao aceitar: pede permissão, assina push (`pushManager.subscribe`) e salva o
    objeto de inscrição em `usuarios/{uid}.pushSubscription` (documento raiz do usuário, não
    subcoleção). iPhone precisa do app instalado na tela de início e iOS 16.4+.
  - `sw.js` tem os listeners `push` (mostra a notificação, `self.registration.showNotification`)
    e `notificationclick` (foca/abre `agenda.html`).
  - Servidor: `~/ce-push-alarmes/alarmes-push.js` na VM, cron **a cada 1 minuto**
    (`* * * * * cd /home/joaog/ce-push-alarmes && node alarmes-push.js`). Usa a MESMA
    service account do bot de confirmação (`~/ce-bot-key.json`) e faz uma
    **collection group query** em `agenda` (`where data==hoje, feito==false`) cruzando
    todos os usuários de uma vez — por isso existe `firestore.indexes.json` no repo
    (`collectionGroup: "agenda"`, campos `data`+`feito`), publicado via
    `firebase deploy --only firestore:indexes`. Pra cada compromisso cuja hora chegou (até
    2min de atraso) e ainda não tem `alarmeEnviado`, busca `usuarios/{uid}.pushSubscription`
    e manda via `web-push`, depois marca `alarmeEnviado: true` no próprio documento do
    compromisso (pra não repetir). **Editar um compromisso (`agenda.js`/
    `agenda-concluidos.js`) sempre reseta `alarmeEnviado: false`**, senão mudar a hora não
    rearmaria o alarme. Log em `~/ce-push-alarmes/log.txt` na VM.
  - **How to apply**: se o alarme não chegar, checar nessa ordem — (1) o usuário
    realmente ativou notificações (`usuarios/{uid}.pushSubscription` existe?); (2)
    `~/ce-push-alarmes/log.txt` na VM mostra tentativa de envio; (3) o índice de collection
    group está pronto (erro `FAILED_PRECONDITION... index is currently building` na
    primeira vez é normal, leva alguns minutos).
  - **Bug de fuso corrigido em 2026-09-30**: a VM roda em UTC, mas `data`/`hora` do
    compromisso são o que o usuário digitou no fuso dele (Brasil, UTC-3 fixo, sem horário
    de verão desde 2019). O código original fazia `new Date(); alvo.setHours(h,m,...)`, que
    interpreta a hora no fuso do PROCESSO (UTC na VM) — um compromisso às 08:30 virava alvo
    "08:30 UTC" (= 05:30 no Brasil) em vez de "11:30 UTC" (= 08:30 no Brasil), fazendo o
    alarme parecer sempre "já passado". Corrigido tratando tanto "agora" quanto o alvo do
    compromisso deslocados por -3h e comparados nesse mesmo referencial (não depende do
    fuso configurado no processo/SO). **Se a VM for trocada ou o fuso do processo mudar,
    essa lógica continua correta** — não usar `Date.setHours`/fuso local do servidor de
    novo pra isso.
  - **Bug do campo `feito` ausente corrigido em 2026-09-30**: compromissos recém-criados
    nunca tinham o campo `feito` gravado (só passava a existir depois de marcar/desmarcar o
    checkbox alguma vez) — o filtro `.where("feito","==",false)` da collection group query
    NUNCA batia com um documento sem esse campo, então a notificação nunca disparava pra
    compromissos novos (o que é o caso comum). Corrigido em duas frentes: (1)
    `alarmes-push.js` na VM não filtra mais `feito` no Firestore, filtra em JS
    (`if (i.feito) continue`, que trata ausente-ou-false igual); isso exigiu adicionar um
    field override de índice de campo único (`data`, `COLLECTION_GROUP`) em
    `firestore.indexes.json`, porque a query só com `data` não reaproveita o índice
    composto `data+feito` automaticamente. (2) `agenda.js` agora grava `feito: false`
    explícito ao CRIAR um compromisso (nunca em edição, senão reabriria um item já
    concluído).
- NUNCA commitar `CNAME` antes do DNS estar propagado (derruba o site inteiro)