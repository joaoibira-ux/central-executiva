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

## Regras gerais

- Arquivos do site ficam na raiz do repositório
- Credenciais do Firebase em `firebase-config.js`; se vazio, o app roda em modo local (localStorage)
- Firestore com regras abertas (`allow read, write: if true`), igual ao NATIVA/IBIRÁ
- Coleções: `contatos`, `agenda`
- Anexos da Agenda (`agenda.anexos`, array): guardados como base64 embutido no próprio
  documento, NÃO no Firebase Storage — o Storage passou a exigir plano pago (Blaze) até pra
  ativar, e o João não quer pagar. Por isso `agenda.js` comprime fotos no navegador (canvas)
  até ~450KB por arquivo e limita a soma de anexos de um mesmo compromisso a ~900KB (o
  documento inteiro no Firestore tem limite de ~1MB). Não tentar ativar o Storage de novo
  sem confirmar com o João.
- Menu (`index.html`): HUD circular com título CENTRAL EXECUTIVA; ícones ativos = módulos existentes, os demais são decorativos
- NUNCA commitar `CNAME` antes do DNS estar propagado (derruba o site inteiro)