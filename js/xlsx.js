/* ==========================================================================
   Exporta a Excel llenando el archivo ORIGINAL del formato (plantillas/<id>.xlsx).
   Se edita directamente el XML del libro: se conservan estilos, celdas
   combinadas, logos, formas, configuración de impresión… todo igual; solo se
   escriben los datos capturados. Cada página es una copia de la hoja original.
   ========================================================================== */
(function () {
  'use strict';

  const NS = {
    m: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    pr: 'http://schemas.openxmlformats.org/package/2006/relationships',
    ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
    xdr: 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main'
  };
  const T = {
    hoja: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
    imagen: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
    ctHoja: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
    ctDibujo: 'application/vnd.openxmlformats-officedocument.drawing+xml'
  };
  const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const EMU = 9525;

  const XL = {};
  const parse = (txt) => new DOMParser().parseFromString(txt, 'application/xml');
  const ser = (doc) => DECL + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  const hijos = (el, ns, nombre) => Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.namespaceURI === ns && n.localName === nombre);
  const uno = (doc, ns, nombre) => doc.getElementsByTagNameNS(ns, nombre)[0];

  const carpeta = (ruta) => ruta.slice(0, ruta.lastIndexOf('/'));
  const rutaRels = (ruta) => carpeta(ruta) + '/_rels/' + ruta.slice(ruta.lastIndexOf('/') + 1) + '.rels';
  function resolver(base, destino) {
    if (destino.startsWith('/')) return destino.slice(1);
    const partes = carpeta(base).split('/');
    for (const p of destino.split('/')) {
      if (p === '..') partes.pop(); else if (p !== '.') partes.push(p);
    }
    return partes.join('/');
  }
  function relativo(desde, hacia) {
    const a = carpeta(desde).split('/'), b = hacia.split('/');
    let i = 0;
    while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
    return '../'.repeat(a.length - i) + b.slice(i).join('/');
  }

  const colNum = (letras) => { let n = 0; for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64); return n; };
  const partes = (ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { c: colNum(m[1]), r: +m[2] }; };

  /* ---------------- Celdas ---------------- */
  function celda(doc, ref, crear) {
    const sd = uno(doc, NS.m, 'sheetData');
    const { c, r } = partes(ref);
    let fila = null, antes = null;
    for (const f of hijos(sd, NS.m, 'row')) {
      const n = +f.getAttribute('r');
      if (n === r) { fila = f; break; }
      if (n > r) { antes = f; break; }
    }
    if (!fila) {
      if (!crear) return null;
      fila = doc.createElementNS(NS.m, 'row');
      fila.setAttribute('r', r);
      sd.insertBefore(fila, antes);
    }
    let cel = null; antes = null;
    for (const x of hijos(fila, NS.m, 'c')) {
      const n = partes(x.getAttribute('r')).c;
      if (n === c) { cel = x; break; }
      if (n > c) { antes = x; break; }
    }
    if (!cel && crear) {
      cel = doc.createElementNS(NS.m, 'c');
      cel.setAttribute('r', ref);
      if (fila.getAttribute('customFormat') === '1' && fila.getAttribute('s')) cel.setAttribute('s', fila.getAttribute('s'));
      fila.insertBefore(cel, antes);
    }
    return cel;
  }

  function escribir(doc, ref, valor) {
    const cel = celda(doc, ref, true);
    while (cel.firstChild) cel.removeChild(cel.firstChild);
    cel.removeAttribute('t');
    if (valor == null || valor === '') return cel;
    if (typeof valor === 'number' && isFinite(valor)) {
      const v = doc.createElementNS(NS.m, 'v');
      v.textContent = String(valor);
      cel.appendChild(v);
    } else {
      cel.setAttribute('t', 'inlineStr');
      const is = doc.createElementNS(NS.m, 'is');
      const t = doc.createElementNS(NS.m, 't');
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
      t.textContent = String(valor);
      is.appendChild(t);
      cel.appendChild(is);
    }
    return cel;
  }

  /* ---------------- Estilos (copias con otro relleno o alineación) ---------------- */
  function crearEstilos(stylesDoc) {
    const cellXfs = uno(stylesDoc, NS.m, 'cellXfs');
    const cache = {};
    let cambiado = false;
    return {
      get cambiado() { return cambiado; },
      variante(s, o, sRelleno) {
        const clave = s + '|' + (sRelleno == null ? '' : sRelleno) + '|' + (o.centrar ? 'c' : '') + (o.ajustar ? 'a' : '') + (o.reducir ? 'r' : '');
        if (cache[clave] != null) return cache[clave];
        const xfs = hijos(cellXfs, NS.m, 'xf');
        const xf = (xfs[s] || xfs[0]).cloneNode(true);
        if (sRelleno != null) {
          xf.setAttribute('fillId', (xfs[sRelleno] || xfs[0]).getAttribute('fillId') || '0');
          xf.setAttribute('applyFill', '1');
        }
        if (o.centrar || o.ajustar || o.reducir) {
          let al = hijos(xf, NS.m, 'alignment')[0];
          if (!al) { al = stylesDoc.createElementNS(NS.m, 'alignment'); xf.insertBefore(al, xf.firstChild); }
          if (o.centrar) { al.setAttribute('horizontal', 'center'); al.setAttribute('vertical', 'center'); }
          if (o.ajustar) { al.setAttribute('horizontal', 'left'); al.setAttribute('vertical', 'top'); al.setAttribute('wrapText', '1'); }
          if (o.reducir) { al.setAttribute('shrinkToFit', '1'); al.removeAttribute('wrapText'); }
          xf.setAttribute('applyAlignment', '1');
        }
        cellXfs.appendChild(xf);
        const idx = hijos(cellXfs, NS.m, 'xf').length - 1;
        cellXfs.setAttribute('count', idx + 1);
        cambiado = true;
        cache[clave] = idx;
        return idx;
      }
    };
  }

  function aplicarLlenado(doc, llenado, estilos) {
    const sDe = (ref) => { const c = celda(doc, ref, false); return c ? +(c.getAttribute('s') || 0) : 0; };
    const est = llenado.estilos || {};
    // Primero los estilos (los rellenos se toman de la plantilla original)
    const sRellenos = {};
    for (const ref in est) if (est[ref].rellenoDe) sRellenos[ref] = sDe(est[ref].rellenoDe);
    for (const ref in est) {
      const cel = celda(doc, ref, true);
      const s = +(cel.getAttribute('s') || 0);
      cel.setAttribute('s', estilos.variante(s, est[ref], sRellenos[ref]));
    }
    for (const ref in (llenado.celdas || {})) escribir(doc, ref, llenado.celdas[ref]);
  }

  /* ---------------- Dibujos: palomas en casillas y firmas ---------------- */
  function marcarForma(dDoc, id, texto) {
    for (const sp of Array.from(dDoc.getElementsByTagNameNS(NS.xdr, 'sp'))) {
      const nv = sp.getElementsByTagNameNS(NS.xdr, 'cNvPr')[0];
      if (!nv || nv.getAttribute('id') !== String(id)) continue;
      let tx = hijos(sp, NS.xdr, 'txBody')[0];
      if (!tx) {
        tx = dDoc.createElementNS(NS.xdr, 'xdr:txBody');
        tx.appendChild(dDoc.createElementNS(NS.a, 'a:bodyPr'));
        tx.appendChild(dDoc.createElementNS(NS.a, 'a:lstStyle'));
        sp.appendChild(tx);
      }
      const body = hijos(tx, NS.a, 'bodyPr')[0];
      if (body) {
        body.setAttribute('anchor', 'ctr');
        body.setAttribute('vertOverflow', 'overflow');
        body.setAttribute('horzOverflow', 'overflow');
        body.setAttribute('wrap', 'none');
        ['lIns', 'tIns', 'rIns', 'bIns'].forEach((k) => body.setAttribute(k, '0'));
      }
      // Tamaño de la paloma según la altura de la casilla
      const ext = sp.getElementsByTagNameNS(NS.a, 'ext')[0];
      const altoPt = ext ? (+ext.getAttribute('cy') || 0) / 12700 : 14;
      const sz = Math.max(600, Math.min(1400, Math.round(altoPt * 0.85) * 100));
      hijos(tx, NS.a, 'p').forEach((p) => tx.removeChild(p));
      const p = dDoc.createElementNS(NS.a, 'a:p');
      const ppr = dDoc.createElementNS(NS.a, 'a:pPr'); ppr.setAttribute('algn', 'ctr'); p.appendChild(ppr);
      const r = dDoc.createElementNS(NS.a, 'a:r');
      const rpr = dDoc.createElementNS(NS.a, 'a:rPr');
      rpr.setAttribute('lang', 'es-MX'); rpr.setAttribute('sz', String(sz)); rpr.setAttribute('b', '1');
      const fill = dDoc.createElementNS(NS.a, 'a:solidFill');
      const clr = dDoc.createElementNS(NS.a, 'a:srgbClr'); clr.setAttribute('val', '000000'); fill.appendChild(clr); rpr.appendChild(fill);
      const lat = dDoc.createElementNS(NS.a, 'a:latin'); lat.setAttribute('typeface', 'Segoe UI Symbol'); rpr.appendChild(lat);
      const sym = dDoc.createElementNS(NS.a, 'a:sym'); sym.setAttribute('typeface', 'Segoe UI Symbol'); rpr.appendChild(sym);
      r.appendChild(rpr);
      const t = dDoc.createElementNS(NS.a, 'a:t'); t.textContent = texto; r.appendChild(t);
      p.appendChild(r);
      tx.appendChild(p);
    }
  }

  /** Convierte píxeles de la hoja a celda + desplazamiento (EMU). */
  function anclaje(arr, px) {
    let i = 0;
    while (i < arr.length - 2 && arr[i + 1] <= px) i++;
    return { idx: i, off: Math.max(0, Math.round((px - arr[i]) * EMU)) };
  }

  function agregarImagen(dDoc, relsDoc, idRel, im, h, nId) {
    const raiz = dDoc.documentElement;
    const c = anclaje(h.x, im.x), r = anclaje(h.y, im.y);
    const cx = Math.round(im.w * EMU), cy = Math.round(im.h * EMU);
    const xml =
      '<xdr:oneCellAnchor xmlns:xdr="' + NS.xdr + '" xmlns:a="' + NS.a + '" xmlns:r="' + NS.r + '">' +
        '<xdr:from><xdr:col>' + c.idx + '</xdr:col><xdr:colOff>' + c.off + '</xdr:colOff><xdr:row>' + r.idx + '</xdr:row><xdr:rowOff>' + r.off + '</xdr:rowOff></xdr:from>' +
        '<xdr:ext cx="' + cx + '" cy="' + cy + '"/>' +
        '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + nId + '" name="Firma ' + nId + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
        '<xdr:blipFill><a:blip r:embed="' + idRel + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
        '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>' +
        '<xdr:clientData/></xdr:oneCellAnchor>';
    const nodo = dDoc.importNode(parse(xml).documentElement, true);
    raiz.appendChild(nodo);
  }

  function nuevoRels() {
    return parse('<Relationships xmlns="' + NS.pr + '"></Relationships>');
  }
  function agregarRel(relsDoc, id, tipo, destino) {
    const el = relsDoc.createElementNS(NS.pr, 'Relationship');
    el.setAttribute('Id', id); el.setAttribute('Type', tipo); el.setAttribute('Target', destino);
    relsDoc.documentElement.appendChild(el);
  }

  const nombreValido = (s, usados) => {
    let base = String(s || 'Hoja').replace(/[\\/?*[\]:]/g, '-').replace(/^'+|'+$/g, '').slice(0, 31).trim() || 'Hoja';
    let n = base, i = 2;
    while (usados.has(n.toLowerCase())) { const suf = ' (' + i++ + ')'; n = base.slice(0, 31 - suf.length) + suf; }
    usados.add(n.toLowerCase());
    return n;
  };

  /**
   * paginas: [{ hoja: 'Nombre de hoja original', nombre: 'Nombre de la pestaña', llenado }]
   * pl: plantilla JSON ya cargada (para convertir píxeles a celdas en firmas).
   */
  XL.exportar = async (pl, paginas, nombreArchivo) => {
    if (!window.JSZip) await V.cargarScript('vendor/jszip.min.js');
    const res = await fetch('plantillas/' + pl.id + '.xlsx');
    if (!res.ok) throw new Error('No se encontró el Excel original del formato');
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const leer = async (ruta) => { const f = zip.file(ruta); return f ? parse(await f.async('string')) : null; };

    const wb = await leer('xl/workbook.xml');
    const wbRels = await leer('xl/_rels/workbook.xml.rels');
    const ct = await leer('[Content_Types].xml');
    const stylesDoc = await leer('xl/styles.xml');
    const estilos = crearEstilos(stylesDoc);

    const relPorId = {};
    for (const r of hijos(wbRels.documentElement, NS.pr, 'Relationship')) relPorId[r.getAttribute('Id')] = r;
    const sheetsEl = uno(wb, NS.m, 'sheets');
    const originales = hijos(sheetsEl, NS.m, 'sheet').map((el) => {
      const rid = el.getAttributeNS(NS.r, 'id');
      return { el, nombre: el.getAttribute('name'), rid, ruta: resolver('xl/workbook.xml', relPorId[rid].getAttribute('Target')) };
    });

    const numMax = (re) => Math.max(0, ...Object.keys(zip.files).map((k) => { const m = re.exec(k); return m ? +m[1] : 0; }));
    let nHoja = numMax(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    let nDib = numMax(/^xl\/drawings\/drawing(\d+)\.xml$/);
    let nImp = numMax(/^xl\/printerSettings\/printerSettings(\d+)\.bin$/);
    let nMedia = numMax(/^xl\/media\/firma(\d+)\.png$/);
    let sheetId = Math.max(0, ...originales.map((o) => +o.el.getAttribute('sheetId')));
    let nRel = 1000;
    const usados = new Set();

    const override = (ruta, tipo) => {
      const el = ct.createElementNS(NS.ct, 'Override');
      el.setAttribute('PartName', '/' + ruta); el.setAttribute('ContentType', tipo);
      ct.documentElement.appendChild(el);
    };
    if (!hijos(ct.documentElement, NS.ct, 'Default').some((d) => d.getAttribute('Extension') === 'png')) {
      const d = ct.createElementNS(NS.ct, 'Default'); d.setAttribute('Extension', 'png'); d.setAttribute('ContentType', 'image/png');
      ct.documentElement.insertBefore(d, ct.documentElement.firstChild);
    }

    let primera = true;
    for (const pag of paginas) {
      const orig = originales.find((o) => o.nombre === pag.hoja);
      if (!orig) continue;
      const h = (pl.porNombre && pl.porNombre[pag.hoja]) || pl.hojas.find((x) => x.nombre === pag.hoja);
      const ruta = 'xl/worksheets/sheet' + (++nHoja) + '.xml';
      const hojaDoc = await leer(orig.ruta);
      aplicarLlenado(hojaDoc, pag.llenado || {}, estilos);
      for (const sv of Array.from(hojaDoc.getElementsByTagNameNS(NS.m, 'sheetView'))) {
        if (primera) sv.setAttribute('tabSelected', '1'); else sv.removeAttribute('tabSelected');
      }
      // Relaciones de la hoja (dibujo, configuración de impresora)
      const relsO = await leer(rutaRels(orig.ruta));
      const relsN = nuevoRels();
      if (relsO) {
        for (const rel of hijos(relsO.documentElement, NS.pr, 'Relationship')) {
          const tipo = rel.getAttribute('Type');
          const destino = resolver(orig.ruta, rel.getAttribute('Target'));
          if (/\/drawing$/.test(tipo)) {
            const rutaD = 'xl/drawings/drawing' + (++nDib) + '.xml';
            const dDoc = await leer(destino);
            const dRelsO = await leer(rutaRels(destino));
            const dRels = nuevoRels();
            if (dRelsO) {
              for (const r2 of hijos(dRelsO.documentElement, NS.pr, 'Relationship')) {
                agregarRel(dRels, r2.getAttribute('Id'), r2.getAttribute('Type'), relativo(rutaD, resolver(destino, r2.getAttribute('Target'))));
              }
            }
            const formas = (pag.llenado && pag.llenado.formas) || {};
            for (const id in formas) if (formas[id]) marcarForma(dDoc, id, formas[id]);
            let nId = 5000;
            for (const im of (pag.llenado && pag.llenado.imagenes) || []) {
              const m = /^data:image\/png;base64,(.+)$/.exec(im.src || '');
              if (!m || !h) continue;
              const rutaM = 'xl/media/firma' + (++nMedia) + '.png';
              zip.file(rutaM, m[1], { base64: true });
              const idRel = 'rIdF' + nMedia;
              agregarRel(dRels, idRel, T.imagen, relativo(rutaD, rutaM));
              agregarImagen(dDoc, dRels, idRel, im, h, ++nId);
            }
            zip.file(rutaD, ser(dDoc));
            zip.file(rutaRels(rutaD), ser(dRels));
            override(rutaD, T.ctDibujo);
            agregarRel(relsN, rel.getAttribute('Id'), tipo, relativo(ruta, rutaD));
          } else if (/\/printerSettings$/.test(tipo)) {
            const f = zip.file(destino);
            if (!f) continue;
            const rutaP = 'xl/printerSettings/printerSettings' + (++nImp) + '.bin';
            zip.file(rutaP, await f.async('uint8array'));
            agregarRel(relsN, rel.getAttribute('Id'), tipo, relativo(ruta, rutaP));
          } else if (rel.getAttribute('TargetMode') === 'External') {
            agregarRel(relsN, rel.getAttribute('Id'), tipo, rel.getAttribute('Target'));
          }
        }
      }
      zip.file(ruta, ser(hojaDoc));
      zip.file(rutaRels(ruta), ser(relsN));
      override(ruta, T.ctHoja);
      const rid = 'rId' + (++nRel);
      agregarRel(wbRels, rid, T.hoja, ruta.replace(/^xl\//, ''));
      const sh = wb.createElementNS(NS.m, 'sheet');
      sh.setAttribute('name', nombreValido(pag.nombre || pag.hoja, usados));
      sh.setAttribute('sheetId', ++sheetId);
      sh.setAttributeNS(NS.r, 'r:id', rid);
      sheetsEl.appendChild(sh);
      primera = false;
    }

    // Quitar las hojas originales (y sus partes) del libro
    const overrides = hijos(ct.documentElement, NS.ct, 'Override');
    const quitarParte = (ruta) => {
      zip.remove(ruta);
      overrides.filter((o) => o.getAttribute('PartName') === '/' + ruta).forEach((o) => o.parentNode && o.parentNode.removeChild(o));
    };
    for (const o of originales) {
      const relsO = await leer(rutaRels(o.ruta));
      if (relsO) {
        for (const rel of hijos(relsO.documentElement, NS.pr, 'Relationship')) {
          if (rel.getAttribute('TargetMode') === 'External') continue;
          const destino = resolver(o.ruta, rel.getAttribute('Target'));
          if (/\/drawing$/.test(rel.getAttribute('Type'))) { quitarParte(destino); zip.remove(rutaRels(destino)); }
          else if (/\/printerSettings$/.test(rel.getAttribute('Type'))) zip.remove(destino);
        }
        zip.remove(rutaRels(o.ruta));
      }
      quitarParte(o.ruta);
      sheetsEl.removeChild(o.el);
      const r = relPorId[o.rid];
      if (r && r.parentNode) r.parentNode.removeChild(r);
    }
    const dn = uno(wb, NS.m, 'definedNames');
    if (dn) dn.parentNode.removeChild(dn);
    for (const v of Array.from(wb.getElementsByTagNameNS(NS.m, 'workbookView'))) { v.setAttribute('activeTab', '0'); v.removeAttribute('firstSheet'); }
    zip.remove('xl/calcChain.xml');
    overrides.filter((o) => o.getAttribute('PartName') === '/xl/calcChain.xml').forEach((o) => o.parentNode && o.parentNode.removeChild(o));
    for (const r of hijos(wbRels.documentElement, NS.pr, 'Relationship')) if (/calcChain$/.test(r.getAttribute('Type'))) wbRels.documentElement.removeChild(r);

    const app = await leer('docProps/app.xml');
    if (app) {
      ['HeadingPairs', 'TitlesOfParts'].forEach((n) => Array.from(app.getElementsByTagName(n)).forEach((el) => el.parentNode.removeChild(el)));
      zip.file('docProps/app.xml', ser(app));
    }

    zip.file('xl/workbook.xml', ser(wb));
    zip.file('xl/_rels/workbook.xml.rels', ser(wbRels));
    zip.file('[Content_Types].xml', ser(ct));
    if (estilos.cambiado) zip.file('xl/styles.xml', ser(stylesDoc));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    U.descargar(blob, nombreArchivo);
    return blob;
  };

  window.XL = XL;
})();
