/* Exportación a Excel con el mismo diseño de la hoja impresa (ExcelJS). */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const X = {};

  const FUENTE = 'Arial';
  const GRIS = 'FFE6E6E6';
  const GRIS_OSC = 'FFBFBFBF';
  const ROJO = 'FFC00000';
  const ROJO_FONDO = 'FFFDE2E2';
  const fino = { style: 'thin', color: { argb: 'FF000000' } };
  const medio = { style: 'medium', color: { argb: 'FF000000' } };
  const BORDE = { top: fino, left: fino, bottom: fino, right: fino };

  const letra = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  function unir(ws, r1, c1, r2, c2) {
    if (r1 === r2 && c1 === c2) return ws.getCell(r1, c1);
    ws.mergeCells(r1, c1, r2, c2);
    return ws.getCell(r1, c1);
  }
  function bordeRango(ws, r1, c1, r2, c2, borde) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = borde || BORDE;
  }
  function contornoRango(ws, r1, c1, r2, c2, b) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      const o = Object.assign({}, cell.border || {});
      if (r === r1) o.top = b; if (r === r2) o.bottom = b; if (c === c1) o.left = b; if (c === c2) o.right = b;
      cell.border = o;
    }
  }

  let logoCache;
  async function logoBase64() {
    if (!CFG.logo) return null;
    if (logoCache !== undefined) return logoCache;
    try {
      const res = await fetch(CFG.logo);
      const blob = await res.blob();
      logoCache = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    } catch (e) { logoCache = null; }
    return logoCache;
  }

  /** Dibuja un registro (o el formato en blanco si reg es null) en una hoja nueva. */
  async function hojaRegistro(wb, nombreHoja, formato, reg) {
    const filas = (reg && reg.filas) || M.filasVigentes(formato);
    const cols = formato.tabla.columnas;
    const N = 1 + cols.length;
    const horizontal = ((formato.hoja && formato.hoja.orientacion) || 'horizontal') === 'horizontal';

    const ws = wb.addWorksheet(nombreHoja, {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 1, orientation: horizontal ? 'landscape' : 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true,
        margins: { left: 0.3, right: 0.3, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 }
      },
      properties: { defaultRowHeight: 15 }
    });

    // Anchos de columna
    ws.getColumn(1).width = (formato.tabla.anchoFila || 18) * 1.05;
    cols.forEach((c, i) => { ws.getColumn(i + 2).width = Math.max(5, (c.ancho || 7) * 1.2); });

    const fnt = (o) => Object.assign({ name: FUENTE, size: 9 }, o || {});
    const centro = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // ---------- Encabezado del documento (filas 1-3) ----------
    const cMetaIni = N - 2;
    const cTitFin = cMetaIni - 1;
    const logoFin = 2;
    for (let r = 1; r <= 3; r++) ws.getRow(r).height = 20;

    const celdaLogo = unir(ws, 1, 1, 3, logoFin);
    const logo = await logoBase64();
    if (logo) {
      const ext = /image\/png/.test(logo) ? 'png' : 'jpeg';
      const id = wb.addImage({ base64: logo, extension: ext });
      ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, br: { col: logoFin - 0.15, row: 2.85 }, editAs: 'oneCell' });
    } else {
      celdaLogo.value = CFG.empresa || '';
      celdaLogo.font = fnt({ size: 15, bold: true });
    }
    celdaLogo.alignment = centro;

    const tit = unir(ws, 1, logoFin + 1, 2, cTitFin);
    tit.value = formato.titulo;
    tit.font = fnt({ size: 13, bold: true });
    tit.alignment = centro;

    const sub = unir(ws, 3, logoFin + 1, 3, cTitFin);
    sub.value = (formato.subtitulo || '') + (formato.area ? '   ·   Área: ' + formato.area : '');
    sub.font = fnt({ size: 9 });
    sub.alignment = centro;

    [['Código: ', formato.codigo], ['Revisión: ', formato.revision], ['Vigencia: ', formato.vigencia || '']].forEach((m, i) => {
      const c = unir(ws, i + 1, cMetaIni, i + 1, N);
      c.value = { richText: [{ text: m[0], font: fnt({ bold: true }) }, { text: String(m[1]), font: fnt() }] };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    });
    bordeRango(ws, 1, 1, 3, N);
    contornoRango(ws, 1, 1, 3, N, medio);

    // ---------- Datos generales (fila 5) ----------
    ws.getRow(4).height = 6;
    const rDatos = 5;
    ws.getRow(rDatos).height = 20;
    const totalAncho = formato.encabezado.reduce((a, x) => a + (x.ancho || 1), 0);
    let col = 1;
    formato.encabezado.forEach((campo, i) => {
      if (col > N) return;
      const span = i === formato.encabezado.length - 1 ? N - col + 1 : Math.max(1, Math.round(N * (campo.ancho || 1) / totalAncho));
      const fin = Math.min(N, col + span - 1);
      const c = unir(ws, rDatos, col, rDatos, fin);
      c.value = { richText: [{ text: campo.label + ': ', font: fnt({ bold: true }) }, { text: R.valorEncabezado(campo, reg) || '', font: fnt() }] };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      bordeRango(ws, rDatos, col, rDatos, fin);
      col = fin + 1;
    });
    ws.getRow(6).height = 6;

    // ---------- Tabla ----------
    const grupos = M.gruposColumnas(cols);
    const hayGrupos = grupos.some((g) => g.grupo);
    let r = 7;
    const rCab = r;
    const rCab2 = hayGrupos ? r + 1 : r;
    const etiqueta = (c) => {
      const conUnidad = c.unidad && !(c.grupo && c.grupo.includes(c.unidad));
      return c.label + (conUnidad ? '\n(' + c.unidad + ')' : '');
    };
    const estiloCab = (cell) => {
      cell.font = fnt({ bold: true, size: 8.5 });
      cell.alignment = centro;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    };
    const cf = unir(ws, rCab, 1, rCab2, 1);
    cf.value = formato.tabla.titulo;
    let c = 2;
    for (const g of grupos) {
      if (g.grupo) {
        const cg = unir(ws, rCab, c, rCab, c + g.cols.length - 1);
        cg.value = g.grupo;
        g.cols.forEach((cc, i) => { ws.getCell(rCab2, c + i).value = etiqueta(cc); });
      } else {
        unir(ws, rCab, c, rCab2, c).value = etiqueta(g.cols[0]);
      }
      c += g.cols.length;
    }
    for (let rr = rCab; rr <= rCab2; rr++) {
      ws.getRow(rr).height = hayGrupos && rr === rCab ? 18 : 30;
      for (let cc = 1; cc <= N; cc++) estiloCab(ws.getCell(rr, cc));
    }
    r = rCab2 + 1;

    const hayRangos = cols.some((cc) => cc.tipo === 'numero' && (cc.min != null || cc.max != null));
    if (hayRangos) {
      ws.getCell(r, 1).value = 'Rango';
      cols.forEach((cc, i) => {
        const lim = cc.tipo === 'numero' ? M.limite(cc, null) : null;
        ws.getCell(r, i + 2).value = lim ? M.textoLimite(lim) : '';
      });
      for (let cc = 1; cc <= N; cc++) {
        const cell = ws.getCell(r, cc);
        cell.font = fnt({ size: 7.5, italic: true });
        cell.alignment = centro;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
      }
      ws.getRow(r).height = 13;
      r++;
    }
    bordeRango(ws, rCab, 1, r - 1, N);

    const rDatosIni = r;
    for (const f of filas) {
      const vals = (reg && reg.valores && reg.valores[f.id]) || {};
      const fila = ws.getRow(r);
      fila.height = 24;
      const cn = ws.getCell(r, 1);
      cn.value = f.codigo ? { richText: [{ text: f.nombre, font: fnt({ bold: true }) }, { text: '\n' + f.codigo, font: fnt({ size: 7, color: { argb: 'FF555555' } }) }] } : f.nombre;
      if (!f.codigo) cn.font = fnt({ bold: true });
      cn.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
      cols.forEach((cc, i) => {
        const cell = ws.getCell(r, i + 2);
        cell.font = fnt();
        cell.alignment = cc.tipo === 'texto' ? { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 } : centro;
        if (M.omitida(f, cc)) {
          cell.fill = { type: 'pattern', pattern: 'lightUp', fgColor: { argb: 'FF9E9E9E' }, bgColor: { argb: 'FFFFFFFF' } };
          return;
        }
        const v = vals[cc.id];
        if (v == null || v === '') {
          if (vals._noOpera && cc.tipo !== 'texto') { cell.value = '—'; cell.font = fnt({ color: { argb: 'FF808080' } }); }
          else if (!reg && f.limites && f.limites[cc.id]) { cell.value = M.textoLimite(f.limites[cc.id]); cell.font = fnt({ size: 6.5, color: { argb: 'FF808080' } }); cell.alignment = { vertical: 'top', horizontal: 'right' }; }
          return;
        }
        if (cc.tipo === 'numero' && U.aNumero(v) != null) {
          cell.value = U.aNumero(v);
          if (cc.decimales != null) cell.numFmt = cc.decimales === 0 ? '0' : '0.' + '0'.repeat(cc.decimales);
        } else {
          cell.value = M.textoValor(cc, v);
        }
        if (M.esAlerta(M.evaluar(cc, f, v))) {
          cell.font = fnt({ bold: true, color: { argb: ROJO } });
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO_FONDO } };
        }
      });
      r++;
    }
    bordeRango(ws, rDatosIni, 1, r - 1, N);
    contornoRango(ws, rCab, 1, r - 1, N, medio);

    // ---------- Pie ----------
    for (const p of formato.pie || []) {
      ws.getRow(r).height = 6; r++;
      const l = unir(ws, r, 1, r, N);
      l.value = p.label + ':';
      l.font = fnt({ bold: true });
      l.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      l.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
      bordeRango(ws, r, 1, r, N);
      r++;
      const t = unir(ws, r, 1, r, N);
      t.value = (reg && reg.pie && reg.pie[p.id]) || '';
      t.font = fnt();
      t.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
      ws.getRow(r).height = Math.max(3, p.lineas || 3) * 15;
      bordeRango(ws, r, 1, r, N);
      r++;
    }
    if (formato.notas) {
      const n = unir(ws, r, 1, r, N);
      n.value = formato.notas;
      n.font = fnt({ size: 7.5, italic: true, color: { argb: 'FF444444' } });
      n.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      ws.getRow(r).height = 16;
      r++;
    }

    // ---------- Firmas ----------
    const firmas = formato.firmas || [];
    if (firmas.length) {
      ws.getRow(r).height = 10; r++;
      const rImg = r, rNom = r + 1, rLbl = r + 2;
      ws.getRow(rImg).height = 42;
      ws.getRow(rNom).height = 16;
      ws.getRow(rLbl).height = 14;
      const k = firmas.length;
      const bloque = Math.floor(N / k);
      for (let i = 0; i < k; i++) {
        const ini = i * bloque + 1 + (bloque > 4 ? 1 : 0);
        const fin = (i + 1) * bloque - (bloque > 4 ? 1 : 0);
        const d = (reg && reg.firmas && reg.firmas[firmas[i].id]) || {};
        unir(ws, rImg, ini, rImg, fin);
        if (U.srcImagen(d.img)) {
          const id = wb.addImage({ base64: d.img, extension: /^data:image\/jpeg/.test(d.img) ? 'jpeg' : 'png' });
          // Centrar la firma dentro del bloque
          let anchoPx = 0;
          for (let cc = ini; cc <= fin; cc++) anchoPx += (ws.getColumn(cc).width || 8) * 7;
          const w = Math.min(170, anchoPx * 0.8), h = w * 0.33;
          const desplaza = Math.max(0, (anchoPx - w) / 2) / ((ws.getColumn(ini).width || 8) * 7);
          ws.addImage(id, { tl: { col: ini - 1 + Math.min(desplaza, fin - ini), row: rImg - 1 + 0.05 }, ext: { width: w, height: h }, editAs: 'oneCell' });
        }
        const nom = unir(ws, rNom, ini, rNom, fin);
        nom.value = d.nombre || '';
        nom.font = fnt({ size: 9 });
        nom.alignment = { vertical: 'middle', horizontal: 'center' };
        for (let cc = ini; cc <= fin; cc++) ws.getCell(rNom, cc).border = { top: fino };
        const lb = unir(ws, rLbl, ini, rLbl, fin);
        lb.value = { richText: [{ text: firmas[i].label, font: fnt({ bold: true, size: 8 }) }, { text: firmas[i].sub ? ' · ' + firmas[i].sub : '', font: fnt({ size: 8 }) }] };
        lb.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      r = rLbl + 1;
    }

    // ---------- Folio ----------
    if (reg) {
      const fo = unir(ws, r, 1, r, N);
      fo.value = 'Folio: ' + reg.id.split('_').pop().toUpperCase() + '   ·   Capturado por ' + (reg.creadoPor || '—') + ' el ' + U.fechaHora(reg.creadoEn) +
        '   ·   ' + (reg.estado === 'completo' ? 'Registro finalizado' : 'Registro en proceso');
      fo.font = fnt({ size: 7, color: { argb: 'FF808080' } });
      fo.alignment = { horizontal: 'left', vertical: 'middle' };
    }

    ws.pageSetup.printArea = 'A1:' + letra(N) + r;
    return ws;
  }

  function nombresHoja(registros) {
    const usados = {};
    const mezclados = new Set(registros.map((x) => x.formatoId)).size > 1;
    return registros.map((reg) => {
      const f = M.formato(reg.formatoId);
      const [y, m, d] = reg.fecha.split('-');
      let base = (mezclados && f ? f.codigo + ' ' + d + '-' + m + '-' + y.slice(2) : d + '-' + m + '-' + y) + (reg.turno ? ' T' + reg.turno : '');
      base = base.replace(/[\\/?*[\]:]/g, '-').slice(0, 27);
      usados[base] = (usados[base] || 0) + 1;
      return usados[base] > 1 ? base + ' (' + usados[base] + ')' : base;
    });
  }

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

  function nombreArchivo(prefijo, registros) {
    const fechas = registros.map((x) => x.fecha).sort();
    const formatosIds = Array.from(new Set(registros.map((x) => x.formatoId)));
    const f = formatosIds.length === 1 ? M.formato(formatosIds[0]) : null;
    const rango = fechas.length ? (fechas[0] === fechas[fechas.length - 1] ? fechas[0] : fechas[0] + '_a_' + fechas[fechas.length - 1]) : U.hoyISO();
    return prefijo + (f ? '_' + f.codigo : '') + '_' + rango + '.xlsx';
  }

  /** Exporta registros con el formato oficial: una hoja por registro (+ índice si son varios). */
  X.exportarFormato = async (registros) => {
    registros = registros.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.turno).localeCompare(String(b.turno)) || a.creadoEn - b.creadoEn);
    const wb = nuevoLibro();
    const nombres = nombresHoja(registros);
    if (registros.length > 1) {
      const idx = wb.addWorksheet('Índice', { views: [{ state: 'frozen', ySplit: 3 }] });
      idx.getCell('A1').value = (CFG.empresa || '') + ' — Índice de registros exportados';
      idx.getCell('A1').font = { name: FUENTE, size: 13, bold: true };
      idx.getCell('A2').value = 'Generado el ' + U.fechaHora(Date.now()) + ' · ' + registros.length + ' registros';
      idx.getCell('A2').font = { name: FUENTE, size: 9, color: { argb: 'FF666666' } };
      const cab = ['Fecha', 'Turno', 'Formato', 'Inspector', 'Estado', 'Avance', 'Alertas', 'Ir a la hoja'];
      idx.getRow(3).values = cab;
      idx.getRow(3).eachCell((cell) => {
        cell.font = { name: FUENTE, size: 9, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
        cell.border = BORDE;
      });
      [12, 12, 44, 22, 12, 10, 9, 22].forEach((w, i) => { idx.getColumn(i + 1).width = w; });
      registros.forEach((reg, i) => {
        const f = M.formato(reg.formatoId);
        const res = M.resumen(reg, f);
        const row = idx.getRow(4 + i);
        row.values = [U.fechaCorta(reg.fecha), M.nombreTurno(reg.turno), f ? f.codigo + ' · ' + f.titulo : reg.formatoId,
          reg.encabezado && reg.encabezado.inspector || reg.creadoPor || '', reg.estado === 'completo' ? 'Finalizado' : 'En proceso',
          res.completas + '/' + res.total, res.alertas.length, { text: nombres[i], hyperlink: "#'" + nombres[i] + "'!A1" }];
        row.eachCell((cell, n) => {
          cell.font = { name: FUENTE, size: 9, color: n === 8 ? { argb: 'FF0B5CAD' } : undefined, underline: n === 8 };
          cell.border = BORDE;
        });
        if (res.alertas.length) row.getCell(7).font = { name: FUENTE, size: 9, bold: true, color: { argb: ROJO } };
      });
    }
    for (let i = 0; i < registros.length; i++) {
      const f = M.formato(registros[i].formatoId);
      if (f) await hojaRegistro(wb, nombres[i], f, registros[i]);
    }
    await guardar(wb, nombreArchivo('Rutinas', registros));
  };

  /** Formato en blanco (para imprimir y llenar a mano si falla la tableta). */
  X.exportarBlanco = async (formato) => {
    const wb = nuevoLibro();
    await hojaRegistro(wb, 'Formato', formato, null);
    await guardar(wb, formato.codigo + '_formato_en_blanco.xlsx');
  };

  /** Tabla plana de lecturas (una fila por máquina por registro) para análisis. */
  X.exportarDatos = async (registros) => {
    registros = registros.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.turno).localeCompare(String(b.turno)));
    const wb = nuevoLibro();
    const porFormato = {};
    for (const reg of registros) (porFormato[reg.formatoId] = porFormato[reg.formatoId] || []).push(reg);
    for (const fid of Object.keys(porFormato)) {
      const f = M.formato(fid);
      if (!f) continue;
      const ws = wb.addWorksheet(f.codigo.replace(/[\\/?*[\]:]/g, '-').slice(0, 31), { views: [{ state: 'frozen', ySplit: 1, xSplit: 5 }] });
      const cab = ['Fecha', 'Turno', 'Inspector', f.tabla.titulo, 'Código'].concat(f.tabla.columnas.map((c) => c.label + (c.unidad ? ' (' + c.unidad + ')' : '')), ['No opera', 'Alertas', 'Estado registro', 'Folio']);
      ws.addRow(cab);
      ws.getRow(1).eachCell((cell) => {
        cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      ws.getRow(1).height = 30;
      for (const reg of porFormato[fid]) {
        for (const fila of reg.filas || []) {
          const vals = (reg.valores || {})[fila.id] || {};
          const alertas = [];
          const datos = f.tabla.columnas.map((c) => {
            if (M.omitida(fila, c)) return null;
            const v = vals[c.id];
            if (M.esAlerta(M.evaluar(c, fila, v))) alertas.push(c.label);
            if (c.tipo === 'numero') return U.aNumero(v);
            return v == null || v === '' ? null : M.textoValor(c, v);
          });
          const row = ws.addRow([U.parseISO(reg.fecha), M.nombreTurno(reg.turno), (reg.encabezado && reg.encabezado.inspector) || reg.creadoPor || '', fila.nombre, fila.codigo || '']
            .concat(datos, [vals._noOpera ? 'Sí' : '', alertas.join(', '), reg.estado === 'completo' ? 'Finalizado' : 'En proceso', reg.id.split('_').pop().toUpperCase()]));
          row.getCell(1).numFmt = 'dd/mm/yyyy';
          f.tabla.columnas.forEach((c, i) => {
            if (M.esAlerta(M.evaluar(c, fila, vals[c.id])) && !M.omitida(fila, c)) row.getCell(6 + i).font = { bold: true, color: { argb: ROJO } };
          });
        }
      }
      ws.columns.forEach((cc, i) => { cc.width = i < 5 ? [12, 12, 20, 22, 10][i] : 12; });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } };
    }
    if (!wb.worksheets.length) wb.addWorksheet('Sin datos');
    await guardar(wb, nombreArchivo('Datos_lecturas', registros));
  };

  /** Tabla simple (resultados de búsqueda). Las fechas (Date) salen con formato dd/mm/aaaa. */
  X.exportarTabla = async (nombreArchivo, nombreHoja, cabeceras, filas) => {
    const wb = nuevoLibro();
    const ws = wb.addWorksheet(nombreHoja.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(cabeceras);
    ws.getRow(1).eachCell((cell) => {
      cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
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
