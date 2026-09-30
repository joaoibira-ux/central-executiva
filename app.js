const VERSAO_CENTRAL = "1.40";

const usaFirebase = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && typeof firebase !== "undefined");
let db = null;
let auth = null;
if (usaFirebase) {
  firebase.initializeApp(window.FIREBASE_CONFIG);
  db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  auth = firebase.auth();
}

// Login obrigatório + isolamento total por usuário: cada conta só enxerga os
// próprios dados, guardados em usuarios/{uid}/... — nunca em coleções soltas
// (2026-09-26, a pedido do João: "nada pode ser usado para todos"). Toda
// página exceto login.html redireciona pra lá se não houver ninguém logado.
// `prontoAuth` resolve com o uid (ou null em modo local) assim que o estado
// de login é conhecido — colecao() espera por ele antes de tocar no Firestore.
let uidAtual = null;
const NA_TELA_DE_LOGIN = /(^|\/)login\.html$/.test(location.pathname);
const prontoAuth = new Promise(resolve => {
  if (!auth) { resolve(null); return; }
  const cancelar = auth.onAuthStateChanged(user => {
    cancelar();
    if (!user && !NA_TELA_DE_LOGIN) { location.replace("./login.html"); return; }
    uidAtual = user ? user.uid : null;
    resolve(uidAtual);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("versao-app");
  if (el) el.textContent = "Versão: " + VERSAO_CENTRAL + (usaFirebase ? "" : " · modo local");
});

// O sistema só funciona instalado na tela de início — evita uso solto pelo navegador.
function estaInstalado() {
  return window.navigator.standalone === true
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.matchMedia("(display-mode: window-controls-overlay)").matches;
}

function mostrarAvisoInstalar() {
  const ua = navigator.userAgent || "";
  const iOS = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const passos = iOS ? [
    "Toque no ícone de compartilhar (quadrado com seta para cima) na barra do Safari.",
    "Escolha “Adicionar à Tela de Início”.",
    "Toque em “Adicionar” no canto superior direito."
  ] : android ? [
    "Toque no menu (⋮) no canto do navegador.",
    "Escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.",
    "Confirme a instalação."
  ] : [
    "Abra este endereço no Chrome ou Edge do computador.",
    "Clique no ícone de instalar (⊕) na barra de endereço.",
    "Confirme a instalação do aplicativo."
  ];
  const div = document.createElement("div");
  div.className = "aviso-instalar";
  div.innerHTML =
    '<div class="aviso-caixa">' +
      '<img src="./icone.svg" class="aviso-logo" alt="" />' +
      "<h2>Instale a Central Executiva</h2>" +
      "<p>Este sistema só funciona instalado na tela de início do seu aparelho.</p>" +
      "<ol>" + passos.map(p => "<li>" + escHtml(p) + "</li>").join("") + "</ol>" +
      '<p class="aviso-rodape">Depois de instalar, abra sempre pelo ícone criado — não pelo navegador.</p>' +
    "</div>";
  document.body.appendChild(div);
  document.body.style.overflow = "hidden";
}

document.addEventListener("DOMContentLoaded", () => {
  if (!estaInstalado()) mostrarAvisoInstalar();
});

// Bug de renderização confirmado neste navegador: uma caixa de modal com
// "max-width" maior que a largura da tela (então nunca chega a restringir,
// caso comum no celular, onde a tela é sempre menor que os 560px do CSS) faz
// parágrafos longos vazarem para fora da tela em vez de quebrar a linha. A
// correção é dar um "max-width" em pixels sempre menor que a tela atual,
// direto no elemento, assim que o modal abre.
function ajustarLarguraModal(caixa) {
  caixa.style.maxWidth = Math.min(560, window.innerWidth - 32) + "px";
}
function ajustarModaisAbertos() {
  document.querySelectorAll(".modal.aberto .caixa").forEach(ajustarLarguraModal);
}
document.addEventListener("DOMContentLoaded", () => {
  new MutationObserver(muts => {
    muts.forEach(m => {
      const alvo = m.target;
      if (alvo.classList.contains("modal") && alvo.classList.contains("aberto")) {
        const caixa = alvo.querySelector(".caixa");
        if (caixa) ajustarLarguraModal(caixa);
      }
    });
  }).observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  window.addEventListener("resize", ajustarModaisAbertos);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
      .then(reg => {
        reg.update();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update();
        });
      })
      .catch(() => {});
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

// Atualização forçada: no iPhone o fluxo padrão de Service Worker (o Safari
// só rechecar o sw.js de tempos em tempos) demora demais pra pegar versão
// nova — já ficou "engasgado" numa versão antiga. Em vez de depender só
// disso, comparamos com um arquivo separado (version.json, sempre buscado
// sem cache) a cada abertura e ao voltar pro app; se estiver desatualizado,
// apaga tudo (Service Worker + caches) e recarrega do zero.
async function verificarVersaoNova() {
  try {
    const r = await fetch("./version.json", { cache: "no-store" });
    const { versao } = await r.json();
    if (versao && versao !== VERSAO_CENTRAL) {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      }
      if (window.caches) {
        const nomes = await caches.keys();
        await Promise.all(nomes.map(n => caches.delete(n)));
      }
      window.location.replace(window.location.pathname + "?atualizado=" + Date.now());
    }
  } catch (e) { /* offline ou version.json indisponível no momento — ignora */ }
}
document.addEventListener("DOMContentLoaded", verificarVersaoNova);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") verificarVersaoNova();
});

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- Alarme de compromissos + indicador de pendência no ícone (2026-09-29) ----------
// Roda em toda página (app.js é global). Não é notificação push de verdade (site
// estático, sem servidor) — só dispara enquanto o app está aberto, mesmo limite já
// aceito no lembrete de parabéns de Datas importantes.
// No iPhone (Safari/PWA), um AudioContext só toca de verdade se foi criado/retomado
// dentro de um gesto do usuário (toque) — criado direto num setTimeout/setInterval
// (como o alarme dispara), ele fica mudo e sem erro nenhum. Por isso criamos UM
// contexto compartilhado, destravado no primeiro toque na tela, e reaproveitamos
// (com resume()) toda vez que o alarme precisa tocar depois. Mesmo assim, o
// interruptor físico de silencioso do iPhone ainda pode mudar o som (limite do
// Safari, sem contorno confiável).
let audioCtxCompartilhado = null;
function destravarAudio() {
  if (!audioCtxCompartilhado) {
    try { audioCtxCompartilhado = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (audioCtxCompartilhado.state === "suspended") audioCtxCompartilhado.resume().catch(() => {});
}
// Sem "once": cada página é um carregamento novo (site não é SPA), então o toque
// que destravou o áudio numa tela não vale pra outra — e o iOS também pode suspender
// o contexto de novo depois de bloquear a tela, então vale reforçar a cada toque.
["touchstart", "click", "pointerdown"].forEach(evento => {
  document.addEventListener(evento, destravarAudio, { passive: true });
});

function tocarAlarmeSom() {
  try {
    destravarAudio();
    const ctx = audioCtxCompartilhado;
    if (!ctx) return;
    [0, 220].forEach(atraso => {
      setTimeout(() => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = 880;
        gain.gain.setValueAtTime(.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + .35);
      }, atraso);
    });
  } catch (e) { /* navegador sem suporte a áudio ou bloqueado — ignora */ }
}
function mostrarAlarmeBanner(compromisso) {
  const div = document.createElement("div");
  div.className = "alarme-banner alarme-banner-clicavel";
  div.innerHTML = `<span>⏰ <b>${escHtml(compromisso.titulo)}</b> é agora${compromisso.local ? " · " + escHtml(compromisso.local) : ""} — toque para silenciar</span>`;
  tocarAlarmeSom();
  const intervalo = setInterval(tocarAlarmeSom, 5000);
  div.onclick = () => { clearInterval(intervalo); div.remove(); };
  document.body.appendChild(div);
}
function idsJaAlertadosHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const salvo = JSON.parse(localStorage.getItem("central_alarmes_disparados") || "{}");
    return salvo.dia === hoje ? new Set(salvo.ids) : new Set();
  } catch (e) { return new Set(); }
}
function marcarAlertado(id) {
  const jaAlertados = idsJaAlertadosHoje();
  jaAlertados.add(id);
  localStorage.setItem("central_alarmes_disparados", JSON.stringify({ dia: new Date().toISOString().slice(0, 10), ids: [...jaAlertados] }));
}
function atualizarBadgeAgenda(lista) {
  const link = document.querySelector('a[href="./agenda.html"]');
  if (!link) return;
  const hojeISO = new Date().toISOString().slice(0, 10);
  const pendentes = lista.filter(i => !i.feito && i.data && i.data <= hojeISO).length;
  let badge = link.querySelector(".badge-pendencia");
  if (pendentes > 0) {
    if (!badge) { badge = document.createElement("span"); badge.className = "badge-pendencia"; link.appendChild(badge); }
    badge.textContent = pendentes > 9 ? "9+" : String(pendentes);
  } else if (badge) {
    badge.remove();
  }
}
let __agendaParaAlarme = [];
function checarAlarmes() {
  const agora = new Date();
  const hojeISO = agora.toISOString().slice(0, 10);
  const jaAlertados = idsJaAlertadosHoje();
  __agendaParaAlarme.forEach(i => {
    if (i.feito || i.data !== hojeISO || !i.hora || jaAlertados.has(i.id)) return;
    const [h, m] = i.hora.split(":").map(Number);
    const alvo = new Date(); alvo.setHours(h, m, 0, 0);
    const diffMin = (agora - alvo) / 60000;
    if (diffMin >= 0 && diffMin <= 5) { marcarAlertado(i.id); mostrarAlarmeBanner(i); }
  });
}
if (typeof colecao === "function") {
  colecao("agenda").ouvir(lista => {
    __agendaParaAlarme = lista;
    atualizarBadgeAgenda(lista);
    checarAlarmes();
  });
  setInterval(checarAlarmes, 60000);
}

// ---------- Notificações push (alarme de verdade, mesmo com app fechado/tela
// bloqueada — 2026-09-30). O beep acima só funciona com a página aberta; isto
// aqui é entregue pelo sistema operacional, disparado por uma rotina na VM
// (ver CLAUDE.md), então precisa de permissão do usuário e de uma inscrição
// (pushSubscription) salva no perfil (usuarios/{uid}). Chave pública VAPID —
// só a privada (na VM) é secreta.
const VAPID_PUBLIC = "BI-QNNigJ-E46OdtwXJtK1DVyILMXRmKeGPYJqsO4RSkYCHHHFqZU7v7tq-meBJa35jNy2c998nWKgf0j4dlSPo";
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function salvarInscricaoPush(sub) {
  const uid = await prontoAuth;
  if (!uid) return;
  await db.collection("usuarios").doc(uid).set({ pushSubscription: sub.toJSON() }, { merge: true });
}
async function ativarNotificacoes() {
  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
    await salvarInscricaoPush(sub);
    localStorage.setItem("central_push_ativo", "1");
    const banner = document.getElementById("aviso-notificacoes");
    if (banner) banner.remove();
  } catch (e) { /* navegador sem suporte, ou usuário recusou — ignora */ }
}
function mostrarConviteNotificacoes() {
  if (document.getElementById("aviso-notificacoes")) return;
  const div = document.createElement("div");
  div.id = "aviso-notificacoes";
  div.className = "alarme-banner";
  div.innerHTML = `<span>🔔 Ativar notificações do alarme de compromissos?</span><button type="button" id="btn-ativar-notif" class="btn mini">Ativar</button><button type="button" id="btn-fechar-notif" aria-label="Fechar">×</button>`;
  div.querySelector("#btn-ativar-notif").onclick = ativarNotificacoes;
  div.querySelector("#btn-fechar-notif").onclick = () => { div.remove(); localStorage.setItem("central_push_dispensado", "1"); };
  document.body.appendChild(div);
}
if (usaFirebase && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window && !NA_TELA_DE_LOGIN) {
  prontoAuth.then(uid => {
    if (!uid) return;
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready.then(async reg => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) salvarInscricaoPush(sub);
      });
    } else if (Notification.permission === "default" && !localStorage.getItem("central_push_dispensado")) {
      // Não dá pra esperar "DOMContentLoaded" aqui: como prontoAuth é assíncrono
      // (espera o Firebase Auth resolver), esse evento normalmente já disparou
      // faz tempo quando este .then() roda — o listener nunca seria chamado.
      if (document.body) mostrarConviteNotificacoes();
      else document.addEventListener("DOMContentLoaded", mostrarConviteNotificacoes);
    }
  });
}

// Camada de dados: Firestore (isolado por usuário) quando configurado, localStorage
// caso contrário. Todo acesso ao Firestore espera o login resolver primeiro.
function colecao(nome) {
  if (usaFirebase) {
    const ref = () => db.collection("usuarios").doc(uidAtual).collection(nome);
    return {
      ouvir: cb => {
        prontoAuth.then(uid => { if (uid) ref().onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })))); });
      },
      salvar: async (id, obj) => {
        const uid = await prontoAuth;
        if (!uid) return;
        return id ? ref().doc(id).set(obj, { merge: true }) : ref().add({ ...obj, criadoEm: new Date().toISOString() });
      },
      remover: async id => {
        const uid = await prontoAuth;
        if (!uid) return;
        return ref().doc(id).delete();
      }
    };
  }
  const chave = "central_" + nome;
  const ler = () => { try { return JSON.parse(localStorage.getItem(chave)) || []; } catch (e) { return []; } };
  const gravar = l => localStorage.setItem(chave, JSON.stringify(l));
  const ouvintes = [];
  const avisar = () => ouvintes.forEach(cb => cb(ler()));
  return {
    ouvir: cb => { ouvintes.push(cb); cb(ler()); },
    salvar: (id, obj) => {
      const l = ler();
      if (id) { const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = { ...l[i], ...obj }; }
      else l.push({ ...obj, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), criadoEm: new Date().toISOString() });
      gravar(l); avisar(); return Promise.resolve();
    },
    remover: id => { gravar(ler().filter(x => x.id !== id)); avisar(); return Promise.resolve(); }
  };
}