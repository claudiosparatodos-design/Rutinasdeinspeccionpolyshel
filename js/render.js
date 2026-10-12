/* Dibuja la hoja del formato (réplica del papel) para vista previa e impresión. */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const R = {};
  const e = U.esc;

  R.etiquetaColumna = (c) => {
    const conUnidad = c.unidad && !(c.grupo && c.grupo.includes(c.unidad));
    return e(c.label) + (conUnidad ? '<span class="h-unidad">(' + e(c.unidad) + ')</span>' : '');
  };

  R.logoHTML = () => CFG.logo
    ? '<img src="' + e(CFG.logo) + '" alt="' + e(CFG.empresa) + '">'
    : '<div class="h-logo-txt">' + e(CFG.empresa || '') + '</div>';

  R.valorEncabezado = (campo, reg) => {
    const v = reg && reg.encabezado ? reg.encabezado[campo.id] : '';
    if (!v) return '';
    if (campo.tipo === 'fecha') return U.fechaCorta(v);
    if (campo.tipo === 'turno') return M.nombreTurno(v);
    return v;
  };

  /**
   * Genera el HTML de una hoja. reg = null produce el formato en blanco.
   * opciones: { folio: bool }
   */
  R.hoja = (formato, reg, opciones) => {
    opciones = opciones || {};
    const filas = (reg && reg.filas) || M.filasVigentes(formato);
    const cols = formato.tabla.columnas;
    const grupos = M.gruposColumnas(cols);
    const hayGrupos = grupos.some((g) => g.grupo);
    const orient = (formato.hoja && formato.hoja.orientacion) || 'horizontal';

    // Anchos relativos de columnas
    const anchos = [formato.tabla.anchoFila || 18].concat(cols.map((c) => c.ancho || 7));
    const total = anchos.reduce((a, b) => a + b, 0);
    const colgroup = '<colgroup>' + anchos.map((a) => '<col style="width:' + (a / total * 100).toFixed(3) + '%">').join('') + '</colgroup>';

    // Encabezado de la tabla
    let thead = '<thead><tr><th class="h-th-fila" rowspan="' + (hayGrupos ? 2 : 1) + '">' + e(formato.tabla.titulo) + '</th>';
    for (const g of grupos) {
      if (g.grupo) thead += '<th colspan="' + g.cols.length + '" class="h-grupo">' + e(g.grupo) + '</th>';
      else thead += '<th rowspan="' + (hayGrupos ? 2 : 1) + '">' + R.etiquetaColumna(g.cols[0]) + '</th>';
    }
    thead += '</tr>';
    if (hayGrupos) {
      thead += '<tr>';
      for (const g of grupos) if (g.grupo) for (const c of g.cols) thead += '<th>' + R.etiquetaColumna(c) + '</th>';
      thead += '</tr>';
    }
    // Fila de rangos (si hay límites generales)
    const hayRangos = cols.some((c) => c.tipo === 'numero' && (c.min != null || c.max != null));
    if (hayRangos) {
      thead += '<tr class="h-rangos"><th>Rango</th>';
      for (const c of cols) {
        const lim = c.tipo === 'numero' ? M.limite(c, null) : null;
        thead += '<th>' + (lim ? e(M.textoLimite(lim)) : '') + '</th>';
      }
      thead += '</tr>';
    }
    thead += '</thead>';

    // Cuerpo
    let tbody = '<tbody>';
    for (const f of filas) {
      const vals = (reg && reg.valores && reg.valores[f.id]) || {};
      tbody += '<tr><th class="h-fila">' + e(f.nombre) + (f.codigo ? '<small>' + e(f.codigo) + '</small>' : '') + '</th>';
      for (const c of cols) {
        if (M.omitida(f, c)) { tbody += '<td class="h-omit"></td>'; continue; }
        const v = vals[c.id];
        let txt = M.textoValor(c, v);
        const ev = M.evaluar(c, f, v);
        let cls = c.tipo === 'texto' ? 'h-txt' : '';
        if (M.esAlerta(ev)) cls += ' h-fuera';
        if (!txt && vals._noOpera && c.tipo !== 'texto') { txt = '—'; cls += ' h-noop'; }
        if (c.tipo === 'check' && v === 'ok') cls += ' h-ok';
        // En el formato en blanco, el rango propio de la máquina se anota en la celda
        const limF = f.limites && f.limites[c.id];
        const marca = !reg && limF ? '<span class="h-limf">' + e(M.textoLimite(limF)) + '</span>' : '';
        tbody += '<td class="' + cls.trim() + '">' + e(txt) + marca + '</td>';
      }
      tbody += '</tr>';
    }
    tbody += '</tbody>';

    // Datos generales
    let datos = '<table class="h-datos"><tr>';
    for (const c of formato.encabezado) {
      datos += '<td style="width:' + ((c.ancho || 1) / formato.encabezado.reduce((a, x) => a + (x.ancho || 1), 0) * 100).toFixed(2) + '%">' +
        '<span class="h-lbl">' + e(c.label) + ':</span> <span class="h-val">' + e(R.valorEncabezado(c, reg)) + '</span></td>';
    }
    datos += '</tr></table>';

    // Pie
    let pie = '';
    for (const p of formato.pie || []) {
      const v = reg && reg.pie ? reg.pie[p.id] : '';
      pie += '<div class="h-pie"><div class="h-lbl">' + e(p.label) + ':</div>' +
        '<div class="h-pie-txt" style="min-height:' + ((p.lineas || 3) * 5.2) + 'mm">' + e(v || '').replace(/\n/g, '<br>') + '</div></div>';
    }

    // Firmas
    let firmas = '';
    if (formato.firmas && formato.firmas.length) {
      firmas = '<div class="h-firmas">';
      for (const f of formato.firmas) {
        const d = (reg && reg.firmas && reg.firmas[f.id]) || {};
        firmas += '<div class="h-firma"><div class="h-firma-img">' + (U.srcImagen(d.img) ? '<img src="' + U.srcImagen(d.img) + '" alt="Firma">' : '') + '</div>' +
          '<div class="h-firma-nombre">' + e(d.nombre || '') + '</div>' +
          '<div class="h-firma-lbl"><b>' + e(f.label) + '</b>' + (f.sub ? ' · ' + e(f.sub) : '') + '</div></div>';
      }
      firmas += '</div>';
    }

    const folio = reg && opciones.folio !== false
      ? '<div class="h-folio"><span>Folio: ' + e(reg.id.split('_').pop().toUpperCase()) + '</span>' +
        '<span>Capturado por ' + e(reg.creadoPor || '—') + ' · ' + e(U.fechaHora(reg.creadoEn)) +
        (reg.modificadoEn && reg.modificadoEn - reg.creadoEn > 60000 ? ' · Modificado ' + e(U.fechaHora(reg.modificadoEn)) : '') + '</span>' +
        '<span>' + (reg.estado === 'completo' ? 'Registro finalizado' : 'Registro en proceso') + '</span></div>'
      : '';

    return '<div class="hoja hoja-' + orient + '">' +
      '<table class="h-cab"><tr>' +
        '<td class="h-logo" rowspan="3">' + R.logoHTML() + '</td>' +
        '<td class="h-titulo" rowspan="2">' + e(formato.titulo) + '</td>' +
        '<td class="h-meta"><span class="h-lbl">Código:</span> ' + e(formato.codigo) + '</td></tr>' +
        '<tr><td class="h-meta"><span class="h-lbl">Revisión:</span> ' + e(formato.revision) + '</td></tr>' +
        '<tr><td class="h-sub">' + e(formato.subtitulo || '') + (formato.area ? ' &nbsp;·&nbsp; Área: ' + e(formato.area) : '') + '</td>' +
        '<td class="h-meta"><span class="h-lbl">Vigencia:</span> ' + e(formato.vigencia || '') + '</td></tr>' +
      '</table>' +
      datos +
      '<table class="h-tabla">' + colgroup + thead + tbody + '</table>' +
      pie +
      (formato.notas ? '<div class="h-notas">' + e(formato.notas) + '</div>' : '') +
      firmas +
      folio +
    '</div>';
  };

  window.R = R;
})();
