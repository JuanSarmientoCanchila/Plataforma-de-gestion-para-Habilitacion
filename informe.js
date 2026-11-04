// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Informe en Word (librería docx) ----------
const BORDE_T = { style: "single", size: 4, color: "BFBFBF" };
const RELLENO_E = { c: "C6E0B4", n: "F8CBAD", na: "FFE699", sr: "D9D9D9" };

function p(texto, op = {}) {
  return new docx.Paragraph({
    alignment: op.centro ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT,
    spacing: { before: op.antes || 0, after: op.despues ?? 100 },
    children: [new docx.TextRun({ text: texto, bold: op.negrita, italics: op.cursiva, size: op.tamano, color: op.color })],
  });
}
function h1(t) { return new docx.Paragraph({ heading: docx.HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new docx.TextRun(t)] }); }
function celda(texto, ancho, op = {}) {
  return new docx.TableCell({
    width: { size: ancho, type: docx.WidthType.PERCENTAGE },
    shading: op.fondo ? { type: docx.ShadingType.CLEAR, fill: op.fondo, color: "auto" } : undefined,
    borders: { top: BORDE_T, bottom: BORDE_T, left: BORDE_T, right: BORDE_T },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: String(texto ?? "").split("\n").map((l) => p(l, { negrita: op.negrita, tamano: 17, despues: 0, centro: op.centro })),
  });
}
function tabla(cabeza, filas, anchos, opciones = {}) {
  const enc = new docx.TableRow({ tableHeader: true, children: cabeza.map((t, i) => celda(t, anchos[i], { negrita: true, fondo: "DDEBF7", centro: true })) });
  const cuerpo = filas.map((f) => new docx.TableRow({ cantSplit: true, children: f.map((t, i) => celda(t.t ?? t, anchos[i], { fondo: t.fondo, centro: t.centro, negrita: t.negrita })) }));
  return new docx.Table({ width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: [enc, ...cuerpo] });
}
function fechaLarga(iso) {
  const [a, m, d] = (iso || "").split("-").map(Number);
  if (!a || !m || !d) return "";
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

async function exportarWord() {
  if (typeof docx === "undefined") throw new Error('No se encontró la librería de Word. Revisa que "docx.iife.js" esté en la carpeta.');
  if (!serviciosActivos().length || !estado.alcance.estandares.length) throw new Error("Define el alcance (servicios y estándares) antes de exportar.");
  const m = matriz();
  const g = m.global;
  const ips = estado.ips;
  const hijos = [];
  hijos.push(p("Informe de verificación de condiciones de habilitación", { negrita: true, tamano: 36, centro: true, color: "0B5C8A", despues: 60 }));
  hijos.push(p("Resolución 3100 de 2019 – Anexo técnico, numeral 11", { centro: true, tamano: 24, despues: 240 }));
  hijos.push(tabla(["Dato", "Valor"], [
    ["IPS / profesional", ips.nombre], ["Sede", ips.sede], ["Código REPS", ips.reps],
    ["Fecha de la evaluación", fechaLarga(ips.fecha)], ["Evaluador", ips.evaluador],
    ["Norma", `${NORMA.norma} (${NORMA.version})`],
  ].map(([a, b]) => [{ t: a, negrita: true }, b]), [30, 70]));
  hijos.push(p(AVISO_LEGAL, { cursiva: true, antes: 120, tamano: 18 }));
  hijos.push(p(CREDITO, { cursiva: true, tamano: 18 }));

  hijos.push(h1("1. Alcance"));
  hijos.push(p(`Servicios evaluados (${m.filas.length}): ${m.filas.map((f) => `${f.serv.cod} ${f.serv.nombre}`).join("; ")}.`));
  const perf = m.filas.filter((f) => f.serv.cod !== "11.1").map((f) => {
    const pf = perfil(f.serv.cod);
    const partes = [pf.comp.length ? "complejidad " + pf.comp.join(", ") : "", pf.mod.length ? pf.mod.map((x) => MODALIDADES[x]).join(", ") : ""].filter(Boolean);
    return partes.length ? `${f.serv.cod}: ${partes.join("; ")}` : "";
  }).filter(Boolean);
  if (perf.length) hijos.push(p(`Perfil evaluado — ${perf.join(" | ")}.`));
  if (m.proyecto.length) hijos.push(p(`Servicios en proyecto (no habilitados, fuera del porcentaje global): ${m.proyecto.map((f) => `${f.serv.cod} ${f.serv.nombre}`).join("; ")}.`));
  hijos.push(p(`Estándares evaluados: ${m.stds.map((s) => ESTANDARES[s]).join("; ")}.`));

  hijos.push(h1("2. Resultado global"));
  hijos.push(p(`Cumplimiento: ${pctTexto(g.pct)}  (${g.c} de ${g.aplicables} criterios aplicables).`, { negrita: true }));
  hijos.push(p(`Cumple: ${g.c} · No cumple: ${g.n} · No aplica: ${g.na} · Sin revisar: ${g.sr}. Avance de la revisión: ${pctTexto(g.avance)}.`));
  if (g.sr) hijos.push(p(`Hay ${g.sr} criterios sin revisar, que se cuentan como no cumplidos en el porcentaje.`, { cursiva: true }));
  hijos.push(p("Cumplimiento = Cumple ÷ (Cumple + No cumple + Sin revisar). Los criterios que no aplican no entran en el cálculo.", { cursiva: true, tamano: 18 }));

  hijos.push(h1("3. Cumplimiento por servicio y estándar"));
  const colorPct = (t) => (t.pct === null ? undefined : t.pct >= 1 ? "C6E0B4" : t.pct >= 0.8 ? "FFE699" : "F8CBAD");
  const cp = (t) => ({ t: t.total ? `${pctTexto(t.pct)}\n${t.c}/${t.aplicables}` : "—", fondo: colorPct(t), centro: true });
  const nCols = m.stds.length + 2;
  const anchoServ = 28;
  const anchos = [anchoServ, ...Array(nCols - 1).fill((100 - anchoServ) / (nCols - 1))];
  hijos.push(tabla(["Servicio", ...m.stds.map((s) => ESTANDARES[s]), "Total"],
    [...m.filas.map((f) => [`${f.serv.cod} ${f.serv.nombre}`, ...f.celdas.map(cp), cp(f.total)]),
      [{ t: "Todos los servicios", negrita: true }, ...m.porEst.map(cp), cp(g)]], anchos));

  if (m.proyecto.length) {
    hijos.push(p("Servicios en proyecto", { negrita: true, antes: 160 }));
    hijos.push(tabla(["Servicio", ...m.stds.map((s) => ESTANDARES[s]), "Total"],
      m.proyecto.map((f) => [`${f.serv.cod} ${f.serv.nombre}`, ...f.celdas.map(cp), cp(f.total)]), anchos));
  }
  const br = brechas();
  hijos.push(h1(`4. Brechas y plan de acción (${br.length})`));
  if (!br.length) hijos.push(p("No se registraron criterios que no cumplan."));
  else {
    hijos.push(tabla(["Servicio", "N.º", "Requisito", "Observación", "Responsable", "Fecha compromiso"],
      br.map((r) => {
        const x = respuesta(r[I.id]) || {};
        return [`${SERVICIOS[r[I.serv]].cod}\n${ESTANDARES[r[I.std]]}`, r[I.num], r[I.texto], x.obs || "", x.resp || "", fechaLarga(x.fecha)];
      }), [14, 7, 37, 20, 11, 11]));
  }
  const na = noAplica();
  if (na.length) {
    hijos.push(h1(`5. Criterios que no aplican (${na.length})`));
    hijos.push(tabla(["Servicio", "N.º", "Requisito", "Motivo"],
      na.map((r) => [SERVICIOS[r[I.serv]].cod, r[I.num], r[I.texto], (respuesta(r[I.id]) || {}).motivo || "[sin motivo]"]), [12, 8, 50, 30]));
  }

  const documento = new docx.Document({
    creator: "Plataforma de gestión para la habilitación de servicios de salud",
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: "0B5C8A" } }] },
    sections: [{ properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children: hijos }],
  });
  descargarArchivo(await docx.Packer.toBlob(documento), `informe-3100-${fechaLocal()}.docx`);
}
