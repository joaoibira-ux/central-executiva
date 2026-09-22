const VERSAO_CENTRAL = "1.02";

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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

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