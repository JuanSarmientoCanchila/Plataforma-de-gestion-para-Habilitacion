// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Resumen para el dashboard ----------
// El resumen es un texto corto con los números de la evaluación. Se guarda en la nube junto a la evaluación
// para poder mostrar el panel de varias IPS sin abrir cada una. Los criterios NO se guardan aquí: viven en la app.

const DIA_MS = 86400000;
function hoyLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function fechaCompromiso(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// Semáforo: verde = 100 %, ámbar = 80–99 %, rojo = menos de 80 %. Siempre con texto, no solo color.
function semaforo(pct) {
  if (pct === null || pct === undefined) return { clase: "nd", texto: "Sin datos" };
  if (pct >= 1) return { clase: "ok", texto: "Cumple" };
  if (pct >= 0.8) return { clase: "medio", texto: "En camino" };
  return { clase: "bajo", texto: "Crítico" };
}

// Compromisos de los criterios que NO cumplen (las listas pueden solaparse: una vencida sin responsable está en ambas)
function planDeAccion(hoy = hoyLocal()) {
  const plan = { vencidas: [], proximas: [], sinDatos: [] };
  brechas().forEach((r) => {
    const x = estado.resp[r[I.id]] || {};
    const f = fechaCompromiso(x.fecha);
    const item = { r, resp: (x.resp || "").trim(), fecha: x.fecha || "", dias: f ? Math.round((f - hoy) / DIA_MS) : null };
    if (!item.resp || !f) plan.sinDatos.push(item);
    if (f && item.dias < 0) plan.vencidas.push(item);
    else if (f && item.dias <= 30) plan.proximas.push(item);
  });
  const porDias = (a, b) => a.dias - b.dias;
  plan.vencidas.sort(porDias);
  plan.proximas.sort(porDias);
  return plan;
}

function calcularResumen() {
  const m = matriz();
  const g = m.global;
  const plan = planDeAccion();
  const dato = (t) => ({ pct: t.pct, c: t.c, n: t.n, sr: t.sr, na: t.na, aplicables: t.aplicables, total: t.total });
  const serv = (f) => ({ cod: f.serv.cod, nombre: f.serv.nombre, ...dato(f.total) });
  return {
    v: 1,
    fecha: new Date().toISOString(),
    global: { ...dato(g), avance: g.avance },
    estandares: m.stds.map((s, k) => ({ nombre: ESTANDARES[s], ...dato(m.porEst[k]) })),
    servicios: m.filas.map(serv),
    proyecto: m.proyecto.map(serv),
    plan: { vencidas: plan.vencidas.length, proximas: plan.proximas.length, sinDatos: plan.sinDatos.length },
  };
}
