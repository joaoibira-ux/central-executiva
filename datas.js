const col = colecao("datasImportantes");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
const $ = id => document.getElementById(id);

const ICONE_TIPO = { aniversario: "🎂", feriado: "🎉", evento: "📌" };
const NOME_TIPO = { aniversario: "Aniversário", feriado: "Feriado", evento: "Evento" };
const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Datas aqui não têm ano — se repetem todo ano. Calcula a próxima ocorrência
// (esse ano, ou o que vem se já passou) só pra saber a ordem e quanto falta.
function proximaOcorrencia(dia, mes) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const anoAtual = hoje.getFullYear();
  let data = new Date(anoAtual, mes - 1, dia);
  if (data < hoje) data = new Date(anoAtual + 1, mes - 1, dia);
  return data;
}

function rotuloContagem(data) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 864e5);
  if (dias === 0) return "Hoje!";
  if (dias === 1) return "Amanhã";
  return "Faltam " + dias + " dias";
}

function fmtDiaMes(dia, mes) {
  return String(dia).padStart(2, "0") + "/" + String(mes).padStart(2, "0");
}

function render() {
  const l = itens
    .map(i => ({ ...i, _proxima: proximaOcorrencia(i.dia, i.mes) }))
    .sort((a, b) => a._proxima - b._proxima);
  let html = "", mesAtual = null;
  l.forEach(i => {
    const mesRotulo = NOMES_MES[i._proxima.getMonth()];
    if (mesRotulo !== mesAtual) { mesAtual = mesRotulo; html += `<div class="dia">${mesRotulo}</div>`; }
    html += `<div class="card" data-id="${i.id}">
      <div class="info"><b>${ICONE_TIPO[i.tipo] || "📌"} ${escHtml(i.nome)}</b>
        <small>${fmtDiaMes(i.dia, i.mes)} · ${rotuloContagem(i._proxima)}</small></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhuma data cadastrada.</p>`;
}

// ---------- Tela de visualização ----------
function visualizar(i) {
  editandoId = i.id;
  $("ver-nome").textContent = i.nome || "";
  $("ver-data").textContent = fmtDiaMes(i.dia, i.mes) + " (todo ano)";
  $("ver-tipo").textContent = (ICONE_TIPO[i.tipo] || "📌") + " " + (NOME_TIPO[i.tipo] || "Evento");
  $("ver-obs").innerHTML = i.obs ? escHtml(i.obs).replace(/\n/g, "<br>") : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

// ---------- Tela de edição ----------
// O campo de data é um <input type="date"> comum (dá pra escolher no calendário),
// mas o ano é descartado ao salvar — só dia e mês importam, porque repete todo ano.
function abrir(i, focoCampo) {
  editandoId = i ? i.id : null;
  $("modal-titulo").textContent = i ? "Editar data" : "Nova data";
  $("f-nome").value = i?.nome || "";
  $("f-data").value = i ? ("2024-" + String(i.mes).padStart(2, "0") + "-" + String(i.dia).padStart(2, "0")) : "";
  $("f-tipo").value = i?.tipo || "aniversario";
  $("f-obs").value = i?.obs || "";
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
  const campoParaInput = { nome: "f-nome", data: "f-data", tipo: "f-tipo", obs: "f-obs" };
  const alvo = $(campoParaInput[focoCampo] || "f-nome");
  alvo.focus();
  if (alvo.select) alvo.select();
}
const fechar = () => $("modal").classList.remove("aberto");

$("novo").onclick = () => { veiodaVisualizacao = false; abrir(null); };
$("cancelar").onclick = () => { fechar(); if (veiodaVisualizacao) $("modal-ver").classList.add("aberto"); };

$("lista").onclick = e => {
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
$("ver-fechar").onclick = () => { veiodaVisualizacao = false; fecharVisualizacao(); };
$("ver-excluir").onclick = async () => {
  if (confirm("Excluir esta data?")) { veiodaVisualizacao = false; await col.remover(editandoId); fecharVisualizacao(); }
};

$("salvar").onclick = async () => {
  const nome = $("f-nome").value.trim();
  const dataVal = $("f-data").value;
  if (!nome || !dataVal) { alert("Informe nome e data."); return; }
  const [, mes, dia] = dataVal.split("-").map(Number);
  const dados = { nome, dia, mes, tipo: $("f-tipo").value, obs: $("f-obs").value.trim() };
  await col.salvar(editandoId, dados);
  fechar();
  if (veiodaVisualizacao) visualizar({ id: editandoId, ...dados });
};
$("excluir").onclick = async () => {
  if (confirm("Excluir esta data?")) { await col.remover(editandoId); fechar(); }
};

col.ouvir(l => {
  itens = l;
  render();
  if ($("modal-ver").classList.contains("aberto") && editandoId) {
    const atual = itens.find(i => i.id === editandoId);
    if (atual) visualizar(atual); else fecharVisualizacao();
  }
});
