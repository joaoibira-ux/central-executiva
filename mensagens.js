// Mensagens programadas pro WhatsApp — escolhe um contato (telefone vem de
// Contatos), escreve a mensagem, marca data/hora, e uma rotina na VM
// (mensagens-whatsapp.js, Evolution API — mesma instância "gw" do GW) manda
// sozinha na hora certa. Diferente do lembrete de aniversário em Datas
// importantes (que só abre o WhatsApp pronto, sem enviar sozinho) — aqui o
// envio é automático de propósito, a pedido do João.
const col = colecao("mensagensProgramadas");
const colContatos = colecao("contatos");
let itens = [];
let contatos = [];
let editandoId = null;
let veiodaVisualizacao = false;
let contatoVinculado = null; // { id, nome, telefone }
const $ = id => document.getElementById(id);

function rotuloDia(iso) {
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [a, m, d] = iso.split("-");
  const base = `${d}/${m}/${a}`;
  return iso === hoje ? "Hoje · " + base : iso === amanha ? "Amanhã · " + base : base;
}

function render() {
  const l = itens.filter(i => !i.enviada).sort((a, b) => {
    if (a.data !== b.data) return (a.data || "").localeCompare(b.data || "");
    return (a.hora || "").localeCompare(b.hora || "");
  });
  let html = "", diaAtual = "";
  l.forEach(i => {
    if (i.data !== diaAtual) { diaAtual = i.data; html += `<div class="dia">${escHtml(rotuloDia(i.data))}</div>`; }
    html += `<div class="card" data-id="${i.id}">
      <div class="info"><b>${escHtml(i.contatoNome)}</b>
        <small>${escHtml(i.hora)} · ${escHtml(i.mensagem)}</small></div>
    </div>`;
  });
  $("lista").innerHTML = html || `<p class="vazio">Nenhuma mensagem programada.</p>`;
}

function visualizar(i) {
  editandoId = i.id;
  $("ver-contato").textContent = i.contatoNome || "";
  const [a, m, d] = (i.data || "").split("-");
  $("ver-datahora").textContent = i.data ? `${d}/${m}/${a} às ${i.hora}` : "";
  $("ver-mensagem").innerHTML = escHtml(i.mensagem).replace(/\n/g, "<br>");
  $("modal-ver").classList.add("aberto");
}
const fecharVisualizacao = () => $("modal-ver").classList.remove("aberto");

// ---------- Escolher contato ----------
function renderContatoVinculado() {
  $("f-contato-vinculado").innerHTML = contatoVinculado
    ? `<div class="anexo-item">👤 ${escHtml(contatoVinculado.nome)}${contatoVinculado.telefone ? "" : " (sem telefone!)"}<button type="button" class="anexo-remover" id="remover-contato" aria-label="Remover">×</button></div>`
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
        <small>${escHtml(c.telefone || "sem telefone")}</small></div>
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
  contatoVinculado = { id: c.id, nome: c.nome, telefone: c.telefone || "" };
  renderContatoVinculado();
  $("modal-contato").classList.remove("aberto");
};
$("f-contato-vinculado").onclick = e => {
  if (e.target.closest("#remover-contato")) { contatoVinculado = null; renderContatoVinculado(); }
};

// ---------- Tela de edição ----------
function abrir(i) {
  editandoId = i ? i.id : null;
  $("modal-titulo").textContent = i ? "Editar mensagem" : "Nova mensagem";
  $("f-mensagem").value = i?.mensagem || "";
  $("f-data").value = i?.data || "";
  $("f-hora").value = i?.hora || "";
  contatoVinculado = i?.contatoId ? { id: i.contatoId, nome: i.contatoNome, telefone: i.telefone } : null;
  renderContatoVinculado();
  $("excluir").style.display = i ? "" : "none";
  $("modal").classList.add("aberto");
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
    abrir(itens.find(i => i.id === editandoId));
  };
});
$("ver-fechar").onclick = () => { veiodaVisualizacao = false; fecharVisualizacao(); };
$("ver-excluir").onclick = async () => {
  if (confirm("Excluir esta mensagem programada?")) { veiodaVisualizacao = false; await col.remover(editandoId); fecharVisualizacao(); }
};

// Não espera a gravação confirmar antes de fechar (mesmo padrão de agenda.js).
$("salvar").onclick = () => {
  const mensagem = $("f-mensagem").value.trim();
  const data = $("f-data").value, hora = $("f-hora").value;
  if (!contatoVinculado) { alert("Escolha um contato."); return; }
  if (!contatoVinculado.telefone) { alert("Esse contato não tem telefone cadastrado — adicione em Contatos primeiro."); return; }
  if (!mensagem) { alert("Escreva a mensagem."); return; }
  if (!data || !hora) { alert("Informe data e hora do envio."); return; }
  const dados = {
    contatoId: contatoVinculado.id, contatoNome: contatoVinculado.nome, telefone: contatoVinculado.telefone,
    mensagem, data, hora, enviada: false
  };
  const idSalvo = editandoId;
  col.salvar(idSalvo, dados).catch(e => alert("Não deu pra salvar: " + e.message));
  fechar();
  if (veiodaVisualizacao) visualizar({ id: idSalvo, ...dados });
};
$("excluir").onclick = async () => {
  if (confirm("Excluir esta mensagem programada?")) { await col.remover(editandoId); fechar(); }
};

function atualizarTelaAtual() {
  render();
  if ($("modal-ver").classList.contains("aberto") && editandoId) {
    const atual = itens.find(i => i.id === editandoId);
    if (atual) visualizar(atual); else fecharVisualizacao();
  }
}
col.ouvir(l => { itens = l; atualizarTelaAtual(); });
colContatos.ouvir(l => { contatos = l; });
