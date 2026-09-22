const col = colecao("contatos");
let contatos = [];
let editandoId = null;
let contatosImportados = [];
const $ = id => document.getElementById(id);

function render() {
  const q = $("busca").value.trim().toLowerCase();
  const l = contatos
    .filter(c => !q || [c.nome, c.telefone, c.email, c.empresa].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  $("lista").innerHTML = l.length ? l.map(c => {
    const fone = (c.telefone || "").replace(/\D/g, "");
    return `<div class="card" data-id="${c.id}">
      <div class="info"><b>${escHtml(c.nome)}</b>
        <small>${escHtml([c.empresa, c.telefone, c.email].filter(Boolean).join(" · "))}</small></div>
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
  await col.salvar(editandoId, {
    nome, telefone: $("f-tel").value.trim(), email: $("f-email").value.trim(),
    empresa: $("f-empresa").value.trim(), obs: $("f-obs").value.trim()
  });
  fechar();
};
$("excluir").onclick = async () => {
  if (confirm("Excluir este contato?")) { await col.remover(editandoId); fechar(); }
};
col.ouvir(l => { contatos = l; render(); });

// ---------- Importar contatos do iPhone (arquivo .vcf) ----------
// O iPhone (Safari) não deixa nenhum site ler os Contatos nativos diretamente —
// restrição de privacidade da Apple. O caminho real é o usuário exportar um
// arquivo .vcf pelo próprio app Contatos e escolher esse arquivo aqui.

// Desdobra linhas "dobradas" do vCard (continuação começa com espaço/tab) e separa por CRLF/LF.
function desdobrarLinhasVcf(texto) {
  const linhas = texto.split(/\r\n|\r|\n/);
  const resultado = [];
  for (const linha of linhas) {
    if ((linha.startsWith(" ") || linha.startsWith("\t")) && resultado.length) {
      resultado[resultado.length - 1] += linha.slice(1);
    } else if (linha.trim() !== "") {
      resultado.push(linha);
    }
  }
  return resultado;
}

// Separa "PROPRIEDADE;PARAM=X:valor" em { propriedade, params, valor }.
function separarLinhaVcf(linha) {
  const idxDoisPontos = linha.indexOf(":");
  if (idxDoisPontos === -1) return null;
  const chave = linha.slice(0, idxDoisPontos);
  const valor = linha.slice(idxDoisPontos + 1);
  const partes = chave.split(";");
  return { propriedade: partes[0].toUpperCase(), params: partes.slice(1).join(";").toUpperCase(), valor };
}

function parseVcf(texto) {
  const linhas = desdobrarLinhasVcf(texto);
  const cartoes = [];
  let atual = null;
  for (const linha of linhas) {
    const upper = linha.toUpperCase();
    if (upper === "BEGIN:VCARD") { atual = { telefones: [], emails: [] }; continue; }
    if (upper === "END:VCARD") { if (atual) cartoes.push(atual); atual = null; continue; }
    if (!atual) continue;
    const campo = separarLinhaVcf(linha);
    if (!campo) continue;
    const valor = campo.valor.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").trim();
    if (!valor) continue;
    switch (campo.propriedade) {
      case "FN": atual.nome = valor; break;
      case "N": if (!atual.nome) { const p = valor.split(";").filter(Boolean); atual.nome = p.slice(0, 2).reverse().join(" ").trim(); } break;
      case "TEL": atual.telefones.push(valor); break;
      case "EMAIL": atual.emails.push(valor); break;
      case "ORG": atual.empresa = valor.replace(/;+$/, "").replace(/;/g, " · "); break;
      case "TITLE": atual.cargo = valor; break;
      case "NOTE": atual.obs = valor; break;
    }
  }
  return cartoes
    .filter(c => c.nome || c.telefones.length || c.emails.length)
    .map(c => ({
      nome: c.nome || c.telefones[0] || c.emails[0] || "(sem nome)",
      telefone: c.telefones[0] || "",
      email: c.emails[0] || "",
      empresa: [c.cargo, c.empresa].filter(Boolean).join(" — "),
      obs: c.obs || ""
    }));
}

function jaExisteContato(c) {
  const tel = (c.telefone || "").replace(/\D/g, "");
  return contatos.some(x =>
    (x.nome || "").trim().toLowerCase() === (c.nome || "").trim().toLowerCase() ||
    (tel && (x.telefone || "").replace(/\D/g, "") === tel)
  );
}

function renderImportar() {
  const contagemMarcados = contatosImportados.filter(c => c.marcado).length;
  $("imp-contagem").textContent = contagemMarcados + " de " + contatosImportados.length + " selecionados";
  $("imp-importar").style.display = contatosImportados.length ? "" : "none";
  $("imp-lista").innerHTML = contatosImportados.map((c, i) => `
    <label class="card imp-item">
      <input type="checkbox" data-imp="${i}" ${c.marcado ? "checked" : ""} />
      <div class="info"><b>${escHtml(c.nome)}</b>
        <small>${escHtml([c.empresa, c.telefone, c.email].filter(Boolean).join(" · ")) || "&nbsp;"}</small>
        ${c.duplicado ? '<small class="imp-duplicado">Já existe um contato parecido</small>' : ""}
      </div>
    </label>`).join("");
}

$("abrir-importar").onclick = () => {
  contatosImportados = [];
  $("imp-vazio").style.display = "none";
  $("imp-topo").style.display = "none";
  $("imp-marcar-todos").checked = false;
  $("imp-lista").innerHTML = "";
  $("imp-importar").style.display = "none";
  $("modal-importar").classList.add("aberto");
};
$("imp-cancelar").onclick = () => $("modal-importar").classList.remove("aberto");
$("escolher-vcf").onclick = () => $("arquivo-vcf").click();

$("arquivo-vcf").onchange = async e => {
  const arquivo = e.target.files[0];
  e.target.value = "";
  if (!arquivo) return;
  const texto = await arquivo.text();
  const encontrados = parseVcf(texto).map(c => ({ ...c, marcado: false, duplicado: jaExisteContato(c) }));
  contatosImportados = encontrados;
  $("imp-vazio").style.display = encontrados.length ? "none" : "";
  $("imp-topo").style.display = encontrados.length ? "flex" : "none";
  renderImportar();
};

$("imp-marcar-todos").onchange = e => {
  contatosImportados.forEach(c => c.marcado = e.target.checked);
  renderImportar();
};
$("imp-lista").onclick = e => {
  const chk = e.target.closest("[data-imp]");
  if (!chk) return;
  contatosImportados[Number(chk.dataset.imp)].marcado = chk.checked;
  renderImportar();
};
$("imp-importar").onclick = async () => {
  const selecionados = contatosImportados.filter(c => c.marcado);
  if (!selecionados.length) { alert("Marque ao menos um contato."); return; }
  for (const c of selecionados) {
    await col.salvar(null, { nome: c.nome, telefone: c.telefone, email: c.email, empresa: c.empresa, obs: c.obs });
  }
  $("modal-importar").classList.remove("aberto");
  alert(selecionados.length + " contato(s) importado(s).");
};
