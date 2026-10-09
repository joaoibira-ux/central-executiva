// Lista só os itens de Desenvolvimento já concluídos (desenvolvimento.js
// filtra esses pra fora da lista principal). Desmarcar "Concluído" aqui manda
// o item de volta pra Desenvolvimento automaticamente.
const col = colecao("desenvolvimento");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
const $ = id => document.getElementById(id);

function fmtDataHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return dia + "/" + mes + "/" + d.getFullYear();
}

function render() {
  const l = itens.filter(i => i.status === "concluido")
    .sort((a, b) => (b.concluidoEm || "").localeCompare(a.concluidoEm || ""));
  let html = "";
  l.forEach(i => {
    html += `<div class="card feito" data-id="${i.id}">
      <input type="checkbox" checked data-feito="${i.id}" />
      <div class="info"><b>${escHtml(i.texto)}</b>
        <small>${escHtml(i.notaConclusao || fmtDataHora(i.concluidoEm))}</small></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhum item concluído ainda.</p>`;
}

function visualizar(i) {
  editandoId = i.id;
  $("ver-feito").checked = i.status === "concluido";
  $("ver-texto").textContent = i.texto || "";
  $("ver-nota").innerHTML = i.notaConclusao ? escHtml(i.notaConclusao).replace(/\n/g, "<br>") : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

function abrir(i, focoCampo) {
  editandoId = i.id;
  $("f-texto").value = i.texto || "";
  $("f-nota").value = i.notaConclusao || "";
  $("excluir").style.display = "";
  $("modal").classList.add("aberto");
  const campoParaInput = { texto: "f-texto", nota: "f-nota" };
  const alvo = $(campoParaInput[focoCampo] || "f-texto");
  alvo.focus();
  if (alvo.select) alvo.select();
}
const fechar = () => $("modal").classList.remove("aberto");

$("cancelar").onclick = () => { fechar(); if (veiodaVisualizacao) $("modal-ver").classList.add("aberto"); };

$("lista").onclick = e => {
  const chk = e.target.closest("[data-feito]");
  if (chk) {
    const dados = { status: chk.checked ? "concluido" : "aberto" };
    if (chk.checked) dados.concluidoEm = new Date().toISOString();
    col.salvar(chk.dataset.feito, dados);
    return;
  }
  const card = e.target.closest(".card");
  if (card) visualizar(itens.find(i => i.id === card.dataset.id));
};

$("modal-ver").querySelectorAll(".ver-campo").forEach(campo => {
  campo.onclick = () => {
    veiodaVisualizacao = true;
    fecharVisualizacao();
    abrir(itens.find(i => i.id === editandoId), campo.dataset.campo);
  };
});
$("ver-feito").onchange = e => {
  const dados = { status: e.target.checked ? "concluido" : "aberto" };
  if (e.target.checked) dados.concluidoEm = new Date().toISOString();
  col.salvar(editandoId, dados);
};
$("ver-fechar").onclick = () => { veiodaVisualizacao = false; fecharVisualizacao(); };
$("ver-excluir").onclick = async () => {
  if (confirm("Excluir este item?")) { veiodaVisualizacao = false; await col.remover(editandoId); fecharVisualizacao(); }
};

$("salvar").onclick = () => {
  const texto = $("f-texto").value.trim();
  if (!texto) { alert("Descreva o item."); return; }
  const dados = { texto, notaConclusao: $("f-nota").value.trim() };
  const idSalvo = editandoId;
  col.salvar(idSalvo, dados).catch(e => alert("Não deu pra salvar: " + e.message));
  fechar();
  if (veiodaVisualizacao) {
    const atual = itens.find(x => x.id === idSalvo) || {};
    visualizar({ ...atual, ...dados, id: idSalvo });
  }
};
$("excluir").onclick = async () => {
  if (confirm("Excluir este item?")) { await col.remover(editandoId); fechar(); }
};

col.ouvir(l => {
  itens = l;
  render();
  if ($("modal-ver").classList.contains("aberto") && editandoId) {
    const atual = itens.find(i => i.id === editandoId);
    if (atual) visualizar(atual); else fecharVisualizacao();
  }
});
