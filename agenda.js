const col = colecao("agenda");
let itens = [];
let editandoId = null;
let veiodaVisualizacao = false;
let anexosEditando = [];
const $ = id => document.getElementById(id);

// ---------- Anexos (guardados como base64 dentro do próprio documento no
// Firestore — sem Firebase Storage, que passou a cobrar/exigir plano pago
// pra ser ativado). Fotos de celular vêm grandes (vários MB): comprime até
// caber num limite seguro. Um documento no Firestore tem no máximo ~1MB;
// por isso o limite por arquivo e a soma de todos os anexos são bem menores.
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
  $("ver-anexos").innerHTML = renderAnexosVisualizacao(i.anexos);
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
  anexosEditando = i?.anexos ? [...i.anexos] : [];
  renderAnexosEdicao();
  $("modal").classList.add("aberto");
  const campoParaInput = { titulo: "f-titulo", data: "f-data", local: "f-local", obs: "f-obs" };
  if (focoCampo !== "anexos") {
    const alvo = $(campoParaInput[focoCampo] || "f-titulo");
    alvo.focus();
    if (alvo.select) alvo.select();
  }
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

$("escolher-anexo").onclick = () => $("f-anexo").click();
$("f-anexo").onchange = async e => {
  const arquivos = Array.from(e.target.files);
  e.target.value = "";
  for (const file of arquivos) {
    try {
      const anexo = await processarArquivo(file);
      const totalAtual = anexosEditando.reduce((s, a) => s + a.tamanho, 0);
      if (totalAtual + anexo.tamanho > LIMITE_TOTAL_ANEXOS) {
        alert("Não cabe mais: os anexos deste compromisso já somam quase o limite (" + Math.round(LIMITE_TOTAL_ANEXOS / 1024) + "KB). Remova algum anexo antes de adicionar outro.");
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

$("salvar").onclick = async () => {
  const titulo = $("f-titulo").value.trim(), data = $("f-data").value;
  if (!titulo || !data) { alert("Informe título e data."); return; }
  const dados = { titulo, data, hora: $("f-hora").value, local: $("f-local").value.trim(), obs: $("f-obs").value.trim(), anexos: anexosEditando };
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
