const col = colecao("agenda");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
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

// ---------- Tela de visualização (somente leitura) ----------
function visualizar(i) {
  editandoId = i.id;
  $("ver-feito").checked = !!i.feito;
  $("ver-titulo").textContent = i.titulo || "";
  const [a, m, d] = (i.data || "").split("-");
  const dataFmt = i.data ? `${d}/${m}/${a}` : "";
  $("ver-datahora").innerHTML = i.hora
    ? `${escHtml(dataFmt)} às ${escHtml(i.hora)}`
    : `${escHtml(dataFmt)}` || `<span class="ver-vazio">Toque para definir</span>`;
  $("ver-local").innerHTML = i.local ? escHtml(i.local) : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("ver-obs").innerHTML = i.obs ? escHtml(i.obs).replace(/\n/g, "<br>") : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

// ---------- Tela de edição ----------
function abrir(i, focoCampo) {
  editandoId = i ? i.id : null;
  $("modal-titulo").textContent = i ? "Editar compromisso" : "Novo compromisso";
  $("f-titulo").value = i?.titulo || "";
  $("f-data").value = i?.data || new Date().toISOString().slice(0, 10);
  $("f-hora").value = i?.hora || "";
  $("f-local").value = i?.local || "";
  $("f-obs").value = i?.obs || "";
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
  const campoParaInput = { titulo: "f-titulo", data: "f-data", local: "f-local", obs: "f-obs" };
  const alvo = $(campoParaInput[focoCampo] || "f-titulo");
  alvo.focus();
  if (alvo.select) alvo.select();
}
const fechar = () => $("modal").classList.remove("aberto");

$("novo").onclick = () => { veiodaVisualizacao = false; abrir(null); };
$("cancelar").onclick = () => { fechar(); if (veiodaVisualizacao) $("modal-ver").classList.add("aberto"); };

$("lista").onclick = e => {
  const chk = e.target.closest("[data-feito]");
  if (chk) { col.salvar(chk.dataset.feito, { feito: chk.checked }); return; }
  const card = e.target.closest(".card");
  if (card) visualizar(itens.find(i => i.id === card.dataset.id));
};

// Dentro da visualização: cada campo clicado abre a edição focada nele
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
  if (confirm("Excluir este compromisso?")) { veiodaVisualizacao = false; await col.remover(editandoId); fecharVisualizacao(); }
};

$("salvar").onclick = async () => {
  const titulo = $("f-titulo").value.trim(), data = $("f-data").value;
  if (!titulo || !data) { alert("Informe título e data."); return; }
  const dados = { titulo, data, hora: $("f-hora").value, local: $("f-local").value.trim(), obs: $("f-obs").value.trim() };
  await col.salvar(editandoId, dados);
  fechar();
  if (veiodaVisualizacao) {
    const feitoAtual = itens.find(x => x.id === editandoId)?.feito;
    visualizar({ id: editandoId, feito: feitoAtual, ...dados });
  }
};
$("excluir").onclick = async () => {
  if (confirm("Excluir este compromisso?")) { await col.remover(editandoId); fechar(); }
};

col.ouvir(l => {
  itens = l;
  render();
  // Se a tela de visualização estiver aberta, atualiza com os dados novos (ex.: após salvar)
  if ($("modal-ver").classList.contains("aberto") && editandoId) {
    const atual = itens.find(i => i.id === editandoId);
    if (atual) visualizar(atual); else fecharVisualizacao();
  }
});
