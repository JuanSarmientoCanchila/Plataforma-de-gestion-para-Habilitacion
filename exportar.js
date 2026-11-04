// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Exportar a Excel (librería ExcelJS) ----------
const COLOR_ESTADO = { c: "FFC6E0B4", n: "FFF8CBAD", na: "FFFFE699", sr: "FFD9D9D9" };
const BORDE = {
  top: { style: "thin", color: { argb: "FFBFBFBF" } }, left: { style: "thin", color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin", color: { argb: "FFBFBFBF" } }, right: { style: "thin", color: { argb: "FFBFBFBF" } },
};
const AVISO_LEGAL = "Herramienta de autoevaluación y asesoría. No reemplaza la verificación oficial de la Secretaría de Salud ni la declaración en el REPS.";
const CREDITO = "Creador: Juan Diego Sarmiento Canchila · Contacto: juan.sarmientocanchila@gmail.com";
const COLUMNAS_DETALLE = ["ID", "Hoja", "Servicio", "Nombre del servicio", "Estándar", "N.º criterio", "Requisito", "Estado", "Motivo (no aplica)", "Observación", "Evidencia", "Responsable", "Fecha compromiso", "Situación del servicio", "Archivos adjuntos"];

function relleno(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb } }; }
function estilizar(celda, o = {}) {
  celda.border = BORDE;
  celda.alignment = { vertical: "middle", horizontal: o.izquierda ? "left" : "center", wrapText: true };
  if (o.negrita) celda.font = { bold: true };
  if (o.fondo) celda.fill = relleno(o.fondo);
}
function encabezado(fila) {
  fila.eachCell((c) => estilizar(c, { negrita: true, fondo: "FFDDEBF7" }));
}
function fila(r) {
  const x = { ...(respuesta(r[I.id]) || {}) };
  const e = estadoEfectivo(r[I.id]);
  const padre = ancestroNA(r[I.id]);
  if (padre) x.motivo = x.motivo || `No aplica por el criterio ${padre[I.num]}`;
  return [r[I.id], r[I.hoja], SERVICIOS[r[I.serv]].cod, SERVICIOS[r[I.serv]].nombre, ESTANDARES[r[I.std]], r[I.num], r[I.texto],
    ETIQUETA[e], x.motivo || "", x.obs || "", x.evid || "", x.resp || "", x.fecha || "",
    esProyecto(r[I.serv]) ? "En proyecto" : "Habilitado", (CACHE_EVID.get(r[I.id]) || []).map((a) => a.nombre).join("; ")];
}
function hojaTabla(libro, nombre, filas) {
  const h = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  encabezado(h.addRow(COLUMNAS_DETALLE));
  [9, 7, 10, 30, 22, 10, 70, 12, 28, 40, 28, 20, 16, 14, 40].forEach((a, i) => (h.getColumn(i + 1).width = a));
  filas.forEach((r) => {
    const f = h.addRow(fila(r));
    f.eachCell((c, col) => estilizar(c, { izquierda: [4, 5, 7, 9, 10, 11, 12].includes(col) }));
    f.getCell(8).fill = relleno(COLOR_ESTADO[estadoEfectivo(r[I.id])]);
  });
  h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS_DETALLE.length } };
  return h;
}

function hojaResumen(libro) {
  const h = libro.addWorksheet("Resumen");
  const m = matriz();
  h.getColumn(1).width = 46;
  const ips = estado.ips;
  [["Verificación de habilitación – Resolución 3100 de 2019"], [],
    ["IPS / profesional", ips.nombre], ["Sede", ips.sede], ["Código REPS", ips.reps], ["Fecha de la evaluación", ips.fecha], ["Evaluador", ips.evaluador],
    ["Norma", `${NORMA.norma} (${NORMA.version})`], [AVISO_LEGAL], [CREDITO], []].forEach((f) => h.addRow(f));
  h.getCell("A1").font = { bold: true, size: 14 };
  for (let i = 3; i <= 8; i++) h.getCell(i, 1).font = { bold: true };
  const g = m.global;
  h.addRow(["Resultado global"]).font = { bold: true };
  [["Cumplimiento", g.pct], ["Revisado", g.avance]].forEach(([t, v]) => {
    const f = h.addRow([t, v]);
    f.getCell(2).numFmt = "0%";
  });
  [["Cumple", g.c], ["No cumple", g.n], ["No aplica", g.na], ["Sin revisar", g.sr]].forEach((f) => h.addRow(f));
  h.addRow([]);
  h.addRow(["Cumplimiento por servicio y estándar (Cumple ÷ aplicables)"]).font = { bold: true };
  encabezado(h.addRow(["Servicio", ...m.stds.map((s) => ESTANDARES[s]), "Total"]));
  const valor = (t) => (t.pct === null ? "—" : t.pct);
  const pintar = (f) => { f.eachCell((c, col) => { estilizar(c, { izquierda: col === 1 }); if (col > 1) c.numFmt = "0%"; }); return f; };
  m.filas.forEach((f) => pintar(h.addRow([`${f.serv.cod} ${f.serv.nombre}`, ...f.celdas.map(valor), valor(f.total)])));
  pintar(h.addRow(["Todos los servicios", ...m.porEst.map(valor), valor(g)])).font = { bold: true };
  if (m.proyecto.length) {
    h.addRow([]);
    h.addRow(["Servicios en proyecto (no cuentan en el global)"]).font = { bold: true };
    encabezado(h.addRow(["Servicio", ...m.stds.map((s) => ESTANDARES[s]), "Total"]));
    m.proyecto.forEach((f) => pintar(h.addRow([`${f.serv.cod} ${f.serv.nombre}`, ...f.celdas.map(valor), valor(f.total)])));
  }
  for (let c = 2; c <= m.stds.length + 2; c++) h.getColumn(c).width = 18;
  h.getRow(1).height = 22;
}

function hojaGeneral(libro) {
  const h = libro.addWorksheet("General");
  h.addRow(["campo", "valor"]).font = { bold: true };
  const a = estado.alcance;
  [["nombre", estado.ips.nombre], ["sede", estado.ips.sede], ["reps", estado.ips.reps], ["fecha", estado.ips.fecha], ["evaluador", estado.ips.evaluador],
    ["norma", NORMA.norma], ["versionNorma", NORMA.version], ["incluirTodos", a.incluirTodos ? "si" : "no"],
    ["servicios", a.servicios.join(";")], ["estandares", a.estandares.map((i) => ESTANDARES[i]).join(";")],
    ["exportado", new Date().toISOString()], ["id", estado.id], ["verTodos", estado.verTodos ? "si" : "no"],
    ...Object.entries(estado.perfiles).map(([cod, p]) => ["perfil:" + cod, JSON.stringify(p)])].forEach((f) => h.addRow(f));
  h.getColumn(1).width = 16;
  h.getColumn(2).width = 70;
}

async function exportarExcel() {
  if (typeof ExcelJS === "undefined") throw new Error('No se encontró la librería de Excel. Revisa que "exceljs.min.js" esté en la carpeta.');
  if (!serviciosActivos().length || !estado.alcance.estandares.length) throw new Error("Define el alcance (servicios y estándares) antes de exportar.");
  const libro = new ExcelJS.Workbook();
  libro.creator = "Verificador Resolución 3100";
  hojaResumen(libro);
  await Promise.all(serviciosActivos().map((si) => cargarServicioEvidencias(si).catch(() => {})));
  hojaTabla(libro, "Detalle", filasEvaluables().filter((r) => !r[I.enc]));
  hojaTabla(libro, "Brechas", brechas());
  hojaGeneral(libro);
  const datos = await libro.xlsx.writeBuffer();
  descargarArchivo(new Blob([datos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `verificacion-3100-${fechaLocal()}.xlsx`);
}

function descargarArchivo(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
