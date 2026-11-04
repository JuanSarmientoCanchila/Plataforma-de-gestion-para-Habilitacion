// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Pantalla: conecta el estado con la página ----------
const $ = (id) => document.getElementById(id);
function crear(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

let vista = "lista";
let servActual = null;
let hayCambios = false;
let temporizador = null;

// ---------- Guardado automático (copia local + nube) ----------
// "hayCambios" significa: hay cambios que todavía no llegaron a la nube.
let contadorCambios = 0;
let temporizadorNube = null;
let guardandoNube = false;
let nubeEstado = ""; // "" | "pendiente" | "guardando" | "ok" | "offline" | "error"
let nubeHora = "";
let nubeError = "";
let reintento = null;
const horaActual = () => new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

function cambio() {
  hayCambios = true;
  contadorCambios++;
  clearTimeout(temporizador);
  temporizador = setTimeout(guardarAhora, 800);
  programarNube();
}
function guardarAhora() {
  clearTimeout(temporizador);
  temporizador = null;
  if (!usuario) return;
  if (!guardarCopia(hayCambios) && !nubeEstado) nubeEstado = "error", nubeError = "No se pudo guardar en el navegador.";
  pintarEstado();
}
function pintarEstado() {
  const t = {
    "": "", pendiente: "Cambios sin guardar en la nube…", guardando: "☁ Guardando…", ok: `☁ Guardado en la nube ${nubeHora}`,
    offline: "⚠ Sin conexión: guardado solo en este equipo; se enviará al reconectar",
    error: `⚠ No se pudo guardar en la nube: ${nubeError}`,
  };
  $("guardado").textContent = t[nubeEstado];
  $("guardado").classList.toggle("mal", nubeEstado === "error" || nubeEstado === "offline");
}
function programarNube() {
  if (!usuario) return;
  clearTimeout(temporizadorNube);
  temporizadorNube = setTimeout(sincronizarNube, 2000);
  if (nubeEstado !== "guardando") nubeEstado = "pendiente";
  pintarEstado();
}
async function sincronizarNube() {
  clearTimeout(temporizadorNube);
  if (!usuario || !hayCambios) return;
  if (guardandoNube) { programarNube(); return; }
  guardandoNube = true;
  nubeEstado = "guardando";
  pintarEstado();
  const version = contadorCambios;
  try {
    await guardarEnNube();
    if (contadorCambios === version) hayCambios = false; // si cambió mientras guardaba, sigue pendiente
    nubeEstado = "ok";
    nubeHora = horaActual();
    guardarCopia(hayCambios);
  } catch (error) {
    if (error.codigo === "42501") {
      // Ese identificador pertenece a otra cuenta: esta evaluación pasa a ser una copia propia
      estado.id = uuid();
      await iniciarCarpeta();
      dibujarCarpeta();
      guardandoNube = false;
      programarNube();
      return;
    }
    nubeEstado = navigator.onLine ? "error" : "offline";
    nubeError = error.message;
    guardarCopia(true);
    clearTimeout(reintento);
    reintento = setTimeout(() => { if (hayCambios) sincronizarNube(); }, 15000);
  } finally {
    guardandoNube = false;
    pintarEstado();
  }
  if (hayCambios && nubeEstado === "ok") programarNube();
}
window.addEventListener("online", () => { if (hayCambios) sincronizarNube(); });
function marcarExportado() {
  guardarAhora();
}
window.addEventListener("pagehide", () => { if (temporizador) guardarAhora(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && temporizador) guardarAhora(); });
window.addEventListener("beforeunload", (ev) => {
  if (hayCambios && usuario) { ev.preventDefault(); ev.returnValue = ""; }
});

function mostrarMensajes(lista) {
  const c = $("mensajes");
  c.replaceChildren();
  if (!lista.length) return;
  const ul = crear("ul");
  lista.forEach((m) => ul.appendChild(crear("li", "", m)));
  c.appendChild(ul);
}

// ---------- Pestañas ----------
function irA(nombre) {
  vista = nombre;
  document.querySelectorAll(".pestana").forEach((b) => b.classList.toggle("activa", b.dataset.vista === nombre));
  ["lista", "dashboard", "alcance", "verificar", "resultados"].forEach((v) => ($("vista-" + v).hidden = v !== nombre));
  mostrarMensajes([]);
  if (nombre === "lista") dibujarLista();
  if (nombre === "dashboard") dibujarDashboard();
  if (nombre === "verificar") dibujarVerificar();
  if (nombre === "resultados") dibujarResultados();
}
document.querySelectorAll(".pestana").forEach((b) => b.addEventListener("click", () => irA(b.dataset.vista)));
$("ir-verificar").addEventListener("click", () => irA("verificar"));

// ---------- Vista 1: datos y alcance ----------
const CAMPOS_IPS = { nombre: "ips-nombre", sede: "ips-sede", reps: "ips-reps", fecha: "ips-fecha", evaluador: "ips-evaluador" };
Object.entries(CAMPOS_IPS).forEach(([k, id]) => $(id).addEventListener("input", () => { estado.ips[k] = $(id).value; cambio(); }));

function mostrarIps() {
  Object.entries(CAMPOS_IPS).forEach(([k, id]) => ($(id).value = estado.ips[k] || ""));
}

const gruposCerrados = new Set();

function dibujarAlcance() {
  $("norma-info").textContent = `Norma: ${NORMA.norma}. Versión cargada: ${NORMA.version}.`;
  const est = $("lista-estandares");
  est.replaceChildren();
  ESTANDARES.forEach((nombre, i) => {
    const l = crear("label", "check");
    const c = crear("input");
    c.type = "checkbox";
    c.dataset.std = i;
    c.checked = estado.alcance.estandares.includes(i);
    l.append(c, " ", nombre);
    est.appendChild(l);
  });
  $("incluir-todos").checked = estado.alcance.incluirTodos;

  const cont = $("lista-servicios");
  cont.replaceChildren();
  const grupos = [];
  SERVICIOS.forEach((s) => {
    if (s.cod === "11.1") return;
    let g = grupos.find((x) => x.nombre === s.grupo);
    if (!g) grupos.push((g = { nombre: s.grupo, lista: [] }));
    g.lista.push(s);
  });
  grupos.forEach((g) => {
    const d = crear("details");
    d.open = !gruposCerrados.has(g.nombre);
    d.addEventListener("toggle", () => (d.open ? gruposCerrados.delete(g.nombre) : gruposCerrados.add(g.nombre)));
    const sm = crear("summary");
    const gc = crear("input");
    gc.type = "checkbox";
    gc.dataset.grupo = g.nombre;
    gc.addEventListener("click", (ev) => ev.stopPropagation());
    sm.append(gc, " ", crear("strong", "", g.nombre));
    d.appendChild(sm);
    g.lista.forEach((s) => {
      const l = crear("label", "check serv");
      const c = crear("input");
      c.type = "checkbox";
      c.dataset.serv = s.cod;
      c.checked = estado.alcance.servicios.includes(s.cod);
      const n = crear("span", "ayuda");
      n.dataset.cuenta = s.cod;
      l.append(c, ` ${s.cod} ${s.nombre} `, n);
      d.appendChild(l);
      if (c.checked) d.appendChild(panelPerfil(SERVICIOS.indexOf(s)));
    });
    cont.appendChild(d);
  });
  actualizarAlcance();
}

// Panel de complejidad, modalidades y "en proyecto" de un servicio elegido
function panelPerfil(si) {
  const cod = SERVICIOS[si].cod;
  const p = perfil(cod);
  const op = opcionesServicio(si);
  const d = crear("div", "perfil");
  const grupo = (titulo, claves, nombres, lista, tipo) => {
    if (!claves.length) return;
    const f = crear("div", "perfil-fila");
    f.appendChild(crear("span", "perfil-tit", titulo));
    claves.forEach((k) => {
      const l = crear("label", "chip");
      const c = crear("input");
      c.type = "checkbox";
      c.dataset.p = tipo;
      c.dataset.cod = cod;
      c.dataset.val = k;
      c.checked = lista.includes(k);
      l.append(c, " ", nombres[k] || k.charAt(0).toUpperCase() + k.slice(1));
      f.appendChild(l);
    });
    d.appendChild(f);
  };
  grupo("Complejidad:", op.comp, {}, p.comp, "comp");
  grupo("Modalidad:", op.mod, MODALIDADES, p.mod, "mod");
  if (op.comp.length || op.mod.length) {
    d.appendChild(crear("p", "ayuda", "Marca solo lo que esta IPS tiene o piensa habilitar. Sin marcar = se muestran todos los criterios."));
  }
  const l = crear("label", "chip proyecto");
  const c = crear("input");
  c.type = "checkbox";
  c.dataset.p = "proy";
  c.dataset.cod = cod;
  c.checked = p.proyecto;
  l.append(c, " En proyecto: aún no está habilitado (no cuenta en el porcentaje global)");
  d.appendChild(l);
  return d;
}

function actualizarAlcance() {
  const stds = estado.alcance.estandares;
  const cuenta = (si) => filasDeServicio(si).filter((r) => !r[I.enc]).length;
  document.querySelectorAll("[data-cuenta]").forEach((e) => {
    const si = SERVICIOS.findIndex((s) => s.cod === e.dataset.cuenta);
    e.textContent = `(${cuenta(si)})`;
  });
  $("cuenta-111").textContent = `(${cuenta(IDX_111)})`;
  document.querySelectorAll("[data-grupo]").forEach((gc) => {
    const hijos = [...document.querySelectorAll("[data-serv]")].filter((c) => SERVICIOS.find((s) => s.cod === c.dataset.serv).grupo === gc.dataset.grupo);
    const marcados = hijos.filter((c) => c.checked).length;
    gc.checked = marcados === hijos.length;
    gc.indeterminate = marcados > 0 && marcados < hijos.length;
  });
  const activos = serviciosActivos();
  const total = activos.reduce((s, si) => s + cuenta(si), 0);
  const proy = serviciosProyecto().length;
  $("resumen-alcance").textContent =
    `En el alcance: ${activos.length} servicio(s)${proy ? ` (${proy} en proyecto)` : ""}, ${stds.length} estándar(es), ${total} criterios que le aplican a tu perfil.`;
}

$("lista-estandares").addEventListener("change", (ev) => {
  const i = Number(ev.target.dataset.std);
  const a = estado.alcance.estandares;
  if (ev.target.checked) { if (!a.includes(i)) a.push(i); } else estado.alcance.estandares = a.filter((x) => x !== i);
  actualizarAlcance();
  cambio();
});
$("incluir-todos").addEventListener("change", (ev) => {
  estado.alcance.incluirTodos = ev.target.checked;
  actualizarAlcance();
  cambio();
});
$("lista-servicios").addEventListener("change", (ev) => {
  const t = ev.target;
  const a = estado.alcance;
  if (t.dataset.p) {
    const cod = t.dataset.cod;
    const p = (estado.perfiles[cod] = { ...perfil(cod) });
    if (t.dataset.p === "proy") p.proyecto = t.checked;
    else {
      const lista = t.dataset.p === "comp" ? "comp" : "mod";
      p[lista] = t.checked ? [...p[lista], t.dataset.val] : p[lista].filter((x) => x !== t.dataset.val);
    }
    actualizarAlcance();
    cambio();
    return;
  }
  if (t.dataset.serv) {
    if (t.checked) { if (!a.servicios.includes(t.dataset.serv)) a.servicios.push(t.dataset.serv); }
    else a.servicios = a.servicios.filter((c) => c !== t.dataset.serv);
  } else if (t.dataset.grupo) {
    SERVICIOS.filter((s) => s.grupo === t.dataset.grupo).forEach((s) => {
      a.servicios = a.servicios.filter((c) => c !== s.cod);
      if (t.checked) a.servicios.push(s.cod);
    });
  }
  dibujarAlcance();
  cambio();
});
$("est-todos").addEventListener("click", () => { estado.alcance.estandares = ESTANDARES.map((_, i) => i); dibujarAlcance(); cambio(); });
$("est-ninguno").addEventListener("click", () => { estado.alcance.estandares = []; dibujarAlcance(); cambio(); });
$("serv-ninguno").addEventListener("click", () => { estado.alcance.servicios = []; estado.alcance.incluirTodos = false; dibujarAlcance(); cambio(); });

// ---------- Vista 2: verificación ----------
function dibujarVerificar() {
  const activos = serviciosActivos();
  if (!activos.length || !estado.alcance.estandares.length) {
    $("lateral").replaceChildren();
    $("requisitos").replaceChildren(crear("p", "ayuda", "Elige al menos un servicio y un estándar en el paso 1."));
    $("titulo-servicio").textContent = "";
    $("avance-servicio").textContent = "";
    return;
  }
  if (servActual === null || !activos.includes(servActual)) servActual = activos[0];
  const f = $("f-estandar");
  const previo = f.value;
  f.replaceChildren(new Option("Todos", ""));
  estado.alcance.estandares.slice().sort((a, b) => a - b).forEach((i) => f.add(new Option(ESTANDARES[i], String(i))));
  f.value = [...f.options].some((o) => o.value === previo) ? previo : "";
  dibujarLateral();
  dibujarRequisitos();
}

function dibujarLateral() {
  const lat = $("lateral");
  lat.replaceChildren();
  serviciosActivos().forEach((si) => {
    const t = calcular(filasDeServicio(si));
    const b = crear("button", "serv-nav" + (si === servActual ? " actual" : ""));
    b.type = "button";
    b.dataset.si = si;
    b.append(crear("span", "serv-cod", SERVICIOS[si].cod + (esProyecto(si) ? " · en proyecto" : "")), crear("span", "serv-nom", SERVICIOS[si].nombre));
    const barra = crear("span", "barra-av");
    const rel = crear("span");
    rel.style.width = `${Math.round((t.avance || 0) * 100)}%`;
    barra.appendChild(rel);
    b.append(barra, crear("span", "serv-pct", `Revisado ${pctTexto(t.avance)} · Cumple ${pctTexto(t.pct)}`));
    lat.appendChild(b);
  });
}
$("lateral").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-si]");
  if (!b) return;
  servActual = Number(b.dataset.si);
  dibujarLateral();
  dibujarRequisitos();
  window.scrollTo({ top: 0 });
});

let dentroIds = new Set(); // criterios que sí aplican al perfil del servicio actual

function filasVisibles() {
  const fs = $("f-estandar").value;
  const fe = $("f-estado").value;
  const ft = norm($("f-texto").value.trim());
  const filtrando = fe || ft;
  return filasDeServicio(servActual, estado.verTodos).filter((r) => {
    if (fs !== "" && r[I.std] !== Number(fs)) return false;
    if (r[I.enc]) return !filtrando;
    if (fe && (!dentroIds.has(r[I.id]) || estadoEfectivo(r[I.id]) !== fe)) return false;
    if (ft && !norm(r[I.num] + " " + r[I.texto]).includes(ft)) return false;
    return true;
  });
}

function dibujarRequisitos() {
  const si = servActual;
  $("titulo-servicio").textContent = nombreServ(si) + (esProyecto(si) ? " (en proyecto)" : "");
  const dentro = filasDeServicio(si);
  dentroIds = new Set(dentro.map((r) => r[I.id]));
  const ocultos = filasDeServicio(si, true).filter((r) => !r[I.enc] && !dentroIds.has(r[I.id])).length;
  $("ocultos").textContent = ocultos
    ? estado.verTodos
      ? `Se muestran ${ocultos} criterios que no aplican a tu perfil (en gris, sin casilla).`
      : `${ocultos} criterios no se muestran porque no aplican a la complejidad o modalidad elegida.`
    : "";
  $("ver-todos").checked = estado.verTodos;
  actualizarAvanceServicio();
  const filas = filasVisibles();
  const frag = document.createDocumentFragment();
  let std = null;
  filas.forEach((r) => {
    if (r[I.std] !== std) {
      std = r[I.std];
      frag.appendChild(crear("h3", "estandar", ESTANDARES[std]));
    }
    frag.appendChild(filaReq(r));
  });
  if (!filas.length) frag.appendChild(crear("p", "ayuda", "No hay requisitos con ese filtro."));
  $("requisitos").replaceChildren(frag);
  cargarClips();
}

function actualizarAvanceServicio() {
  const t = calcular(filasDeServicio(servActual));
  $("avance-servicio").textContent =
    `${t.total} criterios · Cumple ${t.c} · No cumple ${t.n} · No aplica ${t.na} · Sin revisar ${t.sr} · Cumplimiento ${pctTexto(t.pct)}`;
}

const BOTONES = [["c", "Cumple"], ["n", "No cumple"], ["na", "No aplica"]];

function filaReq(r, abrir) {
  const id = r[I.id];
  const padre = r[I.enc] ? null : ancestroNA(id);
  const e = padre ? "na" : estadoDe(id);
  const sangria = Math.min(profundidad(r[I.num]), 4) * 18;
  if (r[I.enc]) {
    const d = crear("div", "encabezado");
    d.style.marginLeft = sangria + "px";
    d.append(crear("span", "num", r[I.num]), crear("span", "", r[I.texto]));
    return d;
  }
  const fuera = estado.verTodos && !dentroIds.has(id);
  const d = crear("div", "req e-" + e + (fuera ? " fuera" : ""));
  d.dataset.id = id;
  d.style.marginLeft = sangria + "px";
  const cuerpo = crear("div", "cuerpo");
  const cab = crear("div", "linea");
  cab.append(crear("span", "num", r[I.num]), crear("span", "texto", r[I.texto]));
  cuerpo.appendChild(cab);
  const meta = crear("div", "meta");
  meta.appendChild(crear("span", "hoja", `hoja ${r[I.hoja]}`));
  if (r[I.ctx]) meta.appendChild(crear("span", "ctx", CONTEXTOS[r[I.ctx]]));
  const nArch = (CACHE_EVID.get(id) || []).length;
  if (nArch) meta.appendChild(crear("span", "clip", `📎 ${nArch}`));
  cuerpo.appendChild(meta);
  if (fuera) {
    d.appendChild(cuerpo);
    d.appendChild(crear("span", "ayuda", "No aplica a tu perfil"));
    return d;
  }
  if (padre) {
    d.classList.add("heredado");
    d.appendChild(cuerpo);
    d.appendChild(crear("span", "ayuda", `No aplica, porque el criterio ${padre[I.num]} no aplica`));
    return d;
  }
  const resp = respuesta(id);
  const tieneDatos = resp && (resp.obs || resp.evid || resp.motivo || resp.resp || resp.fecha);
  if (abrir || e === "n" || e === "na" || tieneDatos) cuerpo.appendChild(detalle(id, e));
  const botones = crear("div", "estados");
  BOTONES.forEach(([k, t]) => {
    const b = crear("button", "est est-" + k + (e === k ? " on" : ""), t);
    b.type = "button";
    b.dataset.set = k;
    b.setAttribute("aria-pressed", e === k);
    botones.appendChild(b);
  });
  const mas = crear("button", "mini", "Detalle");
  mas.type = "button";
  mas.dataset.mas = "1";
  botones.appendChild(mas);
  d.append(cuerpo, botones);
  return d;
}

function detalle(id, e) {
  const r = respuesta(id) || {};
  const d = crear("div", "detalle");
  const campoIn = (nombre, etiqueta, tipo, extra) => {
    const l = crear("label", extra || "");
    l.appendChild(crear("span", "", etiqueta));
    const x = tipo === "area" ? crear("textarea") : crear("input");
    if (tipo === "area") x.rows = 2; else x.type = tipo;
    x.value = r[nombre] || "";
    x.dataset.campo = nombre;
    l.appendChild(x);
    return [l, x];
  };
  if (e === "na") {
    const [l, x] = campoIn("motivo", "Motivo por el que no aplica (obligatorio)", "text", "ancho");
    x.classList.toggle("falta", !(r.motivo || "").trim());
    d.appendChild(l);
  }
  d.appendChild(campoIn("obs", "Observación", "area", "ancho")[0]);
  d.appendChild(campoIn("evid", "Evidencia (documento, registro, foto…)", "text", "ancho")[0]);
  if (e === "n") {
    d.appendChild(campoIn("resp", "Responsable", "text")[0]);
    d.appendChild(campoIn("fecha", "Fecha compromiso", "date")[0]);
  }
  d.appendChild(seccionArchivos(POR_ID.get(id)));
  return d;
}

// ---- Archivos de evidencia (carpeta local) ----
function seccionArchivos(r) {
  const s = crear("div", "archivos ancho");
  s.appendChild(crear("span", "arch-tit", "Archivos de evidencia (en la carpeta de este equipo)"));
  if (!SOPORTA_CARPETA) {
    s.appendChild(crear("p", "ayuda", "Tu navegador no permite usar una carpeta del computador. Abre la aplicación en Chrome o Edge."));
    return s;
  }
  if (permisoCarpeta !== "ok") {
    s.appendChild(crear("p", "ayuda", permisoCarpeta === "pendiente" ? "Reconecta la carpeta de evidencias (botón de arriba) para ver y adjuntar archivos." : "Elige primero la carpeta de evidencias (botón de arriba)."));
    return s;
  }
  const lista = crear("ul", "arch-lista");
  s.appendChild(lista);
  const entrada = crear("input");
  entrada.type = "file";
  entrada.multiple = true;
  entrada.hidden = true;
  const boton = crear("button", "mini", "Adjuntar archivos");
  boton.type = "button";
  boton.addEventListener("click", () => entrada.click());
  entrada.addEventListener("change", async () => {
    try {
      const nuevos = [...entrada.files];
      entrada.value = "";
      if (!nuevos.length) return;
      pintar(await adjuntarEvidencias(r, nuevos));
    } catch (error) {
      mostrarMensajes([`No se pudo adjuntar: ${error.message}`]);
    }
  });
  s.append(boton, entrada);
  function pintar(archivos) {
    lista.replaceChildren();
    if (!archivos.length) lista.appendChild(crear("li", "ayuda", "Sin archivos adjuntos."));
    archivos.forEach((a) => {
      const li = crear("li");
      const ver = crear("button", "enlace", a.nombre);
      ver.type = "button";
      ver.addEventListener("click", () => abrirEvidencia(r, a.nombre).catch((e) => mostrarMensajes([`No se pudo abrir: ${e.message}`])));
      const quitar = crear("button", "mini", "Quitar");
      quitar.type = "button";
      quitar.addEventListener("click", async () => {
        if (!confirm(`Se borrará "${a.nombre}" de la carpeta de evidencias. ¿Continuar?`)) return;
        try { pintar(await quitarEvidencia(r, a.nombre)); } catch (e) { mostrarMensajes([`No se pudo quitar: ${e.message}`]); }
      });
      li.append(ver, crear("span", "ayuda", ` ${tamanoLegible(a.tamano)} `), quitar);
      lista.appendChild(li);
    });
    marcarClip(r[I.id], archivos.length);
  }
  listarEvidencias(r).then(pintar).catch((e) => lista.replaceChildren(crear("li", "ayuda", `No se pudo leer la carpeta: ${e.message}`)));
  return s;
}
function marcarClip(id, n) {
  const fila = document.querySelector(`.req[data-id="${id}"] .meta`);
  if (!fila) return;
  fila.querySelector(".clip")?.remove();
  if (n) fila.appendChild(crear("span", "clip", `📎 ${n}`));
}

// ---- Barra de la carpeta de evidencias ----
function dibujarCarpeta() {
  const c = $("carpeta");
  c.replaceChildren();
  if (!SOPORTA_CARPETA) {
    c.appendChild(crear("span", "ayuda", "Evidencias en carpeta del computador: solo disponible en Chrome o Edge de escritorio."));
    return;
  }
  const b = (txt, fn) => {
    const x = crear("button", "mini", txt);
    x.type = "button";
    x.addEventListener("click", async () => {
      try { mostrarMensajes([]); await fn(); } catch (error) { if (error.name !== "AbortError") mostrarMensajes([error.message]); }
      dibujarCarpeta();
      if (vista === "verificar") { dibujarRequisitos(); cargarClips(); }
    });
    return x;
  };
  c.appendChild(crear("strong", "", "Carpeta de evidencias: "));
  if (permisoCarpeta === "ok") {
    c.append(crear("span", "", `${estado.carpeta} (conectada) `), b("Cambiar", elegirCarpeta));
  } else if (permisoCarpeta === "pendiente") {
    c.append(crear("span", "alerta-inline", `${estado.carpeta || "carpeta guardada"}: falta permiso `), b("Reconectar", reconectarCarpeta), b("Elegir otra", elegirCarpeta));
  } else {
    c.append(crear("span", "ayuda", "ninguna "), b("Elegir carpeta", elegirCarpeta));
  }
}
async function cargarClips() {
  if (permisoCarpeta !== "ok" || servActual === null) return;
  try {
    await cargarServicioEvidencias(servActual);
    document.querySelectorAll("#requisitos .req").forEach((f) => marcarClip(f.dataset.id, (CACHE_EVID.get(f.dataset.id) || []).length));
  } catch (error) { /* las marcas son opcionales */ }
}

function cambiarEstado(id, nuevo) {
  const e2 = estadoDe(id) === nuevo ? "" : nuevo === "sr" ? "" : nuevo;
  campo(id, "e", e2);
  limpiarVacia(id);
}

$("requisitos").addEventListener("click", (ev) => {
  const fila = ev.target.closest(".req");
  if (!fila) return;
  const id = fila.dataset.id;
  const b = ev.target.closest("[data-set]");
  if (b) {
    const antes = estadoDe(id);
    cambiarEstado(id, b.dataset.set);
    cambio();
    fila.replaceWith(filaReq(POR_ID.get(id), !!fila.querySelector(".detalle")));
    if (antes === "na" || estadoDe(id) === "na") {
      // los criterios que se desprenden de este se activan o se desactivan
      const pref = POR_ID.get(id)[I.num] + ".";
      $("requisitos").querySelectorAll(".req").forEach((x) => {
        const h = POR_ID.get(x.dataset.id);
        if (h && h[I.serv] === POR_ID.get(id)[I.serv] && h[I.num].startsWith(pref)) x.replaceWith(filaReq(h, false));
      });
    }
    actualizarAvanceServicio();
    dibujarLateral();
    return;
  }
  if (ev.target.closest("[data-mas]")) {
    const det = fila.querySelector(".detalle");
    if (det) det.remove();
    else fila.querySelector(".cuerpo").appendChild(detalle(id, estadoDe(id)));
  }
});
$("requisitos").addEventListener("input", (ev) => {
  const t = ev.target;
  if (!t.dataset.campo) return;
  const id = t.closest(".req").dataset.id;
  campo(id, t.dataset.campo, t.value);
  if (t.dataset.campo === "motivo") t.classList.toggle("falta", !t.value.trim());
  cambio();
});
$("ver-todos").addEventListener("change", (ev) => {
  estado.verTodos = ev.target.checked;
  cambio();
  dibujarRequisitos();
});
["f-estandar", "f-estado"].forEach((id) => $(id).addEventListener("change", dibujarRequisitos));
$("f-texto").addEventListener("input", dibujarRequisitos);
$("masivo").addEventListener("change", () => {
  const v = $("masivo").value;
  $("masivo").value = "";
  if (!v) return;
  const filas = filasVisibles().filter((r) => !r[I.enc] && dentroIds.has(r[I.id]) && !ancestroNA(r[I.id]));
  if (!filas.length) return;
  if (!confirm(`Se marcarán ${filas.length} requisitos visibles como "${ETIQUETA[v]}". ¿Continuar?`)) return;
  filas.forEach((r) => {
    campo(r[I.id], "e", v === "sr" ? "" : v);
    limpiarVacia(r[I.id]);
  });
  cambio();
  dibujarLateral();
  dibujarRequisitos();
});

// ---------- Vista 3: resultados y brechas ----------
function celdaPct(t) {
  const td = crear("td", "pct", t.total ? `${pctTexto(t.pct)}\n${t.c}/${t.aplicables}` : "—");
  if (t.pct !== null) td.classList.add(t.pct >= 1 ? "ok" : t.pct >= 0.8 ? "medio" : "bajo");
  return td;
}

function tablaMatriz(m, filas, conPie) {
  const envo = crear("div", "tabla-scroll");
  const tabla = crear("table", "matriz");
  const cab = tabla.createTHead().insertRow();
  cab.appendChild(crear("th", "", "Servicio"));
  m.stds.forEach((x) => cab.appendChild(crear("th", "num", ESTANDARES[x])));
  cab.appendChild(crear("th", "num", "Total"));
  const cuerpo = tabla.createTBody();
  filas.forEach((f) => {
    const tr = cuerpo.insertRow();
    tr.appendChild(crear("td", "", `${f.serv.cod} ${f.serv.nombre}`));
    f.celdas.forEach((c) => tr.appendChild(celdaPct(c)));
    tr.appendChild(celdaPct(f.total));
  });
  if (conPie) {
    const pie = tabla.createTFoot().insertRow();
    pie.appendChild(crear("td", "", "Todos los servicios"));
    m.porEst.forEach((c) => pie.appendChild(celdaPct(c)));
    pie.appendChild(celdaPct(m.global));
  }
  envo.appendChild(tabla);
  return envo;
}

function dibujarResultados() {
  const cont = $("resultados");
  cont.replaceChildren();
  const m = matriz();
  const g = m.global;
  if ((!m.filas.length && !m.proyecto.length) || !m.stds.length) {
    cont.appendChild(crear("p", "ayuda", "Define el alcance en el paso 1 para ver resultados."));
    return;
  }
  const tarjetas = crear("div", "tarjetas");
  [["Cumplimiento", pctTexto(g.pct)], ["Revisado", pctTexto(g.avance)], ["Cumple", g.c], ["No cumple", g.n], ["No aplica", g.na], ["Sin revisar", g.sr]].forEach(([t, v]) => {
    const c = crear("div", "tarjeta");
    c.append(crear("strong", "", String(v)), crear("span", "", t));
    tarjetas.appendChild(c);
  });
  cont.appendChild(tarjetas);
  const avisos = [];
  if (g.sr) avisos.push(`Hay ${g.sr} criterios sin revisar: cuentan como incumplidos en el porcentaje hasta que los revises.`);
  if (g.naSinMotivo) avisos.push(`Hay ${g.naSinMotivo} criterios "No aplica" sin motivo.`);
  avisos.forEach((a) => cont.appendChild(crear("p", "alerta", a)));

  cont.appendChild(crear("h3", "", "Cumplimiento por servicio y estándar"));
  cont.appendChild(tablaMatriz(m, m.filas, true));
  if (m.proyecto.length) {
    cont.appendChild(crear("h3", "", "Servicios en proyecto (no cuentan en el porcentaje global)"));
    cont.appendChild(tablaMatriz(m, m.proyecto, false));
  }

  // Brechas
  const br = brechas();
  cont.appendChild(crear("h3", "", br.length === 1 ? "Brechas (1 criterio que no cumple)" : `Brechas (${br.length} criterios que no cumplen)`));
  if (!br.length) cont.appendChild(crear("p", "ayuda", "No hay criterios marcados como \"No cumple\"."));
  else {
    const e2 = crear("div", "tabla-scroll");
    const t2 = crear("table", "brechas");
    const h = t2.createTHead().insertRow();
    ["Servicio", "Estándar", "N.º", "Requisito", "Observación", "Responsable", "Fecha compromiso"].forEach((x) => h.appendChild(crear("th", "", x)));
    const b2 = t2.createTBody();
    br.forEach((r) => {
      const tr = b2.insertRow();
      tr.dataset.id = r[I.id];
      tr.insertCell().textContent = SERVICIOS[r[I.serv]].cod;
      tr.insertCell().textContent = ESTANDARES[r[I.std]];
      tr.insertCell().textContent = r[I.num];
      tr.insertCell().textContent = r[I.texto];
      [["obs", "text"], ["resp", "text"], ["fecha", "date"]].forEach(([k, tipo]) => {
        const i = crear("input");
        i.type = tipo;
        i.value = (respuesta(r[I.id]) || {})[k] || "";
        i.dataset.campo = k;
        tr.insertCell().appendChild(i);
      });
    });
    e2.appendChild(t2);
    cont.appendChild(e2);
  }

  // No aplica
  const na = noAplica();
  if (na.length) {
    cont.appendChild(crear("h3", "", `Criterios que no aplican (${na.length})`));
    const e3 = crear("div", "tabla-scroll");
    const t3 = crear("table", "brechas");
    const h = t3.createTHead().insertRow();
    ["Servicio", "N.º", "Requisito", "Motivo"].forEach((x) => h.appendChild(crear("th", "", x)));
    const b3 = t3.createTBody();
    na.forEach((r) => {
      const tr = b3.insertRow();
      tr.dataset.id = r[I.id];
      tr.insertCell().textContent = SERVICIOS[r[I.serv]].cod;
      tr.insertCell().textContent = r[I.num];
      tr.insertCell().textContent = r[I.texto];
      const i = crear("input");
      i.type = "text";
      i.value = (respuesta(r[I.id]) || {}).motivo || "";
      i.dataset.campo = "motivo";
      i.classList.toggle("falta", !i.value.trim());
      tr.insertCell().appendChild(i);
    });
    e3.appendChild(t3);
    cont.appendChild(e3);
  }
}
$("resultados").addEventListener("input", (ev) => {
  const t = ev.target;
  const tr = t.closest("tr[data-id]");
  if (!tr || !t.dataset.campo) return;
  campo(tr.dataset.id, t.dataset.campo, t.value);
  if (t.dataset.campo === "motivo") t.classList.toggle("falta", !t.value.trim());
  cambio();
});

// ---------- Botones ----------
function conAviso(accion) {
  return async () => {
    try {
      mostrarMensajes([]);
      await accion();
    } catch (error) {
      mostrarMensajes([error.message]);
    }
  };
}
$("exportar").addEventListener("click", conAviso(async () => { await exportarExcel(); marcarExportado(); }));
$("exportar-word").addEventListener("click", conAviso(async () => { await exportarWord(); }));

function confirmarReemplazo() {
  if (!hayCambios) return true;
  return confirm("Hay cambios que todavía no se guardaron en la nube y se perderán. ¿Continuar?");
}
async function cargarEstado(nuevo) {
  estado = normalizarEstado(nuevo);
  servActual = null;
  mostrarIps();
  dibujarAlcance();
  await iniciarCarpeta();
  dibujarCarpeta();
}
function nuevaEvaluacion() {
  if (!confirmarReemplazo()) return;
  borrarCopia();
  cargarEstado(nuevoEstado());
  hayCambios = false;
  nubeEstado = "";
  pintarEstado();
  $("recuperar").hidden = true;
  irA("alcance");
}
$("nueva").addEventListener("click", nuevaEvaluacion);
$("lista-nueva").addEventListener("click", nuevaEvaluacion);
$("archivo-xlsx").addEventListener("change", async (ev) => {
  const archivo = ev.target.files[0];
  if (!archivo) return;
  try {
    const res = await leerEvaluacion(archivo);
    if (res.errores.length) { mostrarMensajes(res.errores); return; }
    if (!confirmarReemplazo()) return;
    try { nubeLista = await listarNube(); } catch (error) { /* se decide con la lista que haya */ }
    // Si el archivo viene de otra cuenta (o no está en la tuya), se guarda como una evaluación nueva
    if (!nubeLista.some((x) => x.id === res.estado.id)) res.estado.id = uuid();
    await cargarEstado(res.estado);
    cambio();
    irA("resultados");
    mostrarMensajes([]);
  } catch (error) {
    mostrarMensajes([error.message]);
  } finally {
    ev.target.value = "";
  }
});

// ---------- Mis evaluaciones ----------
let nubeLista = [];
async function dibujarLista() {
  const c = $("lista-contenido");
  c.replaceChildren(crear("p", "ayuda", "Cargando…"));
  try {
    nubeLista = await listarNube();
  } catch (error) {
    c.replaceChildren(crear("p", "alerta", `No se pudo cargar la lista: ${error.message}`));
    return;
  }
  if (!nubeLista.length) {
    c.replaceChildren(crear("p", "ayuda", 'Aún no tienes evaluaciones guardadas. Crea la primera con "Nueva evaluación".'));
    return;
  }
  if (rolUsuario === "consultor") { dibujarPanel(nubeLista); return; }
  const frag = document.createDocumentFragment();
  nubeLista.forEach((f, k) => {
    const d = crear("div", "tarjeta-eval" + (f.id === estado.id ? " abierta" : ""));
    const info = crear("div", "info");
    info.appendChild(crear("strong", "", f.nombre || "Sin nombre"));
    if (f.sede) info.appendChild(crear("span", "", ` · ${f.sede}`));
    const fecha = new Date(f.actualizado).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
    info.appendChild(crear("div", "ayuda", `${k === 0 ? "Última modificada: " : "Modificada: "}${fecha}${f.id === estado.id ? " · abierta ahora" : ""}`));
    const acc = crear("div", "botones");
    const abrir = crear("button", k === 0 ? "agregar" : "mini", k === 0 ? "Continuar" : "Abrir");
    abrir.type = "button";
    abrir.addEventListener("click", () => abrirEvaluacion(f.id));
    const borrar = crear("button", "mini", "Eliminar");
    borrar.type = "button";
    borrar.addEventListener("click", () => eliminarEvaluacion(f));
    acc.append(abrir, borrar);
    d.append(info, acc);
    frag.appendChild(d);
  });
  c.replaceChildren(frag);
}
async function abrirEvaluacion(id, destino) {
  if (id !== estado.id && !confirmarReemplazo()) return;
  try {
    if (id !== estado.id) {
      const fila = nubeLista.find((x) => x.id === id);
      const datos = await leerNube(id);
      if (!estadoValido({ version: VERSION_GUARDADO, estado: datos })) throw new Error("Esa evaluación tiene un formato que esta versión no reconoce.");
      await cargarEstado(datos);
      hayCambios = false;
      nubeEstado = "ok";
      nubeHora = horaActual();
      guardarCopia(false);
      pintarEstado();
      // Evaluación guardada antes del dashboard: se guarda una vez para que tenga su resumen
      if (hayResumen && fila && !fila.resumen && serviciosActivos().length) cambio();
    }
    irA(destino || (serviciosActivos().length ? "verificar" : "alcance"));
  } catch (error) {
    mostrarMensajes([error.message]);
  }
}
async function eliminarEvaluacion(f) {
  if (!confirm(`Se eliminará "${f.nombre || "Sin nombre"}" de tu cuenta. No se puede deshacer (los archivos de tu carpeta de evidencias no se tocan). ¿Continuar?`)) return;
  try {
    await borrarNube(f.id);
    if (f.id === estado.id) {
      borrarCopia();
      await cargarEstado(nuevoEstado());
      hayCambios = false;
      nubeEstado = "";
      pintarEstado();
    }
    dibujarLista();
  } catch (error) {
    mostrarMensajes([error.message]);
  }
}

// ---------- Cuenta: acceso, registro y recuperación ----------
let modoAcceso = "entrar"; // entrar | recuperar | nueva (las cuentas las crea el administrador)
let recuperando = false;
function mensajeAcceso(texto, tipo) {
  const m = $("acc-msg");
  m.textContent = texto || "";
  m.className = tipo || "";
}
function pintarAcceso() {
  const t = {
    entrar: ["Iniciar sesión", "Entrar", ""],
    recuperar: ["Recuperar contraseña", "Enviar enlace", "Volver a iniciar sesión"],
    nueva: ["Elige una contraseña nueva", "Guardar contraseña", ""],
  }[modoAcceso];
  $("acceso-titulo").textContent = t[0];
  $("acc-enviar").textContent = t[1];
  $("acc-cambiar").textContent = t[2];
  $("acc-cambiar").hidden = !t[2];
  $("acc-olvide").hidden = modoAcceso !== "entrar";
  $("acc-correo-l").hidden = modoAcceso === "nueva";
  $("acc-clave-l").hidden = modoAcceso === "recuperar";
  $("acc-clave2-l").hidden = modoAcceso !== "nueva";
  $("acc-clave").autocomplete = modoAcceso === "entrar" ? "current-password" : "new-password";
}
function irAModo(m) {
  modoAcceso = m;
  mensajeAcceso("");
  pintarAcceso();
}
$("acc-cambiar").addEventListener("click", () => irAModo("entrar"));
$("acc-olvide").addEventListener("click", () => irAModo("recuperar"));
$("form-acceso").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const correo = $("acc-correo").value.trim();
  const clave = $("acc-clave").value;
  const boton = $("acc-enviar");
  mensajeAcceso("");
  try {
    if (modoAcceso !== "nueva" && !/^\S+@\S+\.\S+$/.test(correo)) throw new Error("Escribe un correo válido.");
    if (modoAcceso !== "recuperar" && !clave) throw new Error("Escribe la contraseña.");
    if (modoAcceso === "nueva" && clave.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    if (modoAcceso === "nueva" && clave !== $("acc-clave2").value) throw new Error("Las contraseñas no coinciden.");
    boton.disabled = true;
    if (modoAcceso === "entrar") await entrar(correo, clave);
    else if (modoAcceso === "recuperar") {
      await pedirRecuperacion(correo);
      mensajeAcceso("Si ese correo tiene una cuenta, te llegará un enlace para elegir una contraseña nueva.", "ok");
    } else {
      await cambiarClave(clave);
      recuperando = false;
      history.replaceState(null, "", location.pathname);
      irAModo("entrar");
      await alEntrar();
    }
  } catch (error) {
    mensajeAcceso(error.message, "mal");
  } finally {
    boton.disabled = false;
  }
});

function mostrarAcceso() {
  $("app").hidden = true;
  $("sesion").hidden = true;
  $("acceso").hidden = false;
}
function limpiarSesion() {
  clearTimeout(temporizadorNube);
  clearTimeout(temporizador);
  clearTimeout(reintento);
  usuario = null;
  estado = nuevoEstado();
  hayCambios = false;
  nubeEstado = "";
  nubeLista = [];
  rolUsuario = "ips";
  $("recuperar").hidden = true;
  $("guardado").textContent = "";
  $("acc-clave").value = "";
  $("acc-clave2").value = "";
  mostrarIps();
  dibujarAlcance();
}
async function alEntrar() {
  $("sesion-email").textContent = usuario.email || "";
  $("sesion").hidden = false;
  $("acceso").hidden = true;
  $("app").hidden = false;
  estado = nuevoEstado();
  hayCambios = false;
  nubeEstado = "";
  mostrarIps();
  dibujarAlcance();
  await iniciarCarpeta();
  dibujarCarpeta();
  let lista = [];
  try { lista = nubeLista = await listarNube(); } catch (error) { mostrarMensajes([`No se pudo cargar tu lista: ${error.message}`]); }
  ofrecerRecuperacion(lista);
  rolUsuario = await leerRol();
  const esConsultor = rolUsuario === "consultor";
  $("lista-titulo").textContent = esConsultor ? "Panel de IPS" : "Mis evaluaciones";
  document.querySelector('.pestana[data-vista="lista"]').textContent = esConsultor ? "Panel de IPS" : "Mis evaluaciones";
  // La IPS entra directo al dashboard de su evaluación más reciente; el consultor, a su panel
  if (!esConsultor && lista.length && $("recuperar").hidden) { await abrirEvaluacion(lista[0].id, "dashboard"); return; }
  irA("lista");
}
async function alCambiarSesion(evento, sesion) {
  if (evento === "PASSWORD_RECOVERY") {
    recuperando = true;
    usuario = sesion.user;
    mostrarAcceso();
    irAModo("nueva");
    return;
  }
  if (!sesion || evento === "SIGNED_OUT") {
    if (usuario) limpiarSesion();
    recuperando = false;
    irAModo("entrar");
    mostrarAcceso();
    return;
  }
  if (recuperando) return;
  if (usuario && usuario.id === sesion.user.id) { usuario = sesion.user; return; }
  usuario = sesion.user;
  await alEntrar();
}
$("salir").addEventListener("click", async () => {
  if (hayCambios) {
    await sincronizarNube();
    if (hayCambios && !confirm("Hay cambios que no pudieron guardarse en la nube; quedan solo en este equipo. ¿Cerrar sesión de todos modos?")) return;
  }
  try { await salir(); } catch (error) { mostrarMensajes([error.message]); }
});

// ---------- Inicio ----------
function ofrecerRecuperacion(lista) {
  $("recuperar").hidden = true;
  const copia = leerCopia();
  if (!copia || !copia.sinExportar) return; // solo si quedaron cambios que no llegaron a la nube
  const fila = lista.find((x) => x.id === copia.estado.id);
  if (fila && new Date(fila.actualizado).getTime() >= copia.guardado) return; // la nube ya está al día
  const nombre = copia.estado.ips.nombre ? ` de "${copia.estado.ips.nombre}"` : "";
  const fecha = new Date(copia.guardado).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  $("recuperar-texto").textContent = `Hay cambios${nombre} guardados en este equipo el ${fecha} que no llegaron a la nube. ¿Quieres recuperarlos?`;
  $("recuperar").hidden = false;
  $("recuperar-si").onclick = async () => {
    await cargarEstado(copia.estado);
    $("recuperar").hidden = true;
    cambio();
    irA(serviciosActivos().length ? "verificar" : "alcance");
  };
  $("recuperar-no").onclick = () => {
    if (!confirm("Se descartarán esos cambios locales y no se podrán recuperar. ¿Descartar?")) return;
    borrarCopia();
    $("recuperar").hidden = true;
  };
}

pintarAcceso();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ });
}
try {
  iniciarNube();
  supa.auth.onAuthStateChange((evento, sesion) => {
    setTimeout(() => alCambiarSesion(evento, sesion), 0); // no se llama a Supabase dentro del aviso
  });
} catch (error) {
  mostrarAcceso();
  mensajeAcceso(error.message, "mal");
}
