const VERSION = "central-v39";
const ASSETS = [
  "./index.html",
  "./contatos.html",
  "./agenda.html",
  "./agenda-concluidos.html",
  "./importar.html",
  "./desenvolvimento.html",
  "./datas.html",
  "./login.html",
  "./style.css?v=24",
  "./app.js?v=26",
  "./contatos.js?v=5",
  "./agenda.js?v=5",
  "./agenda-concluidos.js?v=1",
  "./importar.js?v=1",
  "./desenvolvimento.js?v=1",
  "./datas.js?v=3",
  "./login.js?v=2",
  "./firebase-config.js?v=1",
  "./manifest.json",
  "./icone.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("firestore.googleapis.com") || e.request.url.includes("gstatic.com")) return;
  if (e.request.url.includes("version.json")) return; // sempre rede, nunca cache — usado p/ detectar versão nova
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// ---------- Alarme de compromissos via Web Push (2026-09-30) ----------
// Disparado por uma rotina na VM (ver CLAUDE.md) — funciona mesmo com o app
// fechado/tela bloqueada, ao contrário do beep em página aberta (limitado no iOS).
self.addEventListener("push", e => {
  let dados = { title: "⏰ Central Executiva", body: "Você tem um compromisso agora." };
  try { if (e.data) dados = e.data.json(); } catch (err) { /* mantém padrão */ }
  e.waitUntil(self.registration.showNotification(dados.title, {
    body: dados.body,
    icon: "./icone.svg",
    badge: "./icone.svg",
    tag: dados.tag || "alarme-agenda"
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
      const existente = lista.find(c => c.url.includes("agenda"));
      if (existente) return existente.focus();
      return self.clients.openWindow("./agenda.html");
    })
  );
});