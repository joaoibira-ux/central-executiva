// Histórico de mensagens já enviadas pelo WhatsApp (ver mensagens.js pras pendentes).
const col = colecao("mensagensProgramadas");
let itens = [];
let editandoId = null;
const $ = id => document.getElementById(id);

function fmtDataHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return dia + "/" + mes + "/" + d.getFullYear() + " " + hora + ":" + min;
}

function render() {
  const l = itens.filter(i => i.enviada).sort((a, b) => (b.enviadaEm || "").localeCompare(a.enviadaEm || ""));
  let html = "";
  l.forEach(i => {
    html += `<div class="card feito" data-id="${i.id}">
      <div class="info"><b>${escHtml(i.contatoNome)}</b>
        <small>${escHtml(fmtDataHora(i.enviadaEm))} · ${escHtml(i.mensagem)}</small></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhuma mensagem enviada ainda.</p>`;
}

function visualizar(i) {
  editandoId = i.id;
  $("ver-contato").textContent = i.contatoNome || "";
  $("ver-datahora").textContent = fmtDataHora(i.enviadaEm);
  $("ver-mensagem").innerHTML = escHtml(i.mensagem).replace(/\n/g, "<br>");
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

$("lista").onclick = e => {
  const card = e.target.closest(".card");
  if (card) visualizar(itens.find(i => i.id === card.dataset.id));
};
$("ver-fechar").onclick = fecharVisualizacao;
$("ver-excluir").onclick = async () => {
  if (confirm("Excluir esta mensagem do histórico?")) { await col.remover(editandoId); fecharVisualizacao(); }
};

col.ouvir(l => {
  itens = l;
  render();
  if ($("modal-ver").classList.contains("aberto") && editandoId) {
    const atual = itens.find(i => i.id === editandoId);
    if (atual) visualizar(atual); else fecharVisualizacao();
  }
});
