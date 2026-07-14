// Service worker — precache app shell ทั้งหมด ใช้ offline ได้เต็มตัว
// เปลี่ยนไฟล์เมื่อไหร่ให้ bump VERSION เพื่อบังคับ cache ใหม่

const VERSION = "pp-os-v3";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/desktop.css",
  "./css/window.css",
  "./css/taskbar.css",
  "./css/apps.css",
  "./js/main.js",
  "./js/core/window-manager.js",
  "./js/core/taskbar.js",
  "./js/core/app-registry.js",
  "./js/core/storage.js",
  "./js/apps/notes.js",
  "./js/apps/todo.js",
  "./js/apps/health.js",
  "./js/apps/weather.js",
  "./js/apps/money.js",
  "./js/apps/calculator.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/fonts/ibm-plex-sans-thai-600-thai.woff2",
  "./assets/fonts/ibm-plex-sans-thai-600-latin.woff2",
  "./assets/fonts/ibm-plex-sans-thai-700-thai.woff2",
  "./assets/fonts/ibm-plex-sans-thai-700-latin.woff2",
  "./assets/fonts/sarabun-400-thai.woff2",
  "./assets/fonts/sarabun-400-latin.woff2",
  "./assets/fonts/sarabun-600-thai.woff2",
  "./assets/fonts/sarabun-600-latin.woff2",
  "./assets/fonts/ibm-plex-mono-500-latin.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
