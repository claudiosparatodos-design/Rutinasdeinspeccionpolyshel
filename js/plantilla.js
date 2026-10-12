/* ==========================================================================
   Dibuja las hojas de los formatos originales (plantillas/<id>.json, generadas
   con tools/convertir_plantillas.py) tal como se ven en Excel: anchos y altos
   exactos, bordes, rellenos, fuentes, celdas combinadas, logos y formas.
   Sobre la plantilla se colocan los datos capturados ("llenado"):
     celdas:   { 'B11': valor }               texto o número a escribir
     estilos:  { 'B11': { rellenoDe: 'D11', centrar: true } }
     formas:   { '4': '✓' }                    texto dentro de una forma (casillas)
     imagenes: [ { src, x, y, w, h } ]          firmas, en píxeles de la hoja
   ========================================================================== */
(function () {
  'use strict';

  const P = {};
  const cache = {};
  const PX_IN = 96;

  P.cargar = (id) => {
    if (!cache[id]) {
      cache[id] = fetch('plantillas/' + id + '.json').then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar la plantilla ' + id);
        return r.json();
      }).then(preparar).catch((e) => { delete cache[id]; throw e; });
    }
    return cache[id];
  };

  /* ---------------- Referencias de celda ---------------- */
  P.colNum = (letras) => { let n = 0; for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64); return n; };
  P.colLetra = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  P.ref = (c, r) => P.colLetra(c) + r;
  P.parse = (ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { c: P.colNum(m[1]), r: +m[2] }; };
  P.rango = (txt) => { const [a, b] = txt.split(':'); const p = P.parse(a), q = P.parse(b || a); return { c1: p.c, r1: p.r, c2: q.c, r2: q.r }; };
  /** Desplaza una referencia n columnas. */
  P.mover = (ref, dc, dr) => { const p = P.parse(ref); return P.ref(p.c + (dc || 0), p.r + (dr || 0)); };

  function preparar(pl) {
    for (const h of pl.hojas) {
      h.x = [0]; h.cols.forEach((w, i) => h.x.push(h.x[i] + w));
      h.y = [0]; h.filas.forEach((v, i) => h.y.push(h.y[i] + v));
      h.mapa = {}; // celda -> rango combinado al que pertenece
      h.rangos = h.combinadas.map(P.rango);
      for (const g of h.rangos) {
        for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) h.mapa[P.ref(c, r)] = g;
      }
    }
    pl.porNombre = {};
    pl.hojas.forEach((h) => { pl.porNombre[h.nombre] = h; });
    return pl;
  }

  P.hoja = (pl, nombre) => pl.porNombre[nombre] || pl.hojas[0];

  /** Rectángulo en píxeles de una celda (o de su rango combinado). */
  P.rect = (h, ref) => {
    const g = h.mapa[ref] || P.rango(ref);
    const c2 = Math.min(g.c2, h.cols.length), r2 = Math.min(g.r2, h.filas.length);
    return { x: h.x[g.c1 - 1], y: h.y[g.r1 - 1], w: h.x[c2] - h.x[g.c1 - 1], h: h.y[r2] - h.y[g.r1 - 1] };
  };

  /** Texto plano de una celda de la plantilla. */
  P.texto = (h, ref) => {
    const c = h.celdas[ref];
    if (!c) return '';
    if (c.r) return c.r.map((x) => x.t).join('');
    return c.v || '';
  };

  /* ---------------- Estilos → CSS ---------------- */
  // Comillas simples: estos valores van dentro de atributos style="..."
  const FAMILIAS = {
    calibri: "Calibri,Carlito,'Segoe UI',Arial,sans-serif",
    arial: "Arial,Arimo,'Helvetica Neue',Helvetica,sans-serif"
  };
  P.familia = (ff) => FAMILIAS[String(ff || '').toLowerCase()] || ("'" + String(ff || 'Calibri').replace(/['"]/g, '') + "',Carlito,Arial,sans-serif");

  function fuenteCSS(e) {
    let s = 'font-family:' + P.familia(e.ff) + ';font-size:' + (e.fs || 11) + 'pt;';
    if (e.b) s += 'font-weight:700;';
    if (e.i) s += 'font-style:italic;';
    if (e.u || e.st) s += 'text-decoration:' + (e.u ? 'underline ' : '') + (e.st ? 'line-through' : '') + ';';
    if (e.c) s += 'color:' + e.c + ';';
    return s;
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function contenidoCelda(dato) {
    if (dato == null) return '';
    if (dato.r) {
      return dato.r.map((x) => {
        let st = '';
        if (x.b) st += 'font-weight:700;';
        if (x.i) st += 'font-style:italic;';
        if (x.u) st += 'text-decoration:underline;';
        if (x.fs) st += 'font-size:' + x.fs + 'pt;';
        if (x.ff) st += 'font-family:' + P.familia(x.ff) + ';';
        if (x.c) st += 'color:' + x.c + ';';
        return st ? '<span style="' + st + '">' + esc(x.t) + '</span>' : esc(x.t);
      }).join('');
    }
    return esc(dato.v == null ? '' : dato.v);
  }

  /* ---------------- Dibujo ---------------- */
  /**
   * HTML de una hoja con su tamaño natural (px).
   * llenado = { celdas, estilos, formas, imagenes }
   */
  P.dibujar = (pl, h, llenado) => {
    llenado = llenado || {};
    const sobre = llenado.celdas || {};
    const estOver = llenado.estilos || {};
    const C = h.cols.length, Rn = h.filas.length;
    const estilo = (ref) => {
      const base = pl.estilos[(h.celdas[ref] || {}).s || 0] || {};
      const o = estOver[ref];
      if (!o) return base;
      const e = Object.assign({}, base);
      if (o.rellenoDe) { const otro = pl.estilos[(h.celdas[o.rellenoDe] || {}).s || 0] || {}; if (otro.bg) e.bg = otro.bg; else delete e.bg; }
      if (o.centrar) { e.ha = 'center'; e.va = 'center'; }
      if (o.ajustar) { e.ha = 'left'; e.va = 'top'; e.w = 1; }
      if (o.reducir) e.sh = 1;
      return e;
    };

    // Celdas a considerar: las de la plantilla y las que se llenan
    const refs = new Set(Object.keys(h.celdas));
    Object.keys(sobre).forEach((k) => refs.add(h.mapa[k] ? P.ref(h.mapa[k].c1, h.mapa[k].r1) : k));

    let fondos = '', textos = '';
    // Bordes de una celda; en combinadas solo el perímetro, y si la celda del
    // borde no trae estilo se usa el de la celda superior izquierda.
    const bordesCelda = (c, r, e, g) => {
      const tl = g ? estilo(P.ref(g.c1, g.r1)) : null;
      const lado = (k) => e[k] || (tl && tl[k]);
      const x0 = h.x[c - 1], x1 = h.x[c], y0 = h.y[r - 1], y1 = h.y[r];
      if ((!g || r === g.r1) && lado('bt')) linea('h' + (r - 1) + ':' + c, x0, y0, x1, y0, lado('bt'));
      if ((!g || r === g.r2) && lado('bb')) linea('h' + r + ':' + c, x0, y1, x1, y1, lado('bb'));
      if ((!g || c === g.c1) && lado('bl')) linea('v' + (c - 1) + ':' + r, x0, y0, x0, y1, lado('bl'));
      if ((!g || c === g.c2) && lado('br')) linea('v' + c + ':' + r, x1, y0, x1, y1, lado('br'));
    };
    const lineas = new Map(); // clave -> [x1,y1,x2,y2,ancho,tipo,color]
    const linea = (clave, x1, y1, x2, y2, b) => {
      const prev = lineas.get(clave);
      if (!prev || b[0] > prev[4]) lineas.set(clave, [x1, y1, x2, y2, b[0], b[1], b[2]]);
    };

    for (const ref of refs) {
      const p = P.parse(ref);
      if (p.c > C || p.r > Rn) continue;
      const g = h.mapa[ref];
      let e = estilo(ref);
      if (!g) bordesCelda(p.c, p.r, e, null);
      // Solo la celda superior izquierda de una combinada lleva fondo y texto
      if (g && (g.c1 !== p.c || g.r1 !== p.r)) continue;
      const rc = P.rect(h, ref);
      if (e.bg) fondos += '<div class="xl-f" style="left:' + rc.x + 'px;top:' + rc.y + 'px;width:' + rc.w + 'px;height:' + rc.h + 'px;background:' + e.bg + '"></div>';
      const tieneSobre = Object.prototype.hasOwnProperty.call(sobre, ref);
      const valor = tieneSobre ? sobre[ref] : null;
      const dato = tieneSobre ? (valor == null || valor === '' ? null : { v: valor }) : h.celdas[ref];
      if (!dato || (dato.v == null && !dato.r) || (dato.v === '')) continue;
      const esNum = tieneSobre ? typeof valor === 'number' : !!dato.n;
      let ha = e.ha || (esNum ? 'right' : 'left');
      if (ha === 'centerContinuous') ha = 'center';
      if (ha === 'distributed' || ha === 'fill') ha = 'justify';
      const va = e.va === 'top' ? 'flex-start' : (e.va === 'center' || e.va === 'justify' || e.va === 'distributed') ? 'center' : 'flex-end';
      const jc = ha === 'center' ? 'center' : ha === 'right' ? 'flex-end' : 'flex-start';
      const sangria = e.in ? e.in * 9 : 0;
      // "Reducir hasta ajustar" de Excel: achica la letra si el texto no cabe
      if (e.sh && !e.w && dato.v != null) {
        const largo = String(dato.v).length * (e.fs || 11) * 4 / 3 * 0.56;
        if (largo > rc.w - 3) e = Object.assign({}, e, { fs: Math.max(5, (e.fs || 11) * (rc.w - 3) / largo) });
      }
      textos += '<div class="xl-t' + (e.w ? ' xl-w' : '') + '" style="left:' + rc.x + 'px;top:' + rc.y + 'px;width:' + rc.w + 'px;height:' + rc.h + 'px;align-items:' + va + ';justify-content:' + jc + ';text-align:' + ha + ';' +
        (sangria ? 'padding-left:' + (2 + sangria) + 'px;' : '') + fuenteCSS(e) + '"><span>' + contenidoCelda(dato) + '</span></div>';
    }

    for (const g of h.rangos) {
      for (let r = g.r1; r <= Math.min(g.r2, Rn); r++) {
        for (let c = g.c1; c <= Math.min(g.c2, C); c++) {
          if (r !== g.r1 && r !== g.r2 && c !== g.c1 && c !== g.c2) continue;
          bordesCelda(c, r, estilo(P.ref(c, r)), g);
        }
      }
    }

    let svg = '';
    for (const [x1, y1, x2, y2, w, tipo, color] of lineas.values()) {
      const dash = tipo === 'dashed' ? ' stroke-dasharray="3 2"' : tipo === 'dotted' ? ' stroke-dasharray="1 1.5"' : '';
      if (tipo === 'double') {
        const dx = x1 === x2 ? 1 : 0, dy = y1 === y2 ? 1 : 0;
        svg += '<line x1="' + (x1 - dx) + '" y1="' + (y1 - dy) + '" x2="' + (x2 - dx) + '" y2="' + (y2 - dy) + '" stroke="' + color + '" stroke-width="0.8"/>';
        svg += '<line x1="' + (x1 + dx) + '" y1="' + (y1 + dy) + '" x2="' + (x2 + dx) + '" y2="' + (y2 + dy) + '" stroke="' + color + '" stroke-width="0.8"/>';
      } else {
        svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="square"' + dash + '/>';
      }
    }

    // Dibujos: imágenes y formas
    let capa = '';
    const formas = llenado.formas || {};
    for (const d of h.dibujos) {
      const pos = 'left:' + d.x + 'px;top:' + d.y + 'px;width:' + d.w + 'px;height:' + d.h + 'px';
      if (d.tipo === 'img') { capa += '<img class="xl-img" alt="" src="' + d.src + '" style="' + pos + '">'; continue; }
      const sw = d.linea ? d.grosor || 1 : 0;
      const relleno = d.relleno || 'none';
      const trazo = d.linea ? ' stroke="' + d.linea + '" stroke-width="' + sw + '"' : '';
      let figura;
      if (d.geom === 'path' && d.d) figura = '<path d="' + d.d + '" fill="' + relleno + '"' + trazo + ' stroke-linejoin="round"/>';
      else if (d.geom === 'ellipse') figura = '<ellipse cx="' + d.w / 2 + '" cy="' + d.h / 2 + '" rx="' + Math.max(0, d.w / 2 - sw / 2) + '" ry="' + Math.max(0, d.h / 2 - sw / 2) + '" fill="' + relleno + '"' + trazo + '/>';
      else if (d.geom === 'line' || d.geom === 'straightConnector1') figura = '<line x1="0" y1="0" x2="' + d.w + '" y2="' + d.h + '"' + (trazo || ' stroke="#000"') + '/>';
      else figura = '<rect x="' + sw / 2 + '" y="' + sw / 2 + '" width="' + Math.max(0, d.w - sw) + '" height="' + Math.max(0, d.h - sw) + '" fill="' + relleno + '"' + trazo + '/>';
      capa += '<svg class="xl-forma" style="' + pos + '" viewBox="0 0 ' + d.w + ' ' + d.h + '" preserveAspectRatio="none" overflow="visible">' + figura + '</svg>';
      if (d.texto) {
        const just = d.ancla === 'ctr' ? 'center' : d.ancla === 'b' ? 'flex-end' : 'flex-start';
        capa += '<div class="xl-ftexto" style="' + pos + ';justify-content:' + just + ';color:' + (d.colorTexto || '#000') + ';font-family:' + P.familia(pl.fuente) + '">' +
          d.texto.map((p) => '<div style="text-align:' + ({ ctr: 'center', r: 'right', just: 'justify' }[p.algn] || 'left') + ';font-size:' + (p.fs || (p.runs[0] && p.runs[0].fs) || 11) + 'pt">' +
            (p.runs.length ? p.runs.map((r) => '<span style="font-size:' + (r.fs || 11) + 'pt;' + (r.b ? 'font-weight:700;' : '') + (r.i ? 'font-style:italic;' : '') + (r.c ? 'color:' + r.c + ';' : '') + '">' + esc(r.t) + '</span>').join('') : '&nbsp;') + '</div>').join('') +
          '</div>';
      }
      if (formas[d.id]) {
        capa += '<div class="xl-marca" style="' + pos + ';font-size:' + Math.max(8, Math.min(d.h * 0.95, d.w * 0.9)) + 'px">' + esc(formas[d.id]) + '</div>';
      }
    }
    for (const im of llenado.imagenes || []) {
      capa += '<img class="xl-img" alt="" src="' + im.src + '" style="left:' + im.x + 'px;top:' + im.y + 'px;width:' + im.w + 'px;height:' + im.h + 'px;object-fit:contain">';
    }

    return '<div class="xl-hoja" style="width:' + h.ancho + 'px;height:' + h.alto + 'px">' +
      fondos +
      '<svg class="xl-lineas" width="' + h.ancho + '" height="' + h.alto + '" viewBox="0 0 ' + h.ancho + ' ' + h.alto + '">' + svg + '</svg>' +
      textos + capa + '</div>';
  };

  /** Tamaño de papel carta en px según orientación. */
  P.papel = (h) => (h.pagina.orientacion === 'portrait' ? { w: 8.5 * PX_IN, h: 11 * PX_IN } : { w: 11 * PX_IN, h: 8.5 * PX_IN });

  /** Escala y posición de la hoja dentro del papel, como la imprimiría Excel. */
  P.acomodo = (h) => {
    const pg = h.pagina, papel = P.papel(h), m = pg.margenes || { l: 0.7, r: 0.7, t: 0.75, b: 0.75 };
    const utilW = papel.w - (m.l + m.r) * PX_IN, utilH = papel.h - (m.t + m.b) * PX_IN;
    const ajuste = Math.min(utilW / h.ancho, utilH / h.alto);
    // La escala guardada en el Excel ya considera los márgenes de la impresora;
    // además se limita para que siempre quepa en una sola hoja.
    const s = Math.min((pg.escala || 100) / 100, ajuste, 1);
    let x = m.l * PX_IN, y = m.t * PX_IN;
    if (pg.centrarH) x += (utilW - h.ancho * s) / 2;
    if (pg.centrarV) y += (utilH - h.alto * s) / 2;
    return { s, x, y, papel };
  };

  /** HTML de una página de papel con la hoja acomodada. */
  P.pagina = (pl, h, llenado) => {
    const a = P.acomodo(h);
    return '<div class="xl-pagina ' + (h.pagina.orientacion === 'portrait' ? 'xl-vertical' : 'xl-horizontal') + '" style="width:' + a.papel.w + 'px;height:' + a.papel.h + 'px">' +
      '<div class="xl-pos" style="left:' + a.x + 'px;top:' + a.y + 'px;transform:scale(' + a.s + ')">' + P.dibujar(pl, h, llenado) + '</div></div>';
  };

  window.P = P;
})();
