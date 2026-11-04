// © 2026 Juan Diego Sarmiento Canchila. Todos los derechos reservados. Contacto: juan.sarmientocanchila@gmail.com
// ---------- Importar una verificación exportada (hojas "General" y "Detalle") ----------
const MAX_ERRORES = 10;

function textoCelda(celda) {
  let v = celda.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("").trim();
    if ("result" in v) v = v.result;
    else if ("text" in v) v = v.text;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === null || v === undefined ? "" : String(v).trim();
}

// Devuelve { estado, errores }. Si hay errores no se importa nada.
async function leerEvaluacion(archivo) {
  if (typeof ExcelJS === "undefined") throw new Error('No se encontró la librería de Excel. Revisa que "exceljs.min.js" esté en la carpeta.');
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch (error) {
    return { estado: null, errores: ["El archivo no es un Excel (.xlsx) válido."] };
  }
  const errores = [];
  const hg = libro.getWorksheet("General");
  const hd = libro.getWorksheet("Detalle");
  if (!hg || !hd) return { estado: null, errores: ['El archivo no parece exportado desde esta página: faltan las hojas "General" y "Detalle".'] };

  const g = {};
  hg.eachRow((f, n) => { if (n > 1) g[textoCelda(f.getCell(1))] = textoCelda(f.getCell(2)); });
  const nuevo = nuevoEstado();
  ["nombre", "sede", "reps", "fecha", "evaluador"].forEach((k) => (nuevo.ips[k] = g[k] || ""));
  nuevo.alcance.incluirTodos = g.incluirTodos !== "no";
  if (g.id) nuevo.id = g.id;
  nuevo.verTodos = g.verTodos === "si";
  Object.keys(g).filter((k) => k.startsWith("perfil:")).forEach((k) => {
    const cod = k.slice(7);
    try {
      const p = JSON.parse(g[k]);
      const bien = SERVICIOS.some((s) => s.cod === cod) && Array.isArray(p.comp) && Array.isArray(p.mod) && typeof p.proyecto === "boolean" &&
        p.comp.every((c) => COMPLEJIDADES.includes(c)) && p.mod.every((x) => x in MODALIDADES);
      if (!bien) throw new Error("perfil inválido");
      nuevo.perfiles[cod] = { comp: p.comp, mod: p.mod, proyecto: p.proyecto };
    } catch (error) {
      errores.push(`El perfil del servicio ${cod} en la hoja General no es válido.`);
    }
  });
  nuevo.alcance.servicios = (g.servicios || "").split(";").filter(Boolean);
  const desconocidos = nuevo.alcance.servicios.filter((c) => !SERVICIOS.some((s) => s.cod === c));
  if (desconocidos.length) errores.push(`Servicios desconocidos en la hoja General: ${desconocidos.join(", ")}.`);
  nuevo.alcance.estandares = [];
  (g.estandares || "").split(";").filter(Boolean).forEach((nom) => {
    const i = ESTANDARES.indexOf(nom);
    if (i < 0) errores.push(`Estándar desconocido en la hoja General: "${nom}".`);
    else nuevo.alcance.estandares.push(i);
  });

  const col = {};
  hd.getRow(1).eachCell((c, n) => (col[textoCelda(c)] = n));
  const faltan = ["ID", "Estado", "Motivo (no aplica)", "Observación", "Evidencia", "Responsable", "Fecha compromiso"].filter((c) => !col[c]);
  if (faltan.length) errores.push(`En la hoja Detalle faltan las columnas: ${faltan.join(", ")}.`);
  if (!errores.length) {
    const vistos = new Set();
    hd.eachRow((f, n) => {
      if (n === 1 || errores.length >= MAX_ERRORES) return;
      const id = textoCelda(f.getCell(col.ID));
      if (!id) return;
      if (!POR_ID.has(id)) { errores.push(`Fila ${n}: el ID "${id}" no existe en la norma cargada.`); return; }
      if (vistos.has(id)) { errores.push(`Fila ${n}: el ID "${id}" está repetido.`); return; }
      vistos.add(id);
      const e = DEL_TEXTO[textoCelda(f.getCell(col.Estado))];
      if (!e) { errores.push(`Fila ${n}: el estado debe ser Cumple, No cumple, No aplica o Sin revisar.`); return; }
      const datos = {
        e: e === "sr" ? "" : e,
        motivo: textoCelda(f.getCell(col["Motivo (no aplica)"])), obs: textoCelda(f.getCell(col["Observación"])),
        evid: textoCelda(f.getCell(col.Evidencia)), resp: textoCelda(f.getCell(col.Responsable)),
        fecha: textoCelda(f.getCell(col["Fecha compromiso"])),
      };
      // Fila heredada de un criterio padre "No aplica": se vuelve a heredar sola, no se guarda como propia
      if (datos.e === "na" && /^No aplica por el criterio /.test(datos.motivo)) { datos.e = ""; datos.motivo = ""; }
      if (datos.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) { errores.push(`Fila ${n}: la fecha compromiso debe tener formato AAAA-MM-DD.`); return; }
      if (datos.e || datos.motivo || datos.obs || datos.evid || datos.resp || datos.fecha) nuevo.resp[id] = datos;
    });
  }
  return { estado: errores.length ? null : nuevo, errores };
}
