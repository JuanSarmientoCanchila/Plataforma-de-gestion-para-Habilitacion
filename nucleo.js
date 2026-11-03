// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Núcleo: estado, alcance y cálculos (sin tocar la pantalla) ----------

const I = { id: 0, hoja: 1, serv: 2, std: 3, num: 4, texto: 5, ctx: 6, enc: 7 };
const ETIQUETA = { c: "Cumple", n: "No cumple", na: "No aplica", sr: "Sin revisar" };
const DEL_TEXTO = { Cumple: "c", "No cumple": "n", "No aplica": "na", "Sin revisar": "sr" };

const POR_SERV = SERVICIOS.map(() => []);
REQUISITOS.forEach((r) => POR_SERV[r[I.serv]].push(r));
const POR_ID = new Map(REQUISITOS.map((r) => [r[I.id], r]));
const IDX_111 = SERVICIOS.findIndex((s) => s.cod === "11.1");

function fechaLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const h = (k) => Array.from({ length: k }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${h(8)}-${h(4)}-4${h(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${h(3)}-${h(12)}`;
}

function nuevoEstado() {
  return {
    id: uuid(), // identifica esta evaluación (también la carpeta de evidencias en este equipo)
    ips: { nombre: "", sede: "", reps: "", fecha: fechaLocal(), evaluador: "" },
    alcance: { servicios: [], estandares: ESTANDARES.map((_, i) => i), incluirTodos: true },
    perfiles: {}, // cod servicio -> { comp: [], mod: [], proyecto: false }
    verTodos: false,
    carpeta: "", // nombre de la carpeta de evidencias (solo informativo)
    resp: {}, // id -> { e, motivo, obs, evid, resp, fecha }
  };
}
// Completa lo que falte en copias guardadas por versiones anteriores
function normalizarEstado(e) {
  if (!e.id) e.id = uuid();
  if (!e.perfiles || typeof e.perfiles !== "object") e.perfiles = {};
  e.verTodos = e.verTodos === true;
  if (typeof e.carpeta !== "string") e.carpeta = "";
  return e;
}
let estado = nuevoEstado();

function respuesta(id) {
  return estado.resp[id] || null;
}
function estadoDe(id) {
  const r = estado.resp[id];
  return r && r.e ? r.e : "sr";
}
function campo(id, nombre, valor) {
  if (!estado.resp[id]) estado.resp[id] = { e: "", motivo: "", obs: "", evid: "", resp: "", fecha: "" };
  estado.resp[id][nombre] = valor;
}
function limpiarVacia(id) {
  const r = estado.resp[id];
  if (r && !r.e && !r.motivo && !r.obs && !r.evid && !r.resp && !r.fecha) delete estado.resp[id];
}

// ---- Perfil por servicio: complejidad y modalidades ----
const COMPLEJIDADES = ["baja", "mediana", "alta"];
const MODALIDADES = {
  I: "Intramural",
  EM: "Extramural – unidad móvil",
  EJ: "Extramural – jornada de salud",
  ED: "Extramural – domiciliaria",
  EX: "Extramural",
  TR: "Telemedicina – prestador remisor",
  TF: "Telemedicina – prestador de referencia",
  T: "Telemedicina",
};
const ORDEN_MOD = Object.keys(MODALIDADES);
const EXTRA = ["EM", "EJ", "ED"];
const TELE = ["TR", "TF"];

function perfil(cod) {
  return estado.perfiles[cod] || { comp: [], mod: [], proyecto: false };
}
function esProyecto(si) {
  return si !== IDX_111 && perfil(SERVICIOS[si].cod).proyecto === true;
}
// Opciones que existen en la norma para ese servicio
function opcionesServicio(si) {
  const comp = new Set();
  const mod = new Set();
  POR_SERV[si].forEach((r) => {
    const m = CTX_META[r[I.ctx]];
    if (m.c) m.c.forEach((x) => comp.add(x));
    if (m.m) m.m.forEach((x) => mod.add(x));
  });
  return {
    comp: COMPLEJIDADES.filter((c) => comp.has(c)),
    mod: ORDEN_MOD.filter((x) => mod.has(x)),
  };
}
// Dos modalidades "coinciden" si son iguales o una es la versión general de la otra
function coincideMod(a, b) {
  if (a === b) return true;
  if (a === "EX") return EXTRA.includes(b);
  if (b === "EX") return EXTRA.includes(a);
  if (a === "T") return TELE.includes(b);
  if (b === "T") return TELE.includes(a);
  return false;
}
function algunaCoincide(listaA, listaB) {
  return listaA.some((a) => listaB.some((b) => coincideMod(a, b)));
}
// Modalidades elegidas en todos los servicios del alcance (para los criterios del 11.1)
function contextoPerfil() {
  const glob = new Set();
  serviciosActivos().forEach((si) => {
    if (si !== IDX_111) perfil(SERVICIOS[si].cod).mod.forEach((m) => glob.add(m));
  });
  return { glob: [...glob] };
}
function aplicaPerfil(r, cp) {
  const m = CTX_META[r[I.ctx]];
  if (r[I.serv] === IDX_111) return !(cp.glob.length && m.m) || algunaCoincide(m.m, cp.glob);
  const p = perfil(SERVICIOS[r[I.serv]].cod);
  if (p.comp.length && m.c && !m.c.some((c) => p.comp.includes(c))) return false;
  if (p.mod.length && m.m && !algunaCoincide(m.m, p.mod)) return false;
  return true;
}

// ---- Alcance ----
function serviciosActivos() {
  const a = estado.alcance;
  const lista = [];
  if (a.incluirTodos) lista.push(IDX_111);
  SERVICIOS.forEach((s, i) => {
    if (i !== IDX_111 && a.servicios.includes(s.cod)) lista.push(i);
  });
  return lista;
}
function serviciosProyecto() {
  return serviciosActivos().filter(esProyecto);
}
function serviciosHabilitados() {
  return serviciosActivos().filter((si) => !esProyecto(si));
}
// Filas del servicio dentro del alcance. Con "todas" no se aplica el perfil.
function filasDeServicio(si, todas = false) {
  const stds = estado.alcance.estandares;
  const base = POR_SERV[si].filter((r) => stds.includes(r[I.std]));
  if (todas) return base;
  const cp = contextoPerfil();
  const ok = base.map((r) => r[I.enc] || aplicaPerfil(r, cp));
  return base.filter((r, k) => {
    if (!r[I.enc]) return ok[k];
    if (!ok[k]) return false;
    // un encabezado solo se muestra si alguno de sus criterios hijos se muestra
    const pref = r[I.num] + ".";
    for (let j = k + 1; j < base.length && base[j][I.num].startsWith(pref); j++) {
      if (!base[j][I.enc] && ok[j]) return true;
    }
    return false;
  });
}
// Criterios del alcance que se cuentan: servicios habilitados (incluye 11.1)
function filasAlcance() {
  return serviciosHabilitados().flatMap((si) => filasDeServicio(si));
}
// Criterios evaluables de todo el alcance, habilitados y en proyecto
function filasEvaluables() {
  return serviciosActivos().flatMap((si) => filasDeServicio(si));
}

// ---- Cálculos ----
// Cumplimiento = Cumple / (Cumple + No cumple + Sin revisar). "No aplica" sale del denominador.
function calcular(filas) {
  const t = { c: 0, n: 0, na: 0, sr: 0, total: 0, aplicables: 0, pct: null, avance: null, naSinMotivo: 0 };
  filas.forEach((r) => {
    if (r[I.enc]) return;
    const e = estadoDe(r[I.id]);
    t[e]++;
    t.total++;
    if (e === "na" && !(estado.resp[r[I.id]].motivo || "").trim()) t.naSinMotivo++;
  });
  t.aplicables = t.c + t.n + t.sr;
  t.pct = t.aplicables > 0 ? t.c / t.aplicables : null;
  t.avance = t.total > 0 ? (t.total - t.sr) / t.total : null;
  return t;
}
function pctTexto(x) {
  return x === null ? "—" : `${Math.round(x * 100)} %`;
}

// Matriz servicio × estándar para el resumen. Los servicios en proyecto van aparte
function matriz() {
  const stds = estado.alcance.estandares.slice().sort((a, b) => a - b);
  const filaDe = (si) => ({
    serv: SERVICIOS[si],
    celdas: stds.map((s) => calcular(filasDeServicio(si).filter((r) => r[I.std] === s))),
    total: calcular(filasDeServicio(si)),
  });
  const hab = serviciosHabilitados();
  const porEst = stds.map((s) => calcular(hab.flatMap((si) => filasDeServicio(si).filter((r) => r[I.std] === s))));
  return { stds, filas: hab.map(filaDe), proyecto: serviciosProyecto().map(filaDe), porEst, global: calcular(filasAlcance()) };
}

function brechas() {
  return filasAlcance().filter((r) => !r[I.enc] && estadoDe(r[I.id]) === "n");
}
function noAplica() {
  return filasAlcance().filter((r) => !r[I.enc] && estadoDe(r[I.id]) === "na");
}
function profundidad(num) {
  return num.split(".").length - 1;
}
function nombreServ(si) {
  const s = SERVICIOS[si];
  return `${s.cod} ${s.nombre}`;
}
