/* Registros guardados en la nube + buscador (por registro y por lectura). */
(function () {
  'use strict';

  const e = U.esc;
  const CLAVE = 'ps_filtros_registros';

  Vistas.registros = async (main, params) => {
    const def = Object.assign({ pestana: 'registros', rapido: '30d', texto: '', formato: '', turno: '', inspector: '', maquina: '', estado: '', alertas: false,
      lFormato: M.formatos()[0] && M.formatos()[0].id, lMaquina: '', lCol: '', lCond: 'fuera', lValor: '' }, U.lsGet(CLAVE, {}));
    if (def.formato && !M.formato(def.formato)) def.formato = '';
    if (!M.formato(def.lFormato)) { def.lFormato = M.formatos()[0].id; def.lMaquina = ''; def.lCol = ''; }
    const st = Object.assign(def, U.rangoRapido(def.rapido === 'personal' ? 'hoy' : def.rapido));
    if (def.rapido === 'personal' && def.desde && def.hasta) { st.desde = def.desde; st.hasta = def.hasta; }
    if (params.consulta && params.consulta.get('alertas')) { st.alertas = true; st.pestana = 'registros'; st.rapido = '7d'; Object.assign(st, U.rangoRapido('7d')); }
    const seleccion = new Set();
    let registros = [];
    let limite = 100;
    const guardarFiltros = () => U.lsSet(CLAVE, st);

    const chipsRango = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7d', '7 días'], ['30d', '30 días'], ['mes', 'Este mes'], ['mesPasado', 'Mes pasado'], ['anio', 'Este año'], ['todo', 'Todo']];

    main.innerHTML =
      '<div class="vista-cab"><div class="titulos"><h1>Registros</h1><p>Todo lo capturado queda guardado aquí' + (DB.modo === 'nube' ? ' en la nube' : '') + '. Busca por fecha, formato, equipo, inspector o cualquier dato.</p></div>' +
        '<div class="segmentado" role="tablist">' +
          '<button data-pest="registros">' + U.icon('lista', 'sm') + 'Registros</button>' +
          '<button data-pest="lecturas">' + U.icon('buscar', 'sm') + 'Buscar lecturas</button>' +
        '</div></div>' +
      '<div class="tarjeta filtros">' +
        '<div class="chips" id="chips-rango">' + chipsRango.map(([k, t]) => '<button class="chip" data-rapido="' + k + '">' + t + '</button>').join('') + '</div>' +
        '<div class="fila">' +
          '<div class="campo"><label for="f-desde">Desde</label><input class="input" type="date" id="f-desde"></div>' +
          '<div class="campo"><label for="f-hasta">Hasta</label><input class="input" type="date" id="f-hasta"></div>' +
          '<div class="campo busqueda" data-solo="registros"><label for="f-texto">Buscar</label><div class="input-ico">' + U.icon('buscar') + '<input class="input" type="search" id="f-texto" placeholder="Equipo, inspector, observación, valor…"></div></div>' +
          '<div class="campo" data-solo="registros"><label for="f-formato">Formato</label><select class="select" id="f-formato">' + V.opcionesFormatos(st.formato, true) + '</select></div>' +
          '<div class="campo" data-solo="registros"><label for="f-turno">Turno</label><select class="select" id="f-turno">' + V.opcionesTurnos(st.turno) + '</select></div>' +
          '<div class="campo" data-solo="registros"><label for="f-inspector">Inspector</label><select class="select" id="f-inspector"></select></div>' +
          '<div class="campo" data-solo="registros"><label for="f-maquina">Sección / equipo</label><select class="select" id="f-maquina"></select></div>' +
          '<div class="campo" data-solo="registros"><label for="f-estado">Estado</label><select class="select" id="f-estado"><option value="">Todos</option><option value="completo">Finalizados</option><option value="borrador">En proceso</option></select></div>' +
          '<label class="check-linea" data-solo="registros"><input type="checkbox" id="f-alertas"> Solo con alertas</label>' +
          '<div class="campo" data-solo="lecturas"><label for="l-formato">Formato</label><select class="select" id="l-formato">' + V.opcionesFormatos(st.lFormato, false) + '</select></div>' +
          '<div class="campo" data-solo="lecturas"><label for="l-maquina">Sección / equipo</label><select class="select" id="l-maquina"></select></div>' +
          '<div class="campo" data-solo="lecturas"><label for="l-col">Dato / parámetro</label><select class="select" id="l-col"></select></div>' +
          '<div class="campo" data-solo="lecturas"><label for="l-cond">Condición</label><select class="select" id="l-cond">' +
            '<option value="fuera">Con alerta (fuera de rango / ✗)</option><option value="todas">Todas las lecturas</option><option value="mayor">Mayor que…</option><option value="menor">Menor que…</option><option value="igual">Igual a…</option><option value="texto">Contiene texto…</option></select></div>' +
          '<div class="campo" data-solo="lecturas" id="l-valor-campo"><label for="l-valor">Valor</label><input class="input" id="l-valor" inputmode="decimal"></div>' +
        '</div>' +
      '</div>' +
      '<div id="sel-barra"></div>' +
      '<div class="tarjeta" id="resultados"></div>';

    const $ = (s) => U.$(s, main);
    $('#f-texto').value = st.texto;
    $('#f-estado').value = st.estado;
    $('#f-alertas').checked = !!st.alertas;
    $('#l-cond').value = st.lCond;
    $('#l-valor').value = st.lValor;

    function pintarControles() {
      U.$$('[data-pest]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.pest === st.pestana));
      U.$$('[data-solo]', main).forEach((x) => { x.hidden = x.dataset.solo !== st.pestana; });
      U.$$('[data-rapido]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.rapido === st.rapido));
      $('#f-desde').value = st.desde === '2000-01-01' ? '' : st.desde;
      $('#f-hasta').value = st.hasta === '2999-12-31' ? '' : st.hasta;
      // Inspectores presentes en los datos + catálogo
      const insp = new Set(M.config.inspectores || []);
      registros.forEach((r) => { if (r.encabezado && r.encabezado.inspector) insp.add(r.encabezado.inspector); });
      $('#f-inspector').innerHTML = '<option value="">Todos</option>' + Array.from(insp).sort().map((n) => '<option' + (n === st.inspector ? ' selected' : '') + '>' + e(n) + '</option>').join('');
      // Equipos (de todos los formatos o del elegido)
      const maqs = new Map();
      if (st.formato && M.formato(st.formato)) M.seccionesTodas(M.formato(st.formato)).forEach((x) => maqs.set(x.titulo, x.titulo));
      $('#f-maquina').disabled = !st.formato;
      $('#f-maquina').innerHTML = '<option value="">Todos</option>' + Array.from(maqs).map(([id, n]) => '<option value="' + e(id) + '"' + (id === st.maquina ? ' selected' : '') + '>' + e(n) + '</option>').join('');
      // Lecturas
      const lf = M.formato(st.lFormato) || M.formatos()[0];
      if (lf) {
        const filas = new Map(); M.seccionesTodas(lf).forEach((x) => filas.set(x.titulo, x.titulo));
        const camposL = []; const vistos = new Set();
        M.seccionesTodas(lf).filter((x) => !st.lMaquina || x.titulo === st.lMaquina).forEach((x) => x.campos.forEach((c) => { if (!vistos.has(c.label + '|' + (c.unidad || ''))) { vistos.add(c.label + '|' + (c.unidad || '')); camposL.push(c); } }));
        $('#l-maquina').innerHTML = '<option value="">Todos</option>' + Array.from(filas).map(([id, n]) => '<option value="' + e(id) + '"' + (id === st.lMaquina ? ' selected' : '') + '>' + e(n) + '</option>').join('');
        $('#l-col').innerHTML = '<option value="">Todos los datos</option>' + camposL.map((c) => '<option value="' + e(c.label) + '"' + (c.label === st.lCol ? ' selected' : '') + '>' + e(c.label + (c.unidad ? ' (' + c.unidad + ')' : '')) + '</option>').join('');
      }
      $('#l-valor-campo').hidden = st.pestana !== 'lecturas' || !['mayor', 'menor', 'igual', 'texto'].includes(st.lCond);
    }

    /* ---------------- Filtrado ---------------- */
    function filtrarRegistros() {
      const q = M.normalizar(st.texto.trim());
      const palabras = q.split(/\s+/).filter(Boolean);
      return registros.filter((r) => {
        if (st.formato && r.formatoId !== st.formato) return false;
        if (st.turno && String(r.turno) !== st.turno) return false;
        if (st.inspector && (r.encabezado && r.encabezado.inspector) !== st.inspector) return false;
        if (st.estado && (r.estado === 'completo' ? 'completo' : 'borrador') !== st.estado) return false;
        if (st.maquina) {
          const fr = M.formato(r.formatoId);
          const sec = fr && M.secciones(fr, r).find((x) => x.titulo === st.maquina);
          if (!sec || !sec.campos.some((c) => r.valores && r.valores[c.id] != null && r.valores[c.id] !== '')) return false;
        }
        if (st.alertas && !M.resumen(r).alertas.length) return false;
        if (palabras.length) {
          const t = r._txt || (r._txt = M.textoBusqueda(r));
          if (!palabras.every((p) => t.includes(p))) return false;
        }
        return true;
      });
    }

    function filtrarLecturas() {
      const f = M.formato(st.lFormato);
      if (!f) return [];
      const out = [];
      const valor = st.lValor.trim();
      const num = U.aNumero(valor);
      const txt = M.normalizar(valor);
      for (const r of registros) {
        if (r.formatoId !== f.id) continue;
        for (const sec of M.secciones(f, r)) {
          if (st.lMaquina && sec.titulo !== st.lMaquina) continue;
          for (const c of sec.campos) {
            if (st.lCol && c.label !== st.lCol) continue;
            const v = r.valores && r.valores[c.id];
            if (v == null || v === '') continue;
            const ev = M.evaluar(f, c, v);
            const n = U.aNumero(v);
            let ok = true;
            switch (st.lCond) {
              case 'fuera': ok = M.esAlerta(ev); break;
              case 'mayor': ok = num != null && n != null && n > num; break;
              case 'menor': ok = num != null && n != null && n < num; break;
              case 'igual': ok = num != null && n != null ? n === num : M.normalizar(M.textoValor(c, v)) === txt; break;
              case 'texto': ok = !txt || M.normalizar(M.textoValor(c, v)).includes(txt); break;
              default: ok = true;
            }
            const fila = { nombre: sec.titulo };
            if (ok) out.push({ r, fila, c, v, ev });
          }
        }
      }
      return out;
    }

    /* ---------------- Pintar ---------------- */
    function pintarSeleccion() {
      const n = seleccion.size;
      $('#sel-barra').innerHTML = n && st.pestana === 'registros'
        ? '<div class="sel-barra"><b>' + n + ' seleccionado' + (n === 1 ? '' : 's') + '</b><span class="espacio"></span>' +
          '<button class="btn btn-chico" data-sel="previa">' + U.icon('imprimir', 'sm') + '<span>Vista previa / imprimir</span></button>' +
          '<button class="btn btn-chico" data-sel="excel">' + U.icon('excel', 'sm') + '<span>Excel (formato)</span></button>' +
          '<button class="btn btn-chico" data-sel="datos">' + U.icon('tabla', 'sm') + '<span>Excel (datos)</span></button>' +
          '<button class="btn btn-chico" data-sel="limpiar">' + U.icon('x', 'sm') + '<span>Quitar selección</span></button></div>'
        : '';
    }

    function pintarRegistros() {
      const lista = filtrarRegistros();
      const visibles = lista.slice(0, limite);
      const todosSel = visibles.length && visibles.every((r) => seleccion.has(r.id));
      $('#resultados').innerHTML =
        '<div class="resultado-cab"><b>' + lista.length + ' registro' + (lista.length === 1 ? '' : 's') + '</b>' +
          '<span class="muted t-sm">' + (st.desde === '2000-01-01' ? 'Todas las fechas' : e(U.fechaMedia(st.desde)) + ' — ' + e(U.fechaMedia(st.hasta))) + '</span><span class="espacio"></span>' +
          (lista.length ? '<button class="btn btn-texto btn-chico" data-exp="excel">' + U.icon('excel', 'sm') + 'Exportar resultados</button><button class="btn btn-texto btn-chico" data-exp="previa">' + U.icon('imprimir', 'sm') + 'Imprimir resultados</button>' : '') +
        '</div>' +
        (lista.length
          ? '<div class="tabla-wrap"><table class="tabla responsiva"><thead><tr>' +
              '<th class="chk"><input type="checkbox" data-todos aria-label="Seleccionar todos"' + (todosSel ? ' checked' : '') + '></th>' +
              '<th>Fecha</th><th>Turno</th><th>Formato</th><th>Inspector</th><th>Avance</th><th>Alertas</th><th>Estado</th><th></th></tr></thead><tbody>' +
            visibles.map((r) => {
              const f = M.formato(r.formatoId);
              const res = M.resumen(r, f);
              return '<tr data-id="' + e(r.id) + '">' +
                '<td class="chk"><input type="checkbox" data-sel-id="' + e(r.id) + '"' + (seleccion.has(r.id) ? ' checked' : '') + ' aria-label="Seleccionar"></td>' +
                '<td class="fuerte num">' + e(U.fechaCorta(r.fecha)) + '</td>' +
                '<td class="nowrap">' + e(M.nombreTurno(r.turno)) + '</td>' +
                '<td class="col-formato"><div class="fuerte">' + e(f ? M.tituloRegistro(f, r) : r.formatoId) + '</div><div class="t-xs muted">' + e(f ? f.archivo : '') + '</div></td>' +
                '<td data-m="ocultar">' + e((r.encabezado && r.encabezado.inspector) || r.creadoPor || '') + '</td>' +
                '<td data-m="ocultar">' + V.miniAvance(res) + '</td>' +
                '<td>' + V.badgeAlertas(res.alertas.length) + '</td>' +
                '<td data-m="ocultar">' + V.badgeEstado(r) + ' ' + V.badgeSync(r) + '</td>' +
                '<td class="acc">' +
                  '<a class="btn-icono chico" href="#/editar/' + encodeURIComponent(r.id) + '" title="Editar" aria-label="Editar">' + U.icon('editar', 'sm') + '</a>' +
                  '<button class="btn-icono chico" data-imp="' + e(r.id) + '" title="Imprimir" aria-label="Imprimir">' + U.icon('imprimir', 'sm') + '</button>' +
                  '<button class="btn-icono chico" data-xls="' + e(r.id) + '" title="Excel" aria-label="Excel">' + U.icon('excel', 'sm') + '</button>' +
                '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (lista.length > limite ? '<div style="padding:14px;text-align:center"><button class="btn btn-secundario" data-mas>Mostrar más (' + (lista.length - limite) + ' restantes)</button></div>' : '')
          : '<div class="vacio">' + U.icon('buscar') + '<p><b>Sin resultados</b></p><p class="t-sm">Prueba con otro rango de fechas o quita algún filtro.</p></div>');
      pintarSeleccion();
    }

    function pintarLecturas() {
      const lista = filtrarLecturas();
      const visibles = lista.slice(0, limite * 3);
      $('#resultados').innerHTML =
        '<div class="resultado-cab"><b>' + lista.length + ' lectura' + (lista.length === 1 ? '' : 's') + '</b><span class="espacio"></span>' +
          (lista.length ? '<button class="btn btn-texto btn-chico" data-exp="lecturas">' + U.icon('excel', 'sm') + 'Exportar a Excel</button>' : '') + '</div>' +
        (lista.length
          ? '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha</th><th>Turno</th><th>Sección</th><th>Dato</th><th>Valor</th><th>Rango</th><th>Inspector</th></tr></thead><tbody>' +
            visibles.map(({ r, fila, c, v, ev }) => {
              const lim = M.limite(M.formato(r.formatoId), c);
              return '<tr data-id="' + e(r.id) + '"><td class="fuerte num">' + e(U.fechaCorta(r.fecha)) + '</td><td class="nowrap">' + e(M.nombreTurno(r.turno)) + '</td>' +
                '<td class="fuerte">' + e(fila.nombre) + '</td><td>' + e(c.label) + '</td>' +
                '<td>' + (M.esAlerta(ev) ? '<span class="badge badge-bad">' + U.icon('alerta') : '<span class="num fuerte">') + e(M.textoValor(c, v)) + (c.unidad ? ' ' + e(c.unidad) : '') + '</span></td>' +
                '<td class="muted">' + e(M.textoLimite(lim, c.unidad)) + '</td><td>' + e((r.encabezado && r.encabezado.inspector) || '') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (lista.length > visibles.length ? '<div style="padding:14px;text-align:center"><button class="btn btn-secundario" data-mas>Mostrar más</button></div>' : '')
          : '<div class="vacio">' + U.icon('buscar') + '<p><b>Sin lecturas que coincidan</b></p><p class="t-sm">Cambia la condición, el equipo o el rango de fechas.</p></div>');
      pintarSeleccion();
    }

    const pintar = () => { pintarControles(); if (st.pestana === 'lecturas') pintarLecturas(); else pintarRegistros(); };

    /* ---------------- Datos ---------------- */
    let quitar = null;
    const suscribir = () => {
      if (quitar) quitar();
      $('#resultados').innerHTML = '<div class="vacio"><div class="spinner" style="margin:20px auto"></div></div>';
      quitar = DB.suscribirRegistros({ desde: st.desde, hasta: st.hasta }, (l) => { registros = l; pintar(); });
    };

    const seleccionados = () => registros.filter((r) => seleccion.has(r.id));

    /* ---------------- Eventos ---------------- */
    const refiltrar = U.debounce(() => { limite = 100; guardarFiltros(); pintar(); }, 200);
    main.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.id === 'f-texto') { st.texto = t.value; refiltrar(); }
      if (t.id === 'l-valor') { st.lValor = t.value; refiltrar(); }
    });
    main.addEventListener('change', (ev) => {
      const t = ev.target;
      const mapa = { 'f-formato': 'formato', 'f-turno': 'turno', 'f-inspector': 'inspector', 'f-maquina': 'maquina', 'f-estado': 'estado', 'l-maquina': 'lMaquina', 'l-col': 'lCol', 'l-cond': 'lCond' };
      if (mapa[t.id]) { st[mapa[t.id]] = t.value; if (t.id === 'f-formato') st.maquina = ''; refiltrar.flush(); return; }
      if (t.id === 'l-formato') { st.lFormato = t.value; st.lMaquina = ''; st.lCol = ''; refiltrar.flush(); return; }
      if (t.id === 'f-alertas') { st.alertas = t.checked; refiltrar.flush(); return; }
      if (t.id === 'f-desde' || t.id === 'f-hasta') {
        st.desde = $('#f-desde').value || '2000-01-01';
        st.hasta = $('#f-hasta').value || '2999-12-31';
        if (st.desde > st.hasta) { const x = st.desde; st.desde = st.hasta; st.hasta = x; }
        st.rapido = 'personal';
        guardarFiltros(); suscribir(); return;
      }
      if (t.dataset.selId) { if (t.checked) seleccion.add(t.dataset.selId); else seleccion.delete(t.dataset.selId); pintarRegistros(); return; }
      if (t.hasAttribute('data-todos')) {
        filtrarRegistros().slice(0, limite).forEach((r) => (t.checked ? seleccion.add(r.id) : seleccion.delete(r.id)));
        pintarRegistros();
      }
    });
    main.addEventListener('click', async (ev) => {
      const t = ev.target;
      const b = t.closest('button, a, input, label');
      if (b && b.dataset.pest) { st.pestana = b.dataset.pest; limite = 100; guardarFiltros(); pintar(); return; }
      if (b && b.dataset.rapido) { st.rapido = b.dataset.rapido; Object.assign(st, U.rangoRapido(st.rapido)); guardarFiltros(); pintarControles(); suscribir(); return; }
      if (b && b.hasAttribute('data-mas')) { limite += 100; pintar(); return; }
      if (b && b.dataset.imp) { const r = registros.find((x) => x.id === b.dataset.imp); V.vistaPrevia({ registros: [r] }); return; }
      if (b && b.dataset.xls) { const r = registros.find((x) => x.id === b.dataset.xls); V.exportarExcel([r]); return; }
      if (b && b.dataset.sel) {
        const s = b.dataset.sel;
        if (s === 'limpiar') { seleccion.clear(); pintarRegistros(); }
        else if (s === 'previa') V.vistaPrevia({ registros: seleccionados() });
        else if (s === 'excel') V.exportarExcel(seleccionados());
        else if (s === 'datos') V.exportarExcel(seleccionados(), 'datos');
        return;
      }
      if (b && b.dataset.exp) {
        const x = b.dataset.exp;
        if (x === 'excel') V.exportarExcel(filtrarRegistros());
        else if (x === 'previa') {
          const l = filtrarRegistros();
          if (l.length > 60 && !(await U.confirmar('Muchas hojas', 'Vas a generar ' + l.length + ' hojas. ¿Continuar?', 'Continuar'))) return;
          V.vistaPrevia({ registros: l });
        } else if (x === 'lecturas') exportarLecturas();
        return;
      }
      if (b) return;
      const tr = t.closest('tr[data-id]');
      if (tr) App.ir('/ver/' + encodeURIComponent(tr.dataset.id));
    });

    async function exportarLecturas() {
      const l = filtrarLecturas();
      try {
        const X = await V.excel();
        await X.exportarTabla('Lecturas_' + U.hoyISO(), 'Lecturas',
          ['Fecha', 'Turno', 'Sección', 'Dato', 'Valor', 'Unidad', 'Rango', 'Alerta', 'Inspector', 'Folio'],
          l.map(({ r, fila, c, v, ev }) => [U.parseISO(r.fecha), M.nombreTurno(r.turno), fila.nombre, c.label,
            c.tipo === 'numero' ? U.aNumero(v) : M.textoValor(c, v), c.unidad || '', M.textoLimite(M.limite(M.formato(r.formatoId), c)), M.esAlerta(ev) ? 'Sí' : '',
            (r.encabezado && r.encabezado.inspector) || '', r.id.split('_').pop().toUpperCase()]));
        U.toast('Excel descargado');
      } catch (err) { console.error(err); U.toast('No se pudo generar el Excel', 'error'); }
    }

    pintarControles();
    suscribir();
    return () => { if (quitar) quitar(); };
  };
})();
