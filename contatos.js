const col = colecao("contatos");
let contatos = [];
let editandoId = null;
const $ = id => document.getElementById(id);

function fmtAniversario(c) {
  if (!c.aniversarioDia || !c.aniversarioMes) return "";
  return "🎂 " + String(c.aniversarioDia).padStart(2, "0") + "/" + String(c.aniversarioMes).padStart(2, "0");
}

function render() {
  const q = $("busca").value.trim().toLowerCase();
  const l = contatos
    .filter(c => !q || [c.nome, c.telefone, c.email, c.empresa].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  $("lista").innerHTML = l.length ? l.map(c => {
    const fone = (c.telefone || "").replace(/\D/g, "");
    return `<div class="card" data-id="${c.id}">
      <div class="info"><b>${escHtml(c.nome)}</b>
        <small>${escHtml([c.empresa, c.telefone, c.email, fmtAniversario(c)].filter(Boolean).join(" · "))}</small></div>
      ${fone ? `<a class="btn mini" href="https://wa.me/55${fone}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>` : ""}
    </div>`;
  }).join("") : `<p class="vazio">Nenhum contato.</p>`;
}

function abrir(c) {
  editandoId = c ? c.id : null;
  $("modal-titulo").textContent = c ? "Editar contato" : "Novo contato";
  $("f-nome").value = c?.nome || "";
  $("f-tel").value = c?.telefone || "";
  $("f-email").value = c?.email || "";
  $("f-empresa").value = c?.empresa || "";
  // Ano é só um valor fixo pra caber no <input type="date"> — só dia/mês importam.
  $("f-aniversario").value = (c?.aniversarioDia && c?.aniversarioMes)
    ? ("2024-" + String(c.aniversarioMes).padStart(2, "0") + "-" + String(c.aniversarioDia).padStart(2, "0")) : "";
  $("f-obs").value = c?.obs || "";
  $("excluir").style.display = c ? "" : "none";
  $("modal").classList.add("aberto");
  $("f-nome").focus();
}
const fechar = () => $("modal").classList.remove("aberto");

$("novo").onclick = () => abrir(null);
$("cancelar").onclick = fechar;
$("busca").oninput = render;
$("lista").onclick = e => {
  const card = e.target.closest(".card");
  if (card) abrir(contatos.find(c => c.id === card.dataset.id));
};
$("salvar").onclick = async () => {
  const nome = $("f-nome").value.trim();
  if (!nome) { alert("Informe o nome."); return; }
  const aniversario = $("f-aniversario").value; // "AAAA-MM-DD" ou vazio
  const [, mes, dia] = aniversario ? aniversario.split("-").map(Number) : [null, null, null];
  await col.salvar(editandoId, {
    nome, telefone: $("f-tel").value.trim(), email: $("f-email").value.trim(),
    empresa: $("f-empresa").value.trim(), obs: $("f-obs").value.trim(),
    aniversarioDia: dia || null, aniversarioMes: mes || null
  });
  fechar();
};
$("excluir").onclick = async () => {
  if (confirm("Excluir este contato?")) { await col.remover(editandoId); fechar(); }
};

// Link direto de outra tela (ex.: Datas importantes → "Ver contato"): contatos.html?abrir=ID
col.ouvir(l => {
  contatos = l;
  render();
  const idAbrir = new URLSearchParams(location.search).get("abrir");
  if (idAbrir) {
    const alvo = contatos.find(c => c.id === idAbrir);
    if (alvo) { abrir(alvo); history.replaceState(null, "", location.pathname); }
  }
});
