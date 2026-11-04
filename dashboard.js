// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Dashboard de la IPS y panel del consultor ----------

let rolUsuario = "ips"; // "ips" | "consultor"
const pctEntero = (x) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);

function tarjetaDash(titulo, valor, detalle, clase) {
  const t = crear("div", "dash-tarjeta" + (clase ? " " + clase : ""));
  t.append(crear("span", "dash-tit", titulo), crear("strong", "", valor), crear("span", "dash-det", detalle));
  return t;
}
function insignia(pct) {
  const s = semaforo(pct);
  return crear("span", "insignia " + s.clase, s.clase === "ok" ? "Completada" : s.texto);
}
// Una barra horizontal con el porcentaje escrito y el estado en texto
function barraDash(nombre, d, extra) {
  const f = crear("div", "barra-fila");
  f.appendChild(crear("div", "barra-nombre", nombre));
  const pista = crear("div", "barra-pista");
  const s = semaforo(d.pct);
  const relleno = crear("div", "barra-relleno " + s.clase);
  relleno.style.width = d.pct === null ? "0%" : `${Math.round(d.pct * 100)}%`;
  pista.appendChild(relleno);
  f.appendChild(pista);
  f.appendChild(crear("div", "barra-valor", d.pct === null ? "Sin datos" : `${pctEntero(d.pct)} · ${s.texto}`));
  if (extra) f.title = extra;
  return f;
}
function seccionDash(titulo, ayuda) {
  const s = crear("section", "dash-seccion");
  s.appendChild(crear("h3", "", titulo));
  if (ayuda) s.appendChild(crear("p", "ayuda", ayuda));
  return s;
}
const textoCorto = (t, n = 110) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
function fechaLarga(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function columnaPlan(titulo, items, clase, vacio, textoDias) {
  const c = crear("div", "plan-col " + clase);
  const cab = crear("div", "plan-cab");
  cab.append(crear("strong", "", String(items.length)), crear("span", "", titulo));
  c.appendChild(cab);
  if (!items.length) { c.appendChild(crear("p", "ayuda", vacio)); return c; }
  const ul = crear("ul", "plan-lista");
  items.slice(0, 5).forEach((it) => {
    const li = crear("li");
    li.appendChild(crear("span", "plan-num", `${SERVICIOS[it.r[I.serv]].cod} · ${it.r[I.num]}`));
    li.appendChild(crear("span", "", textoCorto(it.r[I.texto])));
    li.appendChild(crear("span", "ayuda", textoDias(it)));
    ul.appendChild(li);
  });
  c.appendChild(ul);
  if (items.length > 5) c.appendChild(crear("p", "ayuda", `y ${items.length - 5} más (ver "Resultados y brechas")`));
  return c;
}

// Evaluación sin empezar: sin nombre, sin servicios elegidos y sin ninguna respuesta (solo trae el 11.1 por defecto)
function evaluacionVacia() {
  return !(estado.ips.nombre || "").trim() && !estado.alcance.servicios.length && !Object.keys(estado.resp).length;
}

function dibujarDashboard() {
  const c = $("dashboard");
  c.replaceChildren();
  if (!evalAbierta || evaluacionVacia()) {
    c.appendChild(crear("h2", "", "Dashboard"));
    const botones = crear("div", "botones");
    const boton = (texto, clase, accion) => {
      const b = crear("button", clase, texto);
      b.type = "button";
      b.addEventListener("click", accion);
      botones.appendChild(b);
    };
    if (!evalAbierta) {
      c.appendChild(crear("p", "ayuda", "No tienes una evaluación abierta. Abre una de tus evaluaciones o crea una nueva; aquí verás sus resultados."));
      boton("+ Nueva evaluación", "agregar", () => nuevaEvaluacion());
      boton("Ir a Mis evaluaciones", "mini", () => irA("lista"));
    } else {
      c.appendChild(crear("p", "ayuda", "Esta evaluación aún no tiene servicios, estándares ni respuestas. Define el alcance para ver sus resultados."));
      boton("Ir a Datos y alcance", "agregar", () => irA("alcance"));
    }
    c.appendChild(botones);
    return;
  }
  const nombre = estado.ips.nombre || "IPS sin nombre";
  const cab = crear("div", "dash-cab");
  const h = crear("div");
  h.appendChild(crear("h2", "", nombre + (estado.ips.sede ? ` · ${estado.ips.sede}` : "")));
  h.appendChild(crear("p", "ayuda", `Resolución 3100 de 2019${estado.ips.fecha ? ` · Evaluación del ${fechaLarga(estado.ips.fecha)}` : ""}${estado.ips.evaluador ? ` · ${estado.ips.evaluador}` : ""}`));
  cab.appendChild(h);
  c.appendChild(cab);

  if (!serviciosActivos().length) {
    c.appendChild(crear("p", "alerta", 'Esta evaluación aún no tiene servicios. Ve a "1. Datos y alcance" para elegirlos.'));
    return;
  }
  const r = calcularResumen();
  const g = r.global;
  const plan = planDeAccion();

  const tarj = crear("div", "dash-tarjetas");
  const s = semaforo(g.pct);
  tarj.appendChild(tarjetaDash("Cumplimiento global", pctEntero(g.pct), `${s.texto} · ${g.c} de ${g.aplicables} criterios cumplen`, "sem-" + s.clase));
  tarj.appendChild(tarjetaDash("Avance de revisión", pctEntero(g.avance), `${g.total - g.sr} de ${g.total} criterios revisados`));
  tarj.appendChild(tarjetaDash("Criterios que no cumplen", String(g.n), g.n ? "Brechas por cerrar" : "Sin brechas registradas", g.n ? "sem-bajo" : ""));
  tarj.appendChild(tarjetaDash("Compromisos vencidos", String(plan.vencidas.length), plan.vencidas.length ? "Requieren atención ya" : "Ninguno vencido", plan.vencidas.length ? "sem-bajo" : ""));
  c.appendChild(tarj);
  if (g.sr > 0) c.appendChild(crear("p", "ayuda", `Los ${g.sr} criterios sin revisar cuentan como pendientes: el cumplimiento sube a medida que se revisan y cumplen.`));

  const se = seccionDash("Cumplimiento por estándar");
  r.estandares.forEach((e) => se.appendChild(barraDash(e.nombre, e)));
  c.appendChild(se);

  const sv = seccionDash("Cumplimiento por servicio", "Los más rezagados aparecen primero.");
  r.servicios.slice().sort((a, b) => (a.pct === null) - (b.pct === null) || (a.pct ?? 0) - (b.pct ?? 0)).forEach((x) => sv.appendChild(barraDash(`${x.cod} ${x.nombre}`, x)));
  if (r.proyecto.length) {
    sv.appendChild(crear("p", "ayuda", `En proyecto (no cuentan en el cumplimiento): ${r.proyecto.map((x) => `${x.cod} ${x.nombre}`).join("; ")}.`));
  }
  c.appendChild(sv);

  const pa = seccionDash("Plan de acción", "Compromisos de los criterios que no cumplen.");
  const cols = crear("div", "plan-cols");
  const dias = (it) => {
    const quien = it.resp ? `Responsable: ${it.resp}` : "Sin responsable";
    if (!it.fecha) return `${quien} · Sin fecha`;
    const d = it.dias;
    const cuando = d < 0 ? `venció hace ${-d} ${-d === 1 ? "día" : "días"}` : d === 0 ? "vence hoy" : `en ${d} ${d === 1 ? "día" : "días"}`;
    return `${quien} · ${fechaLarga(it.fecha)} (${cuando})`;
  };
  cols.appendChild(columnaPlan("Vencidas", plan.vencidas, "vencida", "Ningún compromiso vencido.", dias));
  cols.appendChild(columnaPlan("Próximos 30 días", plan.proximas, "proxima", "Nada por vencer en los próximos 30 días.", dias));
  cols.appendChild(columnaPlan("Sin responsable o sin fecha", plan.sinDatos, "sindatos", "Todos los criterios que no cumplen tienen responsable y fecha.", dias));
  pa.appendChild(cols);
  c.appendChild(pa);
  c.appendChild(crear("p", "ayuda leyenda", "Semáforo: Cumple = 100 % · En camino = 80 a 99 % · Crítico = menos de 80 %."));
}

// ---------- Panel del consultor: todas sus IPS en una tabla ----------
let panelOrden = "rezago";
let panelFiltro = "todas";
let panelTexto = "";

function datosPanel(f) {
  // La evaluación abierta se calcula al momento; las demás usan el resumen guardado
  if (f.id === estado.id && evalAbierta && serviciosActivos().length && !evaluacionVacia()) return calcularResumen();
  return f.resumen || null;
}
function dibujarPanel(lista) {
  const c = $("panel-contenido");
  const filas = lista.map((f) => ({ f, r: datosPanel(f) }));
  const conDatos = (x) => x.r && x.r.global && x.r.global.pct !== null;
  const cuenta = { bajo: 0, medio: 0, ok: 0, nd: 0 };
  filas.forEach((x) => { cuenta[semaforo(conDatos(x) ? x.r.global.pct : null).clase]++; });

  const frag = document.createDocumentFragment();
  const resumen = crear("div", "dash-tarjetas panel-resumen");
  resumen.appendChild(tarjetaDash(rolUsuario === "consultor" ? "IPS" : "Evaluaciones", String(filas.length), "en total"));
  resumen.appendChild(tarjetaDash("Críticas", String(cuenta.bajo), "menos de 80 %", cuenta.bajo ? "sem-bajo" : ""));
  resumen.appendChild(tarjetaDash("En camino", String(cuenta.medio), "80 a 99 %", cuenta.medio ? "sem-medio" : ""));
  resumen.appendChild(tarjetaDash("Completadas", String(cuenta.ok), "cumplimiento 100 %", cuenta.ok ? "sem-ok" : ""));
  frag.appendChild(resumen);

  const ctl = crear("div", "filtros panel-ctl");
  const sel = (etiqueta, id, opciones, valor, alCambiar) => {
    const l = crear("label");
    l.appendChild(crear("span", "", etiqueta));
    const s = crear("select");
    s.id = id;
    opciones.forEach(([v, t]) => { const o = crear("option", "", t); o.value = v; s.appendChild(o); });
    s.value = valor;
    s.addEventListener("change", () => alCambiar(s.value));
    l.appendChild(s);
    return l;
  };
  ctl.appendChild(sel("Ordenar por", "panel-orden", [
    ["rezago", "Más rezagadas primero (menor cumplimiento)"], ["avance", "Menor avance de revisión"],
    ["brechas", "Más brechas"], ["reciente", "Última modificación"], ["nombre", "Nombre"],
  ], panelOrden, (v) => { panelOrden = v; dibujarPanel(lista); }));
  ctl.appendChild(sel("Mostrar", "panel-filtro", [
    ["todas", "Todas"], ["bajo", "Críticas"], ["medio", "En camino"], ["ok", "Completadas"], ["nd", "Sin datos"],
  ], panelFiltro, (v) => { panelFiltro = v; dibujarPanel(lista); }));
  const lb = crear("label", "crece");
  lb.appendChild(crear("span", "", "Buscar"));
  const inp = crear("input");
  inp.type = "search"; inp.id = "panel-buscar"; inp.placeholder = "Nombre de la IPS"; inp.value = panelTexto;
  inp.addEventListener("input", () => { panelTexto = inp.value; pintarFilas(); });
  lb.appendChild(inp);
  ctl.appendChild(lb);
  frag.appendChild(ctl);

  const envo = crear("div", "tabla-scroll");
  const tabla = crear("table", "panel-tabla");
  const cab = tabla.createTHead().insertRow();
  [(rolUsuario === "consultor" ? "IPS" : "Evaluación"), "Cumplimiento", "Avance", "Brechas", "Última modificación", "Estado", ""].forEach((t) => cab.appendChild(crear("th", "", t)));
  const cuerpo = tabla.createTBody();
  envo.appendChild(tabla);
  frag.appendChild(envo);
  const vacio = crear("p", "ayuda");
  frag.appendChild(vacio);

  const clave = {
    rezago: (x) => (conDatos(x) ? x.r.global.pct : 2),
    avance: (x) => (x.r && x.r.global && x.r.global.avance !== null ? x.r.global.avance : 2),
    brechas: (x) => -(x.r && x.r.global ? x.r.global.n : -1),
    reciente: (x) => -new Date(x.f.actualizado).getTime(),
    nombre: (x) => norm(x.f.nombre || "~"),
  }[panelOrden];

  function pintarFilas() {
    cuerpo.replaceChildren();
    const t = norm(panelTexto.trim());
    const vis = filas
      .filter((x) => (panelFiltro === "todas" || semaforo(conDatos(x) ? x.r.global.pct : null).clase === panelFiltro) && (!t || norm(`${x.f.nombre} ${x.f.sede}`).includes(t)))
      .sort((a, b) => (clave(a) > clave(b) ? 1 : clave(a) < clave(b) ? -1 : 0));
    vacio.textContent = vis.length ? "" : "Ninguna IPS coincide con el filtro.";
    vis.forEach((x) => {
      const tr = cuerpo.insertRow();
      const td0 = tr.insertCell();
      td0.appendChild(crear("strong", "", x.f.nombre || "Sin nombre"));
      if (x.f.sede) td0.appendChild(crear("div", "ayuda", x.f.sede));
      if (x.f.id === estado.id) td0.appendChild(crear("div", "ayuda", "abierta ahora"));
      if (conDatos(x)) {
        const g = x.r.global;
        const td1 = tr.insertCell(); td1.appendChild(barraDash("", g)); td1.classList.add("celda-barra");
        tr.insertCell().textContent = pctEntero(g.avance);
        tr.insertCell().textContent = String(g.n);
      } else {
        const td = tr.insertCell(); td.colSpan = 3; td.className = "ayuda";
        td.textContent = x.r ? "Aún sin servicios elegidos (evaluación sin iniciar)" : "Abre la evaluación una vez para calcular su resumen";
      }
      tr.insertCell().textContent = new Date(x.f.actualizado).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
      tr.insertCell().appendChild(insignia(conDatos(x) ? x.r.global.pct : null));
      const acc = tr.insertCell(); acc.className = "acciones";
      const ab = crear("button", "agregar", "Abrir"); ab.type = "button";
      ab.addEventListener("click", () => abrirEvaluacion(x.f.id));
      const el = crear("button", "mini", "Eliminar"); el.type = "button";
      el.addEventListener("click", () => eliminarEvaluacion(x.f));
      acc.append(ab, el);
    });
  }
  pintarFilas();
  c.replaceChildren(frag);
}

async function dibujarPanelVista() {
  const c = $("panel-contenido");
  c.replaceChildren(crear("p", "ayuda", "Cargando…"));
  try {
    nubeLista = await listarNube();
  } catch (error) {
    c.replaceChildren(crear("p", "alerta", `No se pudo cargar el panel: ${error.message}`));
    return;
  }
  if (!nubeLista.length) {
    c.replaceChildren(crear("p", "ayuda", 'Aún no tienes evaluaciones. Crea la primera con "Nueva evaluación".'));
    return;
  }
  dibujarPanel(nubeLista);
}
