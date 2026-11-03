// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// Service worker: permite instalar la app y abrirla sin conexión.
// Estrategia "red primero": si hay internet siempre se usa la versión más nueva; si no, la copia guardada.
const VERSION = "v3";
const CACHE = "verificador3100-" + VERSION;
const BASE = ["./", "index.html", "style.css", "requisitos.js", "nucleo.js", "evidencias.js", "autoguardado.js",
  "exportar.js", "importar.js", "informe.js", "app.js", "nube.js", "resumen.js", "dashboard.js", "config.js", "supabase.js", "exceljs.min.js", "docx.iife.js", "manifest.webmanifest", "icono-192.png", "icono-512.png"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("verificador3100-")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
