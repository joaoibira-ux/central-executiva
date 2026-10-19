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

// Ao marcar como concluído, o item continua no lugar por 2s (dá tempo de ver o
// check acontecer) e só então desce pro fim do dia dele na lista.
const atrasoDescida = new Map(); // id -> setTimeout, enquanto o item ainda não deve "descer"

function render() {
  // Compromissos concluídos saem da lista principal (vão para agenda-concluidos.html) —
  // só ficam aqui durante a janela de 2s da animação de check (atrasoDescida).
  // Itens sem "data" são pendências (ver pendencias.html) — a mesma coleção serve os
  // dois: sem data+hora é pendência, com data+hora vira registro de agenda.
  const l = itens
    .filter(i => i.data && (!i.feito || atrasoDescida.has(i.id)))
    .sort((a, b) => {
      if (a.data !== b.data) return (a.data || "").localeCompare(b.data || "");
      return (a.hora || "").localeCompare(b.hora || "");
    });
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
  if (chk) {
    const id = chk.dataset.feito;
    col.salvar(id, { feito: chk.checked });
    clearTimeout(atrasoDescida.get(id));
    if (chk.checked) {
      atrasoDescida.set(id, setTimeout(() => { atrasoDescida.delete(id); render(); }, 2000));
    } else {
      atrasoDescida.delete(id); // desmarcar volta pro lugar na hora, sem atraso
    }
    return;
  }
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

// O Firestore (com persistência offline) já grava local na hora e sincroniza
// sozinho depois — não tem por que travar a tela esperando a promessa do
// col.salvar() resolver. Fazer isso causava telas de "Salvar" que pareciam
// travadas no iPhone (a gravação completava de verdade, só a promessa
// demorava demais pra "retornar" no JS da página). Agora fecha na hora e só
// avisa depois, em segundo plano, se realmente der erro.
$("salvar").onclick = () => {
  const titulo = $("f-titulo").value.trim(), data = $("f-data").value;
  if (!titulo) { alert("Informe o título."); return; }
  // Data é opcional aqui: salvar sem data faz o item virar pendência (ver
  // pendencias.html) — mesma coleção, só muda o filtro de cada tela.
  // alarmeContagem:0 garante que editar data/hora rearma os reenvios do alarme por push (VM).
  const dados = { titulo, data, hora: $("f-hora").value, local: $("f-local").value.trim(), obs: $("f-obs").value.trim(), anexos: anexosEditando, alarmeContagem: 0, alarmeVisto: false, telegramEnviado: false, whatsappEnviado: false };
  // Só em criação: em edição não pode sobrescrever "feito" de um item já concluído.
  if (!editandoId) dados.feito = false;
  const idSalvo = editandoId;
  col.salvar(idSalvo, dados).catch(e => alert("Não deu pra salvar: " + e.message));
  fechar();
  if (veiodaVisualizacao) {
    const feitoAtual = itens.find(x => x.id === idSalvo)?.feito;
    visualizar({ id: idSalvo, feito: feitoAtual, ...dados });
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

// ---------- Interpretação de data/hora faladas (fluxo de voz abaixo) ----------
// Best-effort: cobre os jeitos mais comuns de falar, não é um parser completo.
// Se não entender, retorna null e quem chamou decide o que fazer (não avança).
const MESES_FALADOS = { janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const DIAS_SEMANA_FALADOS = { domingo: 0, segunda: 1, "segunda-feira": 1, "terça": 2, terca: 2, "terça-feira": 2, quarta: 3, "quarta-feira": 3, quinta: 4, "quinta-feira": 4, sexta: 5, "sexta-feira": 5, sabado: 6, "sábado": 6 };

function interpretarDataFalada(texto) {
  const t = (texto || "").trim().toLowerCase().replace(/[.,]/g, "");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const paraISO = d => d.toISOString().slice(0, 10);
  if (/depois de amanh[ãa]/.test(t)) return paraISO(new Date(hoje.getTime() + 2 * 864e5));
  if (/amanh[ãa]/.test(t)) return paraISO(new Date(hoje.getTime() + 864e5));
  if (/^hoje$/.test(t)) return paraISO(hoje);
  for (const nome in DIAS_SEMANA_FALADOS) {
    if (t.includes(nome)) {
      const d = new Date(hoje);
      do { d.setDate(d.getDate() + 1); } while (d.getDay() !== DIAS_SEMANA_FALADOS[nome]);
      return paraISO(d);
    }
  }
  const mBarra = t.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
  if (mBarra) {
    const dia = Number(mBarra[1]), mes = Number(mBarra[2]);
    let d = new Date(hoje.getFullYear(), mes - 1, dia);
    if (d < hoje) d = new Date(hoje.getFullYear() + 1, mes - 1, dia);
    if (!isNaN(d) && d.getDate() === dia) return paraISO(d);
  }
  const mNomeMes = t.match(/(\d{1,2})\s*(?:de\s*)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);
  if (mNomeMes) {
    const dia = Number(mNomeMes[1]), mes = MESES_FALADOS[mNomeMes[2]];
    let d = new Date(hoje.getFullYear(), mes - 1, dia);
    if (d < hoje) d = new Date(hoje.getFullYear() + 1, mes - 1, dia);
    if (!isNaN(d) && d.getDate() === dia) return paraISO(d);
  }
  const mSoDia = t.match(/dia\s*(\d{1,2})/);
  if (mSoDia) {
    const dia = Number(mSoDia[1]);
    let d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (d < hoje) d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
    if (!isNaN(d) && d.getDate() === dia) return paraISO(d);
  }
  return null;
}

function interpretarHoraFalada(texto) {
  const t = (texto || "").trim().toLowerCase().replace(/[.,]/g, "");
  if (/meio\s*dia/.test(t)) return "12:00";
  if (/meia\s*noite/.test(t)) return "00:00";
  let h = null, m = 0;
  const mHM = t.match(/(\d{1,2})\s*[:h]\s*(\d{2})?/);
  if (mHM) { h = Number(mHM[1]); m = mHM[2] ? Number(mHM[2]) : 0; }
  else {
    const mSo = t.match(/(\d{1,2})\s*horas?/);
    if (mSo) h = Number(mSo[1]);
  }
  if (h === null) return null;
  if (/e\s*meia/.test(t)) m = 30;
  else if (/e\s*quinze/.test(t)) m = 15;
  const tarde = /tarde/.test(t), noite = /noite/.test(t), manha = /manh[ãa]/.test(t);
  if ((tarde || noite) && h < 12) h += 12;
  if (manha && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// ---------- Acesso rápido por voz (?voz=1 na URL, link do menu principal) ----------
// Abre direto "Novo compromisso" com Título focado. iPhone/Safari não suporta Web
// Speech API — o usuário dita pelo microfone do próprio teclado do iOS (sempre
// disponível em campo de texto) e toca "próximo"/"concluído" no teclado pra avançar.
// Data e Hora viram campos de TEXTO nesse modo (o seletor nativo de data/hora não
// tem teclado nem microfone) — ao avançar, o texto falado é interpretado
// (interpretarDataFalada/interpretarHoraFalada) e convertido de volta pro tipo
// nativo. Terminando a hora, salva e fecha sozinho.
if (new URLSearchParams(location.search).get("voz")) {
  veiodaVisualizacao = false;
  abrir(null);
  const campoTitulo = $("f-titulo"), campoData = $("f-data"), campoHora = $("f-hora");
  campoData.value = ""; // sem sugerir "hoje" — por voz, vira pendência se não der data

  campoTitulo.setAttribute("enterkeyhint", "next");
  campoData.setAttribute("type", "text");
  campoData.setAttribute("placeholder", "Fale a data: hoje, amanhã, dia 20...");
  campoData.setAttribute("enterkeyhint", "next");
  campoHora.setAttribute("type", "text");
  campoHora.setAttribute("placeholder", "Fale a hora: 15h, 3 da tarde...");
  campoHora.setAttribute("enterkeyhint", "done");

  function aoConfirmarCampo(campo, fn) {
    campo.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); fn(); }
    });
  }
  aoConfirmarCampo(campoTitulo, () => campoData.focus());
  aoConfirmarCampo(campoData, () => {
    const iso = interpretarDataFalada(campoData.value);
    if (!iso) { alert('Não entendi a data — tente "hoje", "amanhã" ou "dia 20".'); return; }
    campoData.setAttribute("type", "date");
    campoData.value = iso;
    campoHora.focus();
  });
  aoConfirmarCampo(campoHora, () => {
    const texto = campoHora.value.trim();
    if (!texto) { campoHora.setAttribute("type", "time"); campoHora.value = ""; $("salvar").click(); return; }
    const hhmm = interpretarHoraFalada(texto);
    if (!hhmm) { alert('Não entendi a hora — tente "15h", "3 da tarde" ou "15:30".'); return; }
    campoHora.setAttribute("type", "time");
    campoHora.value = hhmm;
    $("salvar").click();
  });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = e => { campoTitulo.value = Array.from(e.results).map(r => r[0].transcript).join(""); };
      rec.start();
    } catch (e) { /* microfone negado ou API indisponível — campo já fica focado */ }
  }
}
