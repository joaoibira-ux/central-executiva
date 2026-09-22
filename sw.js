const VERSION = "central-v7";
const ASSETS = [
  "./index.html",
  "./contatos.html",
  "./agenda.html",
  "./style.css?v=5",
  "./app.js?v=2",
  "./contatos.js?v=1",
  "./agenda.js?v=2",
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
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});