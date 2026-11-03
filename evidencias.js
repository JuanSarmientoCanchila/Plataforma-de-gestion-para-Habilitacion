// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Evidencias en una carpeta del computador (File System Access API) ----------
// Los archivos NO se suben a ningún servidor: se copian a una carpeta que el usuario elige,
// organizados así:  <carpeta>/<código del servicio>/<n.º del criterio>_<ID>/<archivo>
// Solo funciona en Chrome y Edge de escritorio.

const SOPORTA_CARPETA = typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
let carpetaRaiz = null; // FileSystemDirectoryHandle
let permisoCarpeta = "sin"; // "sin" | "ok" | "pendiente"
const CACHE_EVID = new Map(); // id del criterio -> [{ nombre, tamano }]

// ---- Guardar el acceso a la carpeta entre sesiones (IndexedDB) ----
function abrirDB() {
  return new Promise((ok, mal) => {
    const q = indexedDB.open("verificador3100", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("carpetas");
    q.onsuccess = () => ok(q.result);
    q.onerror = () => mal(q.error);
  });
}
async function dbHacer(modo, fn) {
  const db = await abrirDB();
  return new Promise((ok, mal) => {
    const t = db.transaction("carpetas", modo);
    const r = fn(t.objectStore("carpetas"));
    t.oncomplete = () => { db.close(); ok(r && r.result); };
    t.onerror = () => { db.close(); mal(t.error); };
  });
}
const guardarHandle = (id, h) => dbHacer("readwrite", (s) => s.put(h, id));
const leerHandle = (id) => dbHacer("readonly", (s) => s.get(id));

// ---- Conexión con la carpeta ----
async function iniciarCarpeta() {
  carpetaRaiz = null;
  permisoCarpeta = "sin";
  CACHE_EVID.clear();
  if (!SOPORTA_CARPETA) return;
  try {
    const h = await leerHandle(estado.id);
    if (!h) return;
    carpetaRaiz = h;
    const p = await h.queryPermission({ mode: "readwrite" });
    permisoCarpeta = p === "granted" ? "ok" : "pendiente";
    if (!estado.carpeta) estado.carpeta = h.name;
  } catch (error) {
    carpetaRaiz = null;
  }
}
async function elegirCarpeta() {
  const h = await window.showDirectoryPicker({ id: "verificador3100", mode: "readwrite" });
  carpetaRaiz = h;
  permisoCarpeta = "ok";
  estado.carpeta = h.name;
  CACHE_EVID.clear();
  try { await guardarHandle(estado.id, h); } catch (error) { /* se pedirá de nuevo la próxima vez */ }
}
async function reconectarCarpeta() {
  if (!carpetaRaiz) return;
  const p = await carpetaRaiz.requestPermission({ mode: "readwrite" });
  permisoCarpeta = p === "granted" ? "ok" : "pendiente";
}

// ---- Rutas ----
const limpiarNombre = (t) => t.replace(/[\\/:*?"<>|]/g, "_").trim();
function carpetaCriterio(r) {
  return limpiarNombre(`${r[I.num]}_${r[I.id]}`);
}
async function dirCriterio(r, crear) {
  const sv = await carpetaRaiz.getDirectoryHandle(limpiarNombre(SERVICIOS[r[I.serv]].cod), { create: crear });
  return sv.getDirectoryHandle(carpetaCriterio(r), { create: crear });
}

// ---- Operaciones ----
async function listarEvidencias(r) {
  if (permisoCarpeta !== "ok") return [];
  const lista = [];
  try {
    const d = await dirCriterio(r, false);
    for await (const e of d.values()) {
      if (e.kind === "file") lista.push({ nombre: e.name, tamano: (await e.getFile()).size });
    }
  } catch (error) {
    if (error.name !== "NotFoundError") throw error;
  }
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  CACHE_EVID.set(r[I.id], lista);
  return lista;
}
async function nombreLibre(dir, nombre) {
  const punto = nombre.lastIndexOf(".");
  const base = punto > 0 ? nombre.slice(0, punto) : nombre;
  const ext = punto > 0 ? nombre.slice(punto) : "";
  for (let n = 1; n < 1000; n++) {
    const candidato = n === 1 ? nombre : `${base} (${n})${ext}`;
    try { await dir.getFileHandle(candidato); } catch (error) { if (error.name === "NotFoundError") return candidato; throw error; }
  }
  throw new Error("Demasiados archivos con el mismo nombre.");
}
async function adjuntarEvidencias(r, archivos) {
  const d = await dirCriterio(r, true);
  for (const f of archivos) {
    const nombre = await nombreLibre(d, limpiarNombre(f.name) || "archivo");
    const h = await d.getFileHandle(nombre, { create: true });
    const w = await h.createWritable();
    await w.write(f);
    await w.close();
  }
  return listarEvidencias(r);
}
async function abrirEvidencia(r, nombre) {
  const d = await dirCriterio(r, false);
  const archivo = await (await d.getFileHandle(nombre)).getFile();
  const url = URL.createObjectURL(archivo);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
async function quitarEvidencia(r, nombre) {
  const d = await dirCriterio(r, false);
  await d.removeEntry(nombre);
  return listarEvidencias(r);
}
// Cuenta los archivos de todo un servicio de una sola vez (para las marcas 📎 de la lista)
async function cargarServicioEvidencias(si) {
  if (permisoCarpeta !== "ok") return;
  const filas = POR_SERV[si].filter((r) => !r[I.enc]);
  filas.forEach((r) => CACHE_EVID.set(r[I.id], []));
  let sv;
  try { sv = await carpetaRaiz.getDirectoryHandle(limpiarNombre(SERVICIOS[si].cod)); } catch (error) { return; }
  const porNombre = new Map(filas.map((r) => [carpetaCriterio(r), r[I.id]]));
  for await (const sub of sv.values()) {
    if (sub.kind !== "directory" || !porNombre.has(sub.name)) continue;
    const lista = [];
    for await (const e of sub.values()) if (e.kind === "file") lista.push({ nombre: e.name, tamano: 0 });
    CACHE_EVID.set(porNombre.get(sub.name), lista);
  }
}
function tamanoLegible(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
