const col = colecao("agenda");
let itens = [];
let editandoId = null;
const $ = id => document.getElementById(id);

function rotuloDia(iso) {
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [a, m, d] = iso.split("-");
  const base = `${d}/${m}/${a}`;
  return iso === hoje ? "Hoje · " + base : iso === amanha ? "Amanhã · " + base : base;
}

function render() {
  const l = [...itens].sort((a, b) => ((a.data || "") + (a.hora || "")).localeCompare((b.data || "") + (b.hora || "")));
  let html = "", diaAtual = "";
  l.forEach(i => {
    if (i.data !== diaAtual) { diaAtual = i.data; html += `<div class="dia">${escHtml(rotuloDia(i.data))}</div>`; }
    html += `<div class="card ${i.feito ? "feito" : ""}" data-id="${i.id}">
      <input type="checkbox" ${i.feito ? "checked" : ""} data-feito="${i.id}" />
      <div class="info"><b>${escHtml(i.titulo)}</b>
        <small>${escHtml([i.hora, i.local].filter(Boolean).join(" · "))}</small></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhum compromisso.</p>`;
}

function abrir(i) {
  editandoId = i ? i.id : null;
  $("modal-titulo").textContent = i ? "Editar compromisso" : "Novo compromisso";
  $("f-titulo").value = i?.titulo || "";
  $("f-data").value = i?.data || new Date().toISOString().slice(0, 10);
  $("f-hora").value = i?.hora || "";
  $("f-local").value = i?.local || "";
  $("f-obs").value = i?.obs || "";
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
  $("f-titulo").focus();
}
const fechar = () => $("modal").classList.remove("aberto");

$("novo").onclick = () => abrir(null);
$("cancelar").onclick = fechar;
$("lista").onclick = e => {
  const chk = e.target.closest("[data-feito]");
  if (chk) { col.salvar(chk.dataset.feito, { feito: chk.checked }); return; }
  const card = e.target.closest(".card");
  if (card) abrir(itens.find(i => i.id === card.dataset.id));
};
$("salvar").onclick = async () => {
  const titulo = $("f-titulo").value.trim(), data = $("f-data").value;
  if (!titulo || !data) { alert("Informe título e data."); return; }
  await col.salvar(editandoId, {
    titulo, data, hora: $("f-hora").value, local: $("f-local").value.trim(), obs: $("f-obs").value.trim()
  });
  fechar();
};
$("excluir").onclick = async () => {
  if (confirm("Excluir este compromisso?")) { await col.remover(editandoId); fechar(); }
};
col.ouvir(l => { itens = l; render(); });