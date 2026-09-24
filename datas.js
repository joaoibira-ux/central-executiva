const col = colecao("datasImportantes");
const colContatos = colecao("contatos");
let itens = [];
let contatos = [];
let editandoId = null;
let veiodaVisualizacao = false;
let contatoVinculado = null; // { id, nome } — contato escolhido na edição atual
const $ = id => document.getElementById(id);

const ICONE_TIPO = { aniversario: "🎂", reuniao: "🤝", feriado: "🎉", evento: "📌", outro: "📎" };
const NOME_TIPO = { aniversario: "Aniversário", reuniao: "Reunião", feriado: "Feriado", evento: "Evento", outro: "Outro" };
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
  const contato = i.contatoId ? contatos.find(c => c.id === i.contatoId) : null;
  $("ver-contato").innerHTML = contato
    ? `<a href="contatos.html?abrir=${contato.id}" class="anexo-item" onclick="event.stopPropagation()">👤 ${escHtml(contato.nome)}</a>`
    : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("ver-obs").innerHTML = i.obs ? escHtml(i.obs).replace(/\n/g, "<br>") : `<span class="ver-vazio">Toque para adicionar</span>`;
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

// ---------- Vincular a um contato ----------
// Escolher um contato aqui: se ele já tem aniversário salvo, "puxa" a data dele
// pro formulário. Se não tem (e o tipo é aniversário), ao salvar a data aqui
// também é gravada no cadastro do contato — sincroniza nos dois sentidos.
function renderContatoVinculado() {
  $("f-contato-vinculado").innerHTML = contatoVinculado
    ? `<div class="anexo-item">👤 ${escHtml(contatoVinculado.nome)}<button type="button" class="anexo-remover" id="remover-contato" aria-label="Desvincular">×</button></div>`
    : "";
}
function renderListaContatos() {
  const q = $("busca-contato").value.trim().toLowerCase();
  const l = contatos
    .filter(c => !q || (c.nome || "").toLowerCase().includes(q))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  $("lista-contato").innerHTML = l.length ? l.map(c => `
    <div class="card" data-id="${c.id}">
      <div class="info"><b>${escHtml(c.nome)}</b>
        <small>${escHtml([c.empresa, c.telefone].filter(Boolean).join(" · ")) || "&nbsp;"}</small></div>
    </div>`).join("") : `<p class="vazio">Nenhum contato encontrado.</p>`;
}
$("escolher-contato").onclick = () => {
  $("busca-contato").value = "";
  renderListaContatos();
  $("modal-contato").classList.add("aberto");
};
$("contato-cancelar").onclick = () => $("modal-contato").classList.remove("aberto");
$("busca-contato").oninput = renderListaContatos;
$("lista-contato").onclick = e => {
  const card = e.target.closest(".card");
  if (!card) return;
  const c = contatos.find(x => x.id === card.dataset.id);
  if (!c) return;
  contatoVinculado = { id: c.id, nome: c.nome };
  if (!$("f-nome").value.trim()) $("f-nome").value = c.nome;
  // Se o contato já tem aniversário salvo, puxa a data dele pro formulário.
  if (c.aniversarioDia && c.aniversarioMes) {
    $("f-data").value = "2024-" + String(c.aniversarioMes).padStart(2, "0") + "-" + String(c.aniversarioDia).padStart(2, "0");
    if (!editandoId) $("f-tipo").value = "aniversario";
  }
  renderContatoVinculado();
  $("modal-contato").classList.remove("aberto");
};
$("f-contato-vinculado").onclick = e => {
  if (e.target.closest("#remover-contato")) { contatoVinculado = null; renderContatoVinculado(); }
};

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
  const contatoAtual = i?.contatoId ? contatos.find(c => c.id === i.contatoId) : null;
  contatoVinculado = contatoAtual ? { id: contatoAtual.id, nome: contatoAtual.nome } : null;
  renderContatoVinculado();
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
  const campoParaInput = { nome: "f-nome", data: "f-data", tipo: "f-tipo", obs: "f-obs" };
  if (focoCampo !== "contato") {
    const alvo = $(campoParaInput[focoCampo] || "f-nome");
    alvo.focus();
    if (alvo.select) alvo.select();
  }
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
  const tipo = $("f-tipo").value;
  const dados = { nome, dia, mes, tipo, obs: $("f-obs").value.trim(), contatoId: contatoVinculado?.id || null };
  await col.salvar(editandoId, dados);
  // Aniversário vinculado a um contato que ainda não tem essa data salva: grava lá também.
  if (tipo === "aniversario" && contatoVinculado) {
    const c = contatos.find(x => x.id === contatoVinculado.id);
    if (c && (!c.aniversarioDia || !c.aniversarioMes)) {
      colContatos.salvar(c.id, { aniversarioDia: dia, aniversarioMes: mes });
    }
  }
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
colContatos.ouvir(l => { contatos = l; });
