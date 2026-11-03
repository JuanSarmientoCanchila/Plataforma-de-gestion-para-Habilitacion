// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Cuenta de usuario y guardado en la nube (Supabase) ----------
// En la nube solo viaja texto (la evaluación). Los archivos de evidencia nunca salen del computador.

let supa = null;
let usuario = null; // usuario con sesión iniciada

function iniciarNube() {
  if (typeof supabase === "undefined" || !supabase.createClient) throw new Error('No se encontró la librería "supabase.js".');
  supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return supa;
}

// Traduce los errores más comunes a mensajes claros
function mensajeError(error) {
  const m = ((error && error.message) || "").toLowerCase();
  if (!m) return "Ocurrió un error inesperado.";
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered")) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo: revisa tu bandeja de entrada (y el correo no deseado).";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (m.includes("password") && m.includes("least")) return "La contraseña es demasiado corta.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) return "Sin conexión con el servidor. Revisa tu internet.";
  if (m.includes("same password") || m.includes("different from the old")) return "La nueva contraseña debe ser distinta de la anterior.";
  return error.message;
}

const URL_RETORNO = () => location.origin + location.pathname;

async function entrar(correo, clave) {
  const { error } = await supa.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw new Error(mensajeError(error));
}
async function salir() {
  await supa.auth.signOut();
}
async function pedirRecuperacion(correo) {
  const { error } = await supa.auth.resetPasswordForEmail(correo, { redirectTo: URL_RETORNO() });
  if (error) throw new Error(mensajeError(error));
}
async function cambiarClave(clave) {
  const { error } = await supa.auth.updateUser({ password: clave });
  if (error) throw new Error(mensajeError(error));
}

// ---- Evaluaciones ----
// Si todavía no se ejecutó supabase-dashboard.sql, la columna "resumen" no existe: la app sigue funcionando sin dashboard
let hayResumen = true;
const sinColumnaResumen = (error) => error && (error.code === "42703" || error.code === "PGRST204" || /resumen/i.test(error.message || ""));
async function listarNube() {
  const consulta = (cols) => supa.from("evaluaciones").select(cols).order("actualizado", { ascending: false });
  let { data, error } = await consulta(hayResumen ? "id,nombre,sede,actualizado,resumen" : "id,nombre,sede,actualizado");
  if (error && hayResumen && sinColumnaResumen(error)) {
    hayResumen = false;
    ({ data, error } = await consulta("id,nombre,sede,actualizado"));
  }
  if (error) throw new Error(mensajeError(error));
  return data;
}
// Rol del usuario ("ips" o "consultor"). Lo define el administrador en la tabla "perfiles"; si no se puede leer, es "ips".
async function leerRol() {
  try {
    const { data, error } = await supa.from("perfiles").select("rol").eq("user_id", usuario.id).maybeSingle();
    if (!error && data && data.rol === "consultor") return "consultor";
  } catch (e) { /* sin perfil: se trata como IPS */ }
  return "ips";
}
async function leerNube(id) {
  const { data, error } = await supa.from("evaluaciones").select("datos").eq("id", id).single();
  if (error) throw new Error(mensajeError(error));
  return data.datos;
}
async function borrarNube(id) {
  const { error } = await supa.from("evaluaciones").delete().eq("id", id);
  if (error) throw new Error(mensajeError(error));
}
// Guarda (crea o actualiza) la evaluación abierta. Devuelve la fecha de actualización del servidor.
async function guardarEnNube() {
  const fila = { id: estado.id, user_id: usuario.id, nombre: estado.ips.nombre || "", sede: estado.ips.sede || "", datos: estado };
  if (hayResumen) fila.resumen = calcularResumen();
  let { data, error } = await supa.from("evaluaciones").upsert(fila).select("actualizado").single();
  if (error && hayResumen && sinColumnaResumen(error)) {
    hayResumen = false;
    delete fila.resumen;
    ({ data, error } = await supa.from("evaluaciones").upsert(fila).select("actualizado").single());
  }
  if (error) {
    const e = new Error(mensajeError(error));
    e.codigo = error.code;
    throw e;
  }
  return data.actualizado;
}
