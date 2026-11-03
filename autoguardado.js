// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// Autoguardado en el navegador (localStorage). No reemplaza al Excel.
// La copia local es por usuario: en un equipo compartido nadie ve lo de otro
const claveGuardado = () => "verificador3100:autoguardado" + (typeof usuario !== "undefined" && usuario ? ":" + usuario.id : "");
const VERSION_GUARDADO = 1;
const ESTADOS_OK = ["c", "n", "na"];

function estadoValido(e) {
  if (!e || e.version !== VERSION_GUARDADO) return false;
  const s = e.estado;
  if (!s || typeof s.ips !== "object" || s.ips === null) return false;
  const a = s.alcance;
  if (!a || !Array.isArray(a.servicios) || !Array.isArray(a.estandares) || typeof a.incluirTodos !== "boolean") return false;
  if (!a.servicios.every((c) => SERVICIOS.some((x) => x.cod === c))) return false;
  if (!a.estandares.every((i) => Number.isInteger(i) && i >= 0 && i < ESTANDARES.length)) return false;
  if (typeof s.resp !== "object" || s.resp === null) return false;
  if (s.perfiles !== undefined && !perfilesValidos(s.perfiles)) return false;
  return Object.entries(s.resp).every(
    ([id, r]) => POR_ID.has(id) && r && (r.e === "" || ESTADOS_OK.includes(r.e)) &&
      ["motivo", "obs", "evid", "resp", "fecha"].every((k) => typeof r[k] === "string")
  );
}
function perfilesValidos(p) {
  if (typeof p !== "object" || p === null) return false;
  return Object.entries(p).every(
    ([cod, x]) => SERVICIOS.some((s) => s.cod === cod) && x && Array.isArray(x.comp) && Array.isArray(x.mod) &&
      x.comp.every((c) => COMPLEJIDADES.includes(c)) && x.mod.every((m) => m in MODALIDADES) && typeof x.proyecto === "boolean"
  );
}
function guardarCopia(sinExportar) {
  try {
    localStorage.setItem(claveGuardado(), JSON.stringify({ version: VERSION_GUARDADO, guardado: Date.now(), sinExportar, estado }));
    return true;
  } catch (error) {
    return false;
  }
}
function leerCopia() {
  try {
    const texto = localStorage.getItem(claveGuardado());
    if (!texto) return null;
    const c = JSON.parse(texto);
    if (!estadoValido(c)) return null;
    normalizarEstado(c.estado);
    return c;
  } catch (error) {
    return null;
  }
}
function borrarCopia() {
  try { localStorage.removeItem(claveGuardado()); } catch (error) { /* sin almacenamiento */ }
}
