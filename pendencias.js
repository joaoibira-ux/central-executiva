// Pendências = itens da MESMA coleção "agenda", só que sem "data" definida.
// Dar uma data+hora aqui faz o item sumir desta lista e aparecer na Agenda
// sozinho (agenda.js só mostra itens COM data) — é a mesma coleção, só muda
// o filtro de cada tela.
const col = colecao("agenda");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
const atrasoDescida = new Map();
const $ = id => document.getElementById(id);

function render() {
  const l = itens
    .filter(i => !i.data && (!i.feito || atrasoDescida.has(i.id)))
    .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  let html = "";
  l.forEach(i => {
    html += `<div class="card ${i.feito ? "feito" : ""}" data-id="${i.id}">
      <input type="checkbox" ${i.feito ? "checked" : ""} data-feito="${i.id}" />
      <div class="info"><b>${escHtml(i.titulo)}</b></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhuma pendência — tudo em dia.</p>`;
}

function visualizar(i) {
  editandoId = i.id;
  $("ver-feito").checked = !!i.feito;
  $("ver-titulo").textContent = i.titulo || "";
  $("ver-datahora").innerHTML = `<span class="ver-vazio">Toque para dar uma data e hora</span>`;
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

function abrir(i, focoCampo) {
  editandoId = i ? i.id : null;
  $("modal-titulo").textContent = i ? "Editar pendência" : "Nova pendência";
  $("f-titulo").value = i?.titulo || "";
  $("f-data").value = "";
  $("f-hora").value = "";
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
  const campoParaInput = { titulo: "f-titulo", data: "f-data" };
  const alvo = $(campoParaInput[focoCampo] || "f-titulo");
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
    col.salvar(id, { feito: chk.checked });
    clearTimeout(atrasoDescida.get(id));
    if (chk.checked) atrasoDescida.set(id, setTimeout(() => { atrasoDescida.delete(id); render(); }, 2000));
    else atrasoDescida.delete(id);
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
$("ver-feito").onchange = e => col.salvar(editandoId, { feito: e.target.checked });
$("ver-fechar").onclick = () => { veiodaVisualizacao = false; fecharVisualizacao(); };
$("ver-excluir").onclick = async () => {
  if (confirm("Excluir esta pendência?")) { veiodaVisualizacao = false; await col.remover(editandoId); fecharVisualizacao(); }
};

$("salvar").onclick = () => {
  const titulo = $("f-titulo").value.trim();
  if (!titulo) { alert("Descreva a pendência."); return; }
  const data = $("f-data").value, hora = $("f-hora").value;
  const dados = { titulo, data, hora, alarmeContagem: 0, alarmeVisto: false, telegramEnviado: false };
  if (!editandoId) dados.feito = false;
  const idSalvo = editandoId;
  col.salvar(idSalvo, dados).catch(e => alert("Não deu pra salvar: " + e.message));
  fechar();
  if (veiodaVisualizacao && !data) {
    // Se ganhou data, virou compromisso de Agenda — não tem mais o que visualizar aqui.
    const feitoAtual = itens.find(x => x.id === idSalvo)?.feito;
    visualizar({ id: idSalvo, feito: feitoAtual, ...dados });
  }
};
$("excluir").onclick = async () => {
  if (confirm("Excluir esta pendência?")) { await col.remover(editandoId); fechar(); }
};

col.ouvir(l => {
  itens = l;
  render();
  if ($("modal-ver").classList.contains("aberto") && editandoId) {
    const atual = itens.find(i => i.id === editandoId && !i.data);
    if (atual) visualizar(atual); else fecharVisualizacao();
  }
});
