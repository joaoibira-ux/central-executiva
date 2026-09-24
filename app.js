const VERSAO_CENTRAL = "1.29";

const usaFirebase = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && typeof firebase !== "undefined");
let db = null;
if (usaFirebase) {
  firebase.initializeApp(window.FIREBASE_CONFIG);
  db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
}

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

// Camada de dados: Firestore quando configurado, localStorage caso contrário.
function colecao(nome) {
  if (usaFirebase) {
    const c = db.collection(nome);
    return {
      ouvir: cb => c.onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      salvar: (id, obj) => id ? c.doc(id).set(obj, { merge: true }) : c.add({ ...obj, criadoEm: new Date().toISOString() }),
      remover: id => c.doc(id).delete()
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