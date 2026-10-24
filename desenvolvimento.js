const col = colecao("desenvolvimento");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
let anexosEditando = [];
const $ = id => document.getElementById(id);

// ---------- Anexos (mesmo padrão da Agenda — ver agenda.js: base64 embutido
// no próprio documento, sem Firebase Storage, comprimindo fotos até caber). ----------
const LIMITE_ANEXO = 450 * 1024;
const LIMITE_TOTAL_ANEXOS = 900 * 1024;

function lerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error("Não foi possível ler \"" + file.name + "\"."));
    leitor.readAsDataURL(file);
  });
}

function comprimirImagem(dataUrlOriginal, maxDim, qualidade) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", qualidade));
    };
    img.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    img.src = dataUrlOriginal;
  });
}

async function processarArquivo(file) {
  const ehImagem = file.type.startsWith("image/");
  let dados = await lerComoDataURL(file);
  if (ehImagem) {
    const tentativas = [[1600, .75], [1200, .6], [900, .5], [700, .4], [500, .35]];
    for (const [maxDim, qualidade] of tentativas) {
      if (dados.length <= LIMITE_ANEXO) break;
      dados = await comprimirImagem(dados, maxDim, qualidade);
    }
  }
  if (dados.length > LIMITE_ANEXO) {
    throw new Error(
      '"' + file.name + '" ficou grande demais mesmo comprimido (' + Math.round(dados.length / 1024) + "KB). " +
      (ehImagem ? "Tente outra foto." : "PDFs grandes não cabem — tente um arquivo menor ou uma versão compactada.")
    );
  }
  return { nome: file.name, tipo: file.type || "application/octet-stream", tamanho: dados.length, dados };
}

function renderAnexosEdicao() {
  $("f-anexos-lista").innerHTML = anexosEditando.map((a, i) => `
    <div class="anexo-item">
      ${a.tipo.startsWith("image/") ? `<img src="${a.dados}" class="anexo-miniatura" />` : `<span class="anexo-icone">📄</span>`}
      <span class="anexo-nome">${escHtml(a.nome)}</span>
      <button type="button" class="anexo-remover" data-rem="${i}" aria-label="Remover anexo">×</button>
    </div>`).join("");
}

function renderAnexosVisualizacao(anexos) {
  if (!anexos || !anexos.length) return `<span class="ver-vazio">Toque para adicionar</span>`;
  return `<div class="anexos-lista">` + anexos.map(a => `
    <a href="${a.dados}" ${a.tipo.startsWith("image/") ? "target=\"_blank\" rel=\"noopener\"" : `download="${escHtml(a.nome)}"`} class="anexo-item" onclick="event.stopPropagation()">
      ${a.tipo.startsWith("image/") ? `<img src="${a.dados}" class="anexo-miniatura" />` : `<span class="anexo-icone">📄</span>`}
      <span class="anexo-nome">${escHtml(a.nome)}</span>
    </a>`).join("") + `</div>`;
}

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
  // Concluídos saem da lista principal (vão para desenvolvimento-concluidos.html) —
  // só ficam aqui durante a janela de 2s da animação de check (atrasoDescida).
  const l = itens
    .filter(i => i.status !== "concluido" || atrasoDescida.has(i.id))
    .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  let html = "";
  l.forEach(i => {
    html += `<div class="card ${i.status === "concluido" ? "feito" : ""}" data-id="${i.id}">
      <input type="checkbox" ${i.status === "concluido" ? "checked" : ""} data-feito="${i.id}" />
      <div class="info"><b>${escHtml(i.texto)}</b>
        <small>Desde ${escHtml(fmtDataHora(i.criadoEm))}</small></div>
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
  $("ver-anexos").innerHTML = renderAnexosVisualizacao(i.anexos);
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
  anexosEditando = i?.anexos ? [...i.anexos] : [];
  renderAnexosEdicao();
  $("modal").classList.add("aberto");
  const campoParaInput = { texto: "f-texto", nota: "f-nota" };
  if (focoCampo !== "anexos") {
    const alvo = $(campoParaInput[focoCampo] || "f-texto");
    alvo.focus();
    if (alvo.select) alvo.select();
  }
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

$("escolher-anexo").onclick = () => $("f-anexo").click();
$("f-anexo").onchange = async e => {
  const arquivos = Array.from(e.target.files);
  e.target.value = "";
  for (const file of arquivos) {
    try {
      const anexo = await processarArquivo(file);
      const totalAtual = anexosEditando.reduce((s, a) => s + a.tamanho, 0);
      if (totalAtual + anexo.tamanho > LIMITE_TOTAL_ANEXOS) {
        alert("Não cabe mais: os anexos deste item já somam quase o limite (" + Math.round(LIMITE_TOTAL_ANEXOS / 1024) + "KB). Remova algum anexo antes de adicionar outro.");
        continue;
      }
      anexosEditando.push(anexo);
    } catch (err) {
      alert(err.message);
    }
  }
  renderAnexosEdicao();
};
$("f-anexos-lista").onclick = e => {
  const btn = e.target.closest("[data-rem]");
  if (!btn) return;
  anexosEditando.splice(Number(btn.dataset.rem), 1);
  renderAnexosEdicao();
};

// Não espera a gravação confirmar antes de fechar (ver mesmo padrão em
// agenda.js) — esperar causava telas de "Salvar" que pareciam travadas no
// iPhone, mesmo a gravação completando normalmente.
$("salvar").onclick = () => {
  const texto = $("f-texto").value.trim();
  if (!texto) { alert("Descreva o item."); return; }
  const dados = { texto, notaConclusao: $("f-nota").value.trim(), anexos: anexosEditando };
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
