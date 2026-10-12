/* Piezas compartidas entre vistas: vista previa, impresión, carga diferida. */
(function () {
  'use strict';

  const V = window.V = {};
  window.Vistas = window.Vistas || {};

  /* ---------- Carga diferida de librerías pesadas ---------- */
  const cargados = {};
  V.cargarScript = (src) => {
    if (!cargados[src]) {
      cargados[src] = new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = () => { delete cargados[src]; mal(new Error('No se pudo cargar ' + src)); };
        document.head.appendChild(s);
      });
    }
    return cargados[src];
  };
  V.excel = async () => { if (!window.ExcelJS) await V.cargarScript('vendor/exceljs.min.js'); return window.X; };

  /* ---------- Páginas escaladas ---------- */
  /** Contenedor de una página (papel carta con la hoja del formato). */
  V.pagina = (pg, num, total) => U.html('<div class="pagina-env">' + P.pagina(pg.plantilla, P.hoja(pg.plantilla, pg.hoja), pg.llenado) +
    (num ? '<span class="pagina-num">' + U.esc(pg.nombre || '') + ' · página ' + num + ' de ' + total + '</span>' : '') + '</div>');

  /** Ajusta la escala de todas las páginas dentro de un contenedor. zoom = número o 'ajustar'. */
  V.escalar = (cont, zoom) => {
    const paginas = U.$$('.pagina-env', cont);
    const disponible = cont.clientWidth - 32;
    let usado = 1;
    for (const p of paginas) {
      const hoja = p.firstElementChild;
      hoja.style.transform = 'none';
      hoja.style.transformOrigin = '0 0';
      hoja.style.position = 'absolute';
      const w = hoja.offsetWidth, h = hoja.offsetHeight;
      const s = zoom === 'ajustar' ? Math.min(1.25, disponible / w) : zoom;
      usado = s;
      hoja.style.transform = 'scale(' + s + ')';
      p.style.width = (w * s) + 'px';
      p.style.height = (h * s) + 'px';
    }
    return usado;
  };

  /* ---------- Impresión ---------- */
  V.imprimirHojas = (hojasHTML) => {
    const raiz = U.$('#raiz-impresion');
    raiz.innerHTML = hojasHTML.join('');
    const imgs = U.$$('img', raiz);
    const listas = imgs.map((im) => im.complete ? Promise.resolve() : new Promise((ok) => { im.onload = im.onerror = ok; }));
    const fuentes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all(listas.concat(fuentes)).then(() => setTimeout(() => window.print(), 80));
  };
  window.addEventListener('afterprint', () => { const r = U.$('#raiz-impresion'); if (r) r.innerHTML = ''; });

  V.htmlPaginas = (paginas) => paginas.map((pg) => P.pagina(pg.plantilla, P.hoja(pg.plantilla, pg.hoja), pg.llenado));
  V.imprimirRegistros = (registros) => V.imprimirHojas(V.htmlPaginas(M.paginas(registros)));

  /**
   * Vista previa a pantalla completa.
   * opciones: { registros: [...] }  ó  { formatoBlanco: formato }
   */
  V.vistaPrevia = (opciones) => {
    const blanco = opciones.formatoBlanco || null;
    const paginasL = blanco ? M.paginasBlanco(blanco) : M.paginas(opciones.registros || []);
    const total = paginasL.length;
    if (!total) { U.toast('No hay nada que mostrar', 'aviso'); return; }
    const titulo = blanco ? 'Formato en blanco · ' + blanco.titulo : 'Vista previa · ' + total + (total === 1 ? ' hoja' : ' hojas') + ' · ' + (opciones.registros || []).length + ' registro' + ((opciones.registros || []).length === 1 ? '' : 's');

    const cont = U.html(
      '<div class="previa" role="dialog" aria-modal="true" aria-label="Vista previa de impresión">' +
        '<div class="previa-barra">' +
          '<button class="btn-icono" data-a="cerrar" aria-label="Cerrar vista previa">' + U.icon('x') + '</button>' +
          '<h2>' + U.esc(titulo) + '</h2>' +
          '<button class="btn-icono" data-a="menos" aria-label="Alejar">' + U.icon('zoomMenos') + '</button>' +
          '<span class="zoom" data-zoom>100%</span>' +
          '<button class="btn-icono" data-a="mas" aria-label="Acercar">' + U.icon('zoomMas') + '</button>' +
          '<button class="btn btn-secundario btn-chico" data-a="ajustar">Ajustar</button>' +
          '<button class="btn btn-secundario" data-a="excel">' + U.icon('excel') + '<span>Excel</span></button>' +
          '<button class="btn btn-primario" data-a="imprimir">' + U.icon('imprimir') + '<span>Imprimir</span></button>' +
        '</div>' +
        '<div class="previa-paginas"></div>' +
      '</div>');
    const paginas = U.$('.previa-paginas', cont);
    paginasL.forEach((pg, i) => paginas.appendChild(V.pagina(pg, i + 1, total)));

    document.body.appendChild(cont);
    document.body.style.overflow = 'hidden';
    let zoom = 'ajustar';
    const aplicar = () => { const s = V.escalar(paginas, zoom); U.$('[data-zoom]', cont).textContent = Math.round(s * 100) + '%'; if (zoom === 'ajustar') zoom = s; };
    requestAnimationFrame(aplicar);
    const onResize = U.debounce(() => { zoom = 'ajustar'; aplicar(); }, 150);
    window.addEventListener('resize', onResize);
    const cerrar = () => { window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; cont.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);

    cont.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'cerrar') cerrar();
      else if (a === 'mas') { zoom = Math.min(2.5, (typeof zoom === 'number' ? zoom : 1) + 0.15); aplicar(); }
      else if (a === 'menos') { zoom = Math.max(0.25, (typeof zoom === 'number' ? zoom : 1) - 0.15); aplicar(); }
      else if (a === 'ajustar') { zoom = 'ajustar'; aplicar(); }
      else if (a === 'imprimir') V.imprimirHojas(V.htmlPaginas(paginasL));
      else if (a === 'excel') {
        b.disabled = true;
        if (blanco) await V.descargarOriginal(blanco); else await V.exportarExcel(opciones.registros);
        b.disabled = false;
      }
    });
  };

  /* ---------- Excel ---------- */
  /** Descarga el Excel original del formato (en blanco). */
  V.descargarOriginal = async (f) => {
    try {
      const r = await fetch('plantillas/' + f.plantilla + '.xlsx');
      U.descargar(await r.blob(), f.archivo);
      U.toast('Formato original descargado');
    } catch (e) { U.toast('No se pudo descargar el formato', 'error'); }
  };

  /** Excel con el mismo formato (tipo 'formato') o tabla de datos (tipo 'datos'). */
  V.exportarExcel = async (registros, tipo) => {
    if (!registros || !registros.length) { U.toast('No hay registros seleccionados', 'aviso'); return; }
    U.toast('Generando Excel…', 'aviso', 1500);
    try {
      if (tipo === 'datos') {
        const X = await V.excel();
        await X.exportarDatos(registros);
        U.toast('Excel de datos descargado (' + registros.length + (registros.length === 1 ? ' registro)' : ' registros)'));
        return;
      }
      const paginas = M.paginas(registros);
      const porPlantilla = new Map();
      for (const pg of paginas) {
        if (!porPlantilla.has(pg.plantilla)) porPlantilla.set(pg.plantilla, []);
        porPlantilla.get(pg.plantilla).push(pg);
      }
      const fechas = registros.map((r) => r.fecha).sort();
      const rango = fechas[0] === fechas[fechas.length - 1] ? fechas[0] : fechas[0] + '_a_' + fechas[fechas.length - 1];
      for (const [pl, pgs] of porPlantilla) {
        const base = pl.archivo.replace(/\.xlsx$/i, '');
        await XL.exportar(pl, pgs, base + ' ' + rango + '.xlsx');
      }
      U.toast('Excel descargado (' + paginas.length + (paginas.length === 1 ? ' hoja)' : ' hojas)'));
    } catch (e) {
      console.error(e);
      U.toast('No se pudo generar el Excel', 'error');
    }
  };

  /* ---------- Varios ---------- */
  V.badgeEstado = (reg) => reg.estado === 'completo'
    ? '<span class="badge badge-ok">' + U.icon('check') + 'Finalizado</span>'
    : '<span class="badge badge-azul">' + U.icon('editar') + 'En proceso</span>';

  V.badgeAlertas = (n) => n
    ? '<span class="badge badge-bad">' + U.icon('alerta') + n + '</span>'
    : '<span class="badge badge-ok">' + U.icon('check') + '0</span>';

  V.badgeSync = (reg) => DB.modo === 'nube' && reg._pendiente
    ? '<span class="badge badge-warn" title="Guardado en la tableta, pendiente de subir a la nube">' + U.icon('sync') + 'Por subir</span>'
    : '';

  V.miniAvance = (res) => '<div class="mini-avance"><div class="avance ' + (res.pct === 100 ? 'ok' : '') + '"><span style="width:' + res.pct + '%"></span></div><span class="t-sm num">' + res.pct + '%</span></div>';

  V.opcionesFormatos = (sel, conTodos) => (conTodos ? '<option value="">Todos los formatos</option>' : '') +
    M.formatos().map((f) => '<option value="' + U.esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + U.esc(f.titulo) + '</option>').join('');

  V.opcionesTurnos = (sel) => '<option value="">Todos los turnos</option>' +
    (M.config.turnos || []).map((t) => '<option value="' + U.esc(t.id) + '"' + (String(sel) === t.id ? ' selected' : '') + '>' + U.esc(t.nombre) + '</option>').join('');

  V.verFoto = (src, pie) => U.modal({ titulo: pie || 'Foto', contenido: '<img class="foto-grande" src="' + U.srcImagen(src) + '" alt="">', ancho: 900, botones: [] });
})();
