const col = colecao("desenvolvimento");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
const $ = id => document.getElementById(id);

// Igual à Agenda: ao marcar concluído, o item fica no lugar por 2s antes de
// descer pro fim da lista de abertos / entrar nos concluídos.
const atrasoDescida = new Map();

function fmtDataHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return dia + "/" + mes + "/" + d.getFullYear();
}

function render() {
  const l = [...itens].sort((a, b) => {
    const concluidoA = a.status === "concluido" && !atrasoDescida.has(a.id);
    const concluidoB = b.status === "concluido" && !atrasoDescida.has(b.id);
    if (concluidoA !== concluidoB) return concluidoA ? 1 : -1;
    return (b.criadoEm || "").localeCompare(a.criadoEm || "");
  });
  let html = "", entrouConcluidos = false;
  l.forEach(i => {
    const concluido = i.status === "concluido" && !atrasoDescida.has(i.id);
    if (concluido && !entrouConcluidos) { entrouConcluidos = true; html += `<div class="dia">Concluídos</div>`; }
    html += `<div class="card ${concluido ? "feito" : ""}" data-id="${i.id}">
      <input type="checkbox" ${i.status === "concluido" ? "checked" : ""} data-feito="${i.id}" />
      <div class="info"><b>${escHtml(i.texto)}</b>
        <small>${i.status === "concluido" ? escHtml(i.notaConclusao || fmtDataHora(i.concluidoEm)) : "Desde " + escHtml(fmtDataHora(i.criadoEm))}</small></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhuma pendência — tudo em dia.</p>`;
}

// ---------- Tela de visualização ----------
function visualizar(i) {
  editandoId = i.id;
  $("ver-feito").checked = i.status === "concluido";
  $("ver-texto").textContent = i.texto || "";
  $("ver-nota").innerHTML = i.notaConclusao ? escHtml(i.notaConclusao).replace(/\n/g, "<br>") : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

// ---------- Tela de edição ----------
function abrir(i, focoCampo) {
  editandoId = i ? i.id : null;
  $("modal-titulo").textContent = i ? "Editar item" : "Novo item";
  $("f-texto").value = i?.texto || "";
  $("f-nota").value = i?.notaConclusao || "";
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
  const campoParaInput = { texto: "f-texto", nota: "f-nota" };
  const alvo = $(campoParaInput[focoCampo] || "f-texto");
  alvo.focus();
  if (alvo.select) alvo.select();
}
const fechar = () => $("modal").classList.remove("aberto");

$("novo").onclick = () => { veiodaVisualizacao = false; abrir(null); };
$("cancelar").onclick = () => { fechar(); if (veiodaVisualizacao) $("modal-ver").classList.add("aberto"); };

$("lista").onclick = e => {
  const chk = e.target.closest("[data-feito]");
  if (chk) {
    const id = chk.dataset.feito;
    const dados = { status: chk.checked ? "concluido" : "aberto" };
    if (chk.checked) dados.concluidoEm = new Date().toISOString();
    col.salvar(id, dados);
    clearTimeout(atrasoDescida.get(id));
    if (chk.checked) {
      atrasoDescida.set(id, setTimeout(() => { atrasoDescida.delete(id); render(); }, 2000));
    } else {
      atrasoDescida.delete(id);
    }
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

$("salvar").onclick = async () => {
  const texto = $("f-texto").value.trim();
  if (!texto) { alert("Descreva o item."); return; }
  const dados = { texto, notaConclusao: $("f-nota").value.trim() };
  await col.salvar(editandoId, dados);
  fechar();
  if (veiodaVisualizacao) {
    const atual = itens.find(x => x.id === editandoId) || {};
    visualizar({ ...atual, ...dados, id: editandoId });
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
