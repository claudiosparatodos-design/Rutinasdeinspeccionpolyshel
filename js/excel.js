/* Excel de datos (tablas para análisis) con ExcelJS.
   El Excel con el formato original lo genera js/xlsx.js. */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const X = {};
  const FUENTE = 'Calibri';
  const ROJO = 'FFC00000';

  function nuevoLibro() {
    const wb = new ExcelJS.Workbook();
    wb.creator = (CFG.empresa || '') + ' · ' + (CFG.nombreApp || '');
    wb.created = new Date();
    return wb;
  }

  async function guardar(wb, nombre) {
    const buf = await wb.xlsx.writeBuffer();
    U.descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
  }

  function encabezado(ws, cab) {
    ws.addRow(cab);
    ws.getRow(1).eachCell((cell) => {
      cell.font = { name: FUENTE, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    ws.getRow(1).height = 42;
  }

  /** Una hoja por formato, un renglón por registro y una columna por dato. */
  X.exportarDatos = async (registros) => {
    registros = registros.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.turno).localeCompare(String(b.turno)));
    const wb = nuevoLibro();
    const usados = new Set();
    for (const f of M.formatos()) {
      const regs = registros.filter((r) => r.formatoId === f.id);
      if (!regs.length) continue;
      // Columnas: unión de los campos de todos los registros (arranque/paro varían)
      const cols = [];
      const vistos = new Set();
      for (const r of regs) {
        for (const s of M.secciones(f, r)) {
          for (const c of s.campos) {
            if (vistos.has(c.id)) continue;
            vistos.add(c.id);
            cols.push({ c, s });
          }
        }
      }
      let nombre = f.titulo.replace(/[\\/?*[\]:]/g, '-').slice(0, 28);
      while (usados.has(nombre)) nombre = nombre.slice(0, 26) + ' ' + usados.size;
      usados.add(nombre);
      const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }] });
      const cab = ['Fecha'].concat(M.usaTurno(f) ? ['Turno'] : [], f.tipos ? ['Tipo'] : [], ['Inspector'],
        cols.map(({ c, s }) => s.titulo + ' · ' + c.label + (c.unidad ? ' (' + c.unidad + ')' : '')), ['Alertas', 'Estado', 'Folio']);
      encabezado(ws, cab);
      const fijo = cab.length - cols.length - 3;
      for (const r of regs) {
        const res = M.resumen(r, f);
        const vals = cols.map(({ c }) => {
          const v = r.valores && r.valores[c.id];
          if (v == null || v === '') return null;
          return c.tipo === 'numero' ? U.aNumero(v) : M.textoValor(c, v);
        });
        const fila = ws.addRow([U.parseISO(r.fecha)].concat(M.usaTurno(f) ? [M.nombreTurno(r.turno)] : [], f.tipos ? [M.nombreTipo(f, r)] : [],
          [(r.encabezado && r.encabezado.inspector) || r.creadoPor || ''], vals,
          [res.alertas.map((a) => M.textoAlerta(a)).join('; '), r.estado === 'completo' ? 'Finalizado' : 'En proceso', r.id.split('_').pop().toUpperCase()]));
        fila.getCell(1).numFmt = 'dd/mm/yyyy';
        cols.forEach(({ c }, i) => {
          if (M.esAlerta(M.evaluar(f, c, r.valores && r.valores[c.id]))) fila.getCell(fijo + 1 + i).font = { bold: true, color: { argb: ROJO } };
        });
      }
      ws.columns.forEach((col, i) => { col.width = i < fijo ? 14 : i >= cab.length - 3 ? 24 : 14; });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } };
    }
    if (!wb.worksheets.length) wb.addWorksheet('Sin datos');
    const fechas = registros.map((r) => r.fecha).sort();
    await guardar(wb, 'Datos_rutinas_' + (fechas[0] === fechas[fechas.length - 1] ? fechas[0] : fechas[0] + '_a_' + fechas[fechas.length - 1]) + '.xlsx');
  };

  /** Tabla simple (resultados de búsqueda). Las fechas (Date) salen con formato dd/mm/aaaa. */
  X.exportarTabla = async (nombreArchivo, nombreHoja, cabeceras, filas) => {
    const wb = nuevoLibro();
    const ws = wb.addWorksheet(nombreHoja.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    encabezado(ws, cabeceras);
    ws.getRow(1).height = 24;
    for (const f of filas) {
      const row = ws.addRow(f);
      f.forEach((v, i) => { if (v instanceof Date) row.getCell(i + 1).numFmt = 'dd/mm/yyyy'; });
    }
    cabeceras.forEach((c, i) => {
      let w = String(c).length;
      for (const f of filas.slice(0, 300)) w = Math.max(w, f[i] instanceof Date ? 10 : String(f[i] == null ? '' : f[i]).length);
      ws.getColumn(i + 1).width = Math.min(45, Math.max(9, w + 2));
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cabeceras.length } };
    await guardar(wb, nombreArchivo + '.xlsx');
  };

  window.X = X;
})();
