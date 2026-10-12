/* ==========================================================================
   Captura en tableta.
   Dos modos sobre el mismo registro:
     - "Por máquina": tarjeta grande por equipo, ideal para ir caminando.
     - "Formato completo": la tabla igual a la hoja impresa.
   Todo se guarda solo (borrador) mientras se captura.
   ========================================================================== */
(function () {
  'use strict';

  const e = U.esc;

  Vistas.captura = async (main, params) => {
    const inspector = await App.requerirInspector();
    let reg, formato;

    if (params.nuevo) {
      formato = M.formato(params.nuevo);
      if (!formato) throw new Error('El formato no existe');
      reg = M.nuevoRegistro(formato, inspector);
    } else {
      reg = await DB.obtenerRegistro(params.id);
      if (!reg) throw new Error('No se encontró el registro');
      delete reg._pendiente;
      formato = M.formato(reg.formatoId);
      if (!formato) throw new Error('El formato de este registro ya no existe');
    }
    reg.valores = reg.valores || {};
    reg.pie = reg.pie || {};
    reg.firmas = reg.firmas || {};
    const esNuevo = !!params.nuevo;
    let guardadoUnaVez = !esNuevo;
    const eraCompleto = reg.estado === 'completo';
    const filas = reg.filas;
    const cols = formato.tabla.columnas;
    const grupos = M.gruposColumnas(cols);

    let modo = U.lsGet('ps_modo_captura', window.innerWidth < 1100 ? 'maquina' : 'maquina');
    let actual = 0;
    // Primera máquina sin completar
    const pend = filas.findIndex((f) => !M.estadoFila(reg, formato, f).completa);
    if (pend >= 0) actual = pend;

    /* ---------------- Guardado automático ---------------- */
    let estadoGuardado = esNuevo ? 'nuevo' : 'ok';
    const pintarGuardado = () => {
      const el = U.$('#guardado', main);
      if (!el) return;
      if (estadoGuardado === 'nuevo') { el.className = 'guardado'; el.innerHTML = U.icon('info', 'sm') + 'Se guarda solo al capturar'; }
      else if (estadoGuardado === 'guardando') { el.className = 'guardado pend'; el.innerHTML = U.icon('sync', 'sm') + 'Guardando…'; }
      else if (estadoGuardado === 'tableta') { el.className = 'guardado pend'; el.innerHTML = U.icon('tableta', 'sm') + 'Guardado en la tableta · se subirá a la nube'; }
      else { el.className = 'guardado ok'; el.innerHTML = U.icon('nubeOk', 'sm') + (DB.modo === 'nube' ? 'Guardado en la nube ' : 'Guardado ') + U.ahoraHM(); }
    };
    const guardar = (accion) => {
      sucio = false;
      reg.modificadoPor = App.inspector || inspector;
      reg.modificadoEn = Date.now();
      reg.fecha = reg.encabezado.fecha || reg.fecha;
      reg.turno = reg.encabezado.turno || reg.turno;
      const r = M.resumen(reg, formato);
      reg.resumen = { completas: r.completas, total: r.total, alertas: r.alertas.length, fuera: r.fuera, anomalias: r.anomalias };
      if (accion) {
        reg.historial = (reg.historial || []).concat({ accion, por: reg.modificadoPor, en: Date.now() }).slice(-30);
      }
      estadoGuardado = 'guardando';
      pintarGuardado();
      const p = DB.guardarRegistro(reg);
      if (!guardadoUnaVez) {
        guardadoUnaVez = true;
        history.replaceState(null, '', '#/editar/' + encodeURIComponent(reg.id));
      }
      p.local.then(() => {
        if (estadoGuardado === 'guardando') { estadoGuardado = DB.modo === 'nube' && !navigator.onLine ? 'tableta' : estadoGuardado; pintarGuardado(); }
      });
      p.nube.then(() => { estadoGuardado = 'ok'; pintarGuardado(); }).catch((err) => {
        console.error(err); estadoGuardado = 'tableta'; pintarGuardado();
        U.toast('No se pudo subir a la nube: ' + (err.message || err), 'error');
      });
      setTimeout(() => { if (estadoGuardado === 'guardando') { estadoGuardado = 'tableta'; pintarGuardado(); } }, 2500);
      return p;
    };
    let sucio = false;
    let edicionAnotada = false;
    const autoguardar = U.debounce(() => {
      let accion = null;
      if (eraCompleto && !edicionAnotada) { edicionAnotada = true; accion = 'Editado'; }
      guardar(accion);
    }, 900);
    const cambio = () => { sucio = true; autoguardar(); pintarProgreso(); };

    /* ---------------- Estructura ---------------- */
    const opcTurnos = (M.config.turnos || []).map((t) => '<option value="' + e(t.id) + '"' + (String(reg.encabezado.turno) === t.id ? ' selected' : '') + '>' + e(t.nombre) + '</option>').join('');
    const campoEnc = (c) => {
      const v = reg.encabezado[c.id] || '';
      let input;
      if (c.tipo === 'fecha') input = '<input class="input" type="date" data-enc="' + e(c.id) + '" value="' + e(v) + '">';
      else if (c.tipo === 'turno') input = '<select class="select" data-enc="' + e(c.id) + '">' + opcTurnos + '</select>';
      else if (c.tipo === 'hora') input = '<input class="input" type="time" data-enc="' + e(c.id) + '" value="' + e(v) + '">';
      else if (c.tipo === 'opciones') input = '<select class="select" data-enc="' + e(c.id) + '"><option value=""></option>' + (c.opciones || []).map((o) => '<option' + (o === v ? ' selected' : '') + '>' + e(o) + '</option>').join('') + '</select>';
      else input = '<input class="input" type="text" data-enc="' + e(c.id) + '" value="' + e(v) + '"' + (c.auto === 'inspector' ? ' list="lista-insp"' : '') + '>';
      return '<div class="campo' + ((c.ancho || 1) > 1 ? ' ancho2' : '') + '"><label>' + e(c.label) + '</label>' + input + '</div>';
    };

    main.innerHTML =
      '<div class="migas"><a href="#/inicio">Inicio</a>' + U.icon('der', 'sm') + '<a href="#/capturar">Capturar</a>' + U.icon('der', 'sm') + '<span>' + e(formato.codigo) + '</span></div>' +
      '<div class="tarjeta cap-cab">' +
        '<div class="fila-tit"><div class="t"><div class="codigo">' + e(formato.codigo) + ' · REV. ' + e(formato.revision) + '</div><h1>' + e(formato.titulo) + '</h1></div>' +
          '<div class="segmentado" role="group" aria-label="Modo de captura">' +
            '<button data-modo="maquina">' + U.icon('tarjeta', 'sm') + 'Por ' + e(formato.tabla.titulo.toLowerCase()) + '</button>' +
            '<button data-modo="formato">' + U.icon('tabla', 'sm') + 'Formato completo</button>' +
          '</div></div>' +
        '<div class="cap-datos">' + formato.encabezado.map(campoEnc).join('') + '</div>' +
        '<datalist id="lista-insp">' + (M.config.inspectores || []).map((n) => '<option value="' + e(n) + '">').join('') + '</datalist>' +
        '<div class="cap-barra"><div class="progreso"><div class="txt" id="prog-txt"></div><div class="avance" id="prog-barra"><span></span></div></div>' +
          '<span class="guardado" id="guardado"></span></div>' +
      '</div>' +
      '<div id="zona"></div>' +
      '<div class="tarjeta cierre" id="cierre"></div>' +
      '<div class="barra-final">' +
        '<button class="btn btn-secundario" data-a="previa">' + U.icon('ojo') + '<span>Vista previa</span></button>' +
        '<button class="btn btn-secundario" data-a="guardar">' + U.icon('guardar') + '<span>Guardar y salir</span></button>' +
        '<button class="btn btn-ok btn-grande" data-a="finalizar">' + U.icon('check') + '<span>' + (eraCompleto ? 'Guardar cambios' : 'Finalizar rutina') + '</span></button>' +
      '</div>';

    pintarGuardado();

    /* ---------------- Progreso ---------------- */
    function pintarProgreso() {
      const r = M.resumen(reg, formato);
      U.$('#prog-txt', main).innerHTML = '<span>' + r.completas + ' de ' + r.total + ' ' + e(formato.tabla.titulo.toLowerCase()) + (r.total === 1 ? '' : 's') + ' revisad' + (/a$/i.test(formato.tabla.titulo) ? 'a' : 'o') + (r.total === 1 ? '' : 's') + '</span>' +
        (r.alertas.length ? '<span class="badge badge-bad">' + U.icon('alerta') + r.alertas.length + ' alerta' + (r.alertas.length === 1 ? '' : 's') + '</span>' : '');
      const barra = U.$('#prog-barra', main);
      barra.className = 'avance' + (r.pct === 100 ? ' ok' : '');
      barra.firstElementChild.style.width = r.pct + '%';
      // Estados en la lista de máquinas
      U.$$('[data-maq]', main).forEach((b) => {
        const f = filas[+b.dataset.maq];
        const st = M.estadoFila(reg, formato, f);
        const ic = U.$('.estado-maq', b);
        const cls = st.noOpera ? 'noop' : st.alertas ? 'alerta' : st.completa ? 'completa' : st.tocada ? 'proceso' : '';
        ic.className = 'estado-maq ' + cls;
        ic.innerHTML = st.noOpera ? U.icon('apagar') : st.alertas ? U.icon('alerta') : st.completa ? U.icon('check') : '';
        const sub = U.$('.nm span', b);
        if (sub) sub.textContent = st.noOpera ? 'No opera' : st.alertas ? st.alertas + ' alerta' + (st.alertas === 1 ? '' : 's') : st.completa ? 'Completa' : st.llenos ? st.llenos + ' de ' + st.total : 'Pendiente';
      });
      // Celdas de la rejilla
      U.$$('tr[data-fila]', main).forEach((tr) => {
        const f = filas[+tr.dataset.fila];
        tr.classList.toggle('noop', !!(reg.valores[f.id] || {})._noOpera);
      });
    }

    /* ---------------- Utilidades de valores ---------------- */
    const vals = (f) => (reg.valores[f.id] = reg.valores[f.id] || {});
    const ponerValor = (f, c, v) => {
      const o = vals(f);
      if (v === '' || v == null) delete o[c.id]; else o[c.id] = v;
      // Hora automática al capturar el primer dato del equipo
      const colHora = cols.find((x) => x.tipo === 'hora' && x.auto === 'ahora');
      if (colHora && c.id !== colHora.id && v !== '' && v != null && !o[colHora.id]) {
        o[colHora.id] = U.ahoraHM();
        const ih = U.$('[data-f="' + f.id + '"][data-c="' + colHora.id + '"]', main);
        if (ih) ih.value = o[colHora.id];
      }
      cambio();
    };

    function evaluacionHTML(c, f, v) {
      const ev = M.evaluar(c, f, v);
      if (c.tipo !== 'numero' || ev == null) return '';
      const lim = M.limite(c, f);
      if (ev === 'ok') return lim ? U.icon('check', 'sm') + 'Dentro de rango' : '';
      return U.icon('alerta', 'sm') + (ev === 'alto' ? 'Arriba del máximo (' + lim[1] + ')' : 'Abajo del mínimo (' + lim[0] + ')');
    }

    /* ---------------- Modo por máquina ---------------- */
    function campoMedicion(f, c) {
      const v = vals(f)[c.id];
      const ancho = c.tipo === 'texto' ? ' ancho' : '';
      if (M.omitida(f, c)) {
        return '<div class="med omit' + ancho + '"><div class="med-cab"><label>' + e(c.label) + '</label></div><div class="t-sm">No aplica para este equipo</div></div>';
      }
      const lim = M.limite(c, f);
      const ev = M.evaluar(c, f, v);
      const cls = M.esAlerta(ev) ? ' mal' : ev === 'ok' && c.tipo === 'numero' && lim ? ' ok' : '';
      let cuerpo = '';
      const id = 'm_' + f.id + '_' + c.id;
      if (c.tipo === 'numero') {
        cuerpo = '<div class="entrada"><input class="input" id="' + id + '" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" value="' + e(v == null ? '' : v) + '" placeholder="—">' +
          (c.unidad ? '<span class="unidad">' + e(c.unidad) + '</span>' : '') + '</div><div class="ev">' + evaluacionHTML(c, f, v) + '</div>';
      } else if (c.tipo === 'check') {
        cuerpo = '<div class="opciones-btn" role="group" aria-label="' + e(c.label) + '">' +
          [['ok', '✓ Bien', 'b-ok'], ['mal', '✗ Falla', 'b-mal'], ['na', 'N/A', 'b-na']].map(([val, txt, k]) =>
            '<button type="button" class="' + k + '" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" data-v="' + val + '" aria-pressed="' + (v === val) + '">' + txt + '</button>').join('') + '</div>';
      } else if (c.tipo === 'opciones') {
        cuerpo = '<div class="opciones-btn" role="group" aria-label="' + e(c.label) + '">' +
          (c.opciones || []).map((o) => '<button type="button" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" data-v="' + e(o) + '" aria-pressed="' + (v === o) + '">' + e(o) + '</button>').join('') + '</div>';
      } else if (c.tipo === 'hora') {
        cuerpo = '<div class="entrada"><input class="input" id="' + id + '" type="time" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" value="' + e(v || '') + '">' +
          '<button type="button" class="btn btn-suave btn-chico" data-ahora="' + e(f.id) + '" data-c="' + e(c.id) + '">Ahora</button></div>';
      } else {
        cuerpo = '<textarea class="textarea" id="' + id + '" rows="2" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" placeholder="Escribe aquí cualquier detalle o anomalía">' + e(v || '') + '</textarea>';
      }
      const siempre = c.tipo === 'texto' || c.tipo === 'opciones' || c.tipo === 'hora' ? ' siempre' : '';
      return '<div class="med' + cls + ancho + siempre + '" data-med="' + e(f.id) + '|' + e(c.id) + '">' +
        '<div class="med-cab"><label for="' + id + '">' + e(c.label) + '</label>' + (lim ? '<span class="rango">' + e(M.textoLimite(lim, c.unidad)) + '</span>' : '') + '</div>' + cuerpo + '</div>';
    }

    function pintarMaquina() {
      const f = filas[actual];
      const o = vals(f);
      const tarjeta = U.$('#maq-card', main);
      // Bloques en el orden del formato: columnas sueltas consecutivas se juntan
      // en un mismo bloque; los grupos y las observaciones van aparte.
      const bloques = [];
      for (const g of grupos) {
        const titulo = g.grupo || (g.cols[0].tipo === 'texto' ? 'Observaciones' : 'Mediciones');
        const ult = bloques[bloques.length - 1];
        if (!g.grupo && ult && !ult.grupo && ult.titulo === titulo) ult.cols.push(...g.cols);
        else bloques.push({ titulo, grupo: g.grupo, cols: g.cols.slice() });
      }
      let cuerpo = '';
      for (const b of bloques) {
        cuerpo += '<div class="grupo-tit">' + e(b.titulo) + '</div><div class="meds">' + b.cols.map((c) => campoMedicion(f, c)).join('') + '</div>';
      }
      tarjeta.innerHTML =
        '<div class="maq-card-cab"><div class="t"><span>' + e(f.codigo || '') + ' · ' + (actual + 1) + ' DE ' + filas.length + '</span><h2>' + e(f.nombre) + '</h2></div>' +
          '<div class="maq-acciones">' +
            '<button class="btn btn-secundario btn-chico" data-a="todoOk">' + U.icon('check', 'sm') + '<span>Todo bien</span></button>' +
            '<button class="btn btn-secundario btn-chico" data-a="noOpera" aria-pressed="' + !!o._noOpera + '">' + U.icon('apagar', 'sm') + '<span>' + (o._noOpera ? 'Sí opera' : 'No opera') + '</span></button>' +
            '<label class="btn btn-secundario btn-chico" style="cursor:pointer">' + U.icon('camara', 'sm') + '<span>Foto</span><input type="file" accept="image/*" capture="environment" data-foto="' + e(f.id) + '" hidden></label>' +
          '</div></div>' +
        (o._noOpera ? '<div class="aviso" style="margin:14px 18px 0">' + U.icon('apagar') + '<div><b>Equipo marcado como "no opera"</b>No se requieren mediciones. Anota el motivo en observaciones.</div></div>' : '') +
        '<div class="maq-cuerpo' + (o._noOpera ? ' noop' : '') + '">' + cuerpo +
          '<div class="fotos-mini" id="fotos-' + e(f.id) + '" style="margin-top:12px"></div></div>' +
        '<div class="maq-nav">' +
          '<button class="btn btn-secundario btn-grande" data-a="ant"' + (actual === 0 ? ' disabled' : '') + '>' + U.icon('izq') + '<span>Anterior</span></button>' +
          (actual < filas.length - 1
            ? '<button class="btn btn-primario btn-grande" data-a="sig"><span>Siguiente</span>' + U.icon('der') + '</button>'
            : '<button class="btn btn-primario btn-grande" data-a="irCierre"><span>Ir al cierre</span>' + U.icon('abajo') + '</button>') +
        '</div>';
      U.$$('[data-maq]', main).forEach((b) => b.setAttribute('aria-current', +b.dataset.maq === actual));
      const activo = U.$('[data-maq="' + actual + '"]', main);
      if (activo && activo.scrollIntoView) activo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      pintarFotos(f.id);
    }

    function pintarModoMaquina() {
      U.$('#zona', main).innerHTML =
        '<div class="cap-cuerpo">' +
          '<div class="tarjeta maq-lista" role="list">' + filas.map((f, i) =>
            '<button class="maq-item" role="listitem" data-maq="' + i + '"><span class="estado-maq"></span><span class="nm"><b>' + e(f.nombre) + '</b><span></span></span></button>').join('') + '</div>' +
          '<div class="tarjeta maq-card" id="maq-card"></div>' +
        '</div>';
      pintarMaquina();
      pintarProgreso();
    }

    /* ---------------- Modo formato (rejilla) ---------------- */
    function celda(f, c) {
      if (M.omitida(f, c)) return '<td class="omit" aria-label="No aplica"></td>';
      const v = vals(f)[c.id];
      const ev = M.evaluar(c, f, v);
      const fuera = M.esAlerta(ev) ? ' fuera' : '';
      if (c.tipo === 'check') {
        return '<td class="' + fuera.trim() + '"><button type="button" class="chk ' + (v || '') + '" data-ciclo data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" aria-label="' + e(c.label) + '">' + e(M.TEXTO_CHECK[v] || '') + '</button></td>';
      }
      if (c.tipo === 'opciones') {
        return '<td><select data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" aria-label="' + e(c.label) + '"><option value=""></option>' +
          (c.opciones || []).map((o) => '<option' + (o === v ? ' selected' : '') + '>' + e(o) + '</option>').join('') + '</select></td>';
      }
      if (c.tipo === 'hora') return '<td><input type="time" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" value="' + e(v || '') + '" aria-label="' + e(c.label) + '"></td>';
      if (c.tipo === 'texto') return '<td class="txt"><input type="text" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" value="' + e(v || '') + '" aria-label="' + e(c.label) + '"></td>';
      const lim = M.limite(c, f);
      return '<td class="' + fuera.trim() + '"><input type="text" inputmode="decimal" autocomplete="off" data-f="' + e(f.id) + '" data-c="' + e(c.id) + '" value="' + e(v == null ? '' : v) + '" aria-label="' + e(f.nombre + ' ' + c.label) + '" title="' + e(lim ? 'Rango ' + M.textoLimite(lim, c.unidad) : '') + '"></td>';
    }

    function pintarModoFormato() {
      const hayGrupos = grupos.some((g) => g.grupo);
      let thead = '<thead><tr><th class="esquina" rowspan="' + (hayGrupos ? 2 : 1) + '">' + e(formato.tabla.titulo) + '</th>';
      for (const g of grupos) {
        if (g.grupo) thead += '<th colspan="' + g.cols.length + '">' + e(g.grupo) + '</th>';
        else thead += '<th rowspan="' + (hayGrupos ? 2 : 1) + '">' + e(g.cols[0].label) + (g.cols[0].unidad ? '<span class="unidad-th">' + e(g.cols[0].unidad) + '</span>' : '') + '</th>';
      }
      thead += '</tr>';
      if (hayGrupos) {
        thead += '<tr>';
        for (const g of grupos) if (g.grupo) for (const c of g.cols) thead += '<th>' + e(c.label) + (c.unidad && !g.grupo.includes(c.unidad) ? '<span class="unidad-th">' + e(c.unidad) + '</span>' : '') + '</th>';
        thead += '</tr>';
      }
      thead += '</thead>';
      const tbody = '<tbody>' + filas.map((f, i) => '<tr data-fila="' + i + '"><th>' + e(f.nombre) + (f.codigo ? '<small>' + e(f.codigo) + '</small>' : '') + '</th>' + cols.map((c) => celda(f, c)).join('') + '</tr>').join('') + '</tbody>';
      U.$('#zona', main).innerHTML =
        '<div class="tarjeta"><div class="rejilla-scroll"><table class="rejilla-cap">' + thead + tbody + '</table></div></div>' +
        '<p class="t-xs muted" style="margin-top:8px">Toca una casilla de verificación para cambiar: vacío → ✓ → ✗ → N/A. Las celdas en rojo están fuera de rango; mantén el dedo sobre una celda para ver su rango.</p>';
      pintarProgreso();
    }

    function pintarZona() {
      U.$$('[data-modo]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === modo));
      if (modo === 'formato') pintarModoFormato(); else pintarModoMaquina();
    }

    /* ---------------- Cierre: pie y firmas ---------------- */
    function pintarCierre() {
      let html = '<div class="tarjeta-cab"><h2>Cierre de la rutina</h2></div><div class="tarjeta-cuerpo">';
      for (const p of formato.pie || []) {
        html += '<div class="campo" style="margin-bottom:16px"><label for="pie_' + e(p.id) + '">' + e(p.label) + '</label>' +
          '<textarea class="textarea" id="pie_' + e(p.id) + '" data-pie="' + e(p.id) + '" rows="' + (p.lineas || 3) + '">' + e(reg.pie[p.id] || '') + '</textarea></div>';
      }
      if ((formato.firmas || []).length) {
        html += '<div class="etq" style="margin-bottom:10px">Firmas' + (M.config.firmaObligatoria ? ' (obligatorias para finalizar)' : '') + '</div><div class="firmas-cap">';
        for (const fi of formato.firmas) {
          const d = reg.firmas[fi.id] || {};
          html += '<div class="firma-caja"><div class="fila-flex"><b>' + e(fi.label) + '</b><span class="t-sm muted">' + e(fi.sub || '') + '</span></div>' +
            '<div class="lienzo-firma" data-firmar="' + e(fi.id) + '" role="button" tabindex="0" aria-label="Firmar ' + e(fi.label) + '">' +
              (U.srcImagen(d.img) ? '<img src="' + U.srcImagen(d.img) + '" alt="Firma">' : '<span>' + U.icon('firma') + 'Toca para firmar</span>') + '</div>' +
            '<input class="input" data-firma-nombre="' + e(fi.id) + '" placeholder="Nombre" value="' + e(d.nombre || '') + '" list="lista-insp">' +
            (d.img ? '<button class="btn btn-texto btn-chico" data-borrar-firma="' + e(fi.id) + '">' + U.icon('basura', 'sm') + 'Borrar firma</button>' : '') +
          '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
      U.$('#cierre', main).innerHTML = html;
    }

    /* ---------------- Fotos ---------------- */
    let fotos = [];
    if (!esNuevo) DB.fotosDe(reg.id).then((l) => { fotos = l; if (modo === 'maquina') pintarFotos(filas[actual].id); }).catch(() => {});
    function pintarFotos(filaId) {
      const cont = U.$('#fotos-' + CSS.escape(filaId), main);
      if (!cont) return;
      cont.innerHTML = fotos.filter((x) => x.filaId === filaId).map((x) =>
        '<figure><img src="' + U.srcImagen(x.data) + '" alt="Foto" data-ver-foto="' + e(x.id) + '"><button data-borrar-foto="' + e(x.id) + '" aria-label="Borrar foto">' + U.icon('x') + '</button></figure>').join('');
    }
    async function agregarFoto(filaId, archivo) {
      try {
        const data = await U.comprimirImagen(archivo, 1280, 0.7);
        if (!guardadoUnaVez) await guardar('Creado').local;
        const foto = { id: U.uid('foto'), registroId: reg.id, filaId, data, creadoEn: Date.now(), por: App.inspector };
        fotos.push(foto);
        DB.guardarFoto(foto);
        pintarFotos(filaId);
        U.toast('Foto agregada');
      } catch (err) { U.toast(err.message, 'error'); }
    }

    /* ---------------- Firma ---------------- */
    async function firmar(id) {
      const fi = formato.firmas.find((x) => x.id === id);
      const cuerpo = U.html('<div><canvas class="pad-firma"></canvas><p class="t-sm muted" style="margin-top:8px">Firma con el dedo o con un lápiz digital dentro del recuadro.</p></div>');
      const canvas = U.$('canvas', cuerpo);
      let ctx, trazo = false, hayTinta = false, ultimo;
      const r = await U.modal({
        titulo: 'Firma · ' + fi.label, contenido: cuerpo, ancho: 640,
        alAbrir: () => {
          const ratio = window.devicePixelRatio || 1;
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          ctx = canvas.getContext('2d');
          ctx.scale(ratio, ratio);
          ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0a1a3a';
          const pos = (ev) => { const b = canvas.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; };
          canvas.addEventListener('pointerdown', (ev) => { trazo = true; ultimo = pos(ev); canvas.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#0a1a3a'; ctx.fill(); hayTinta = true; });
          canvas.addEventListener('pointermove', (ev) => {
            if (!trazo) return;
            const p = pos(ev);
            ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ultimo = p; hayTinta = true;
          });
          const fin = () => { trazo = false; };
          canvas.addEventListener('pointerup', fin);
          canvas.addEventListener('pointercancel', fin);
        },
        botones: [
          { texto: 'Limpiar', clase: 'btn-secundario', accion: () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); hayTinta = false; return false; } },
          { texto: 'Cancelar', clase: 'btn-secundario', valor: null },
          { texto: 'Guardar firma', clase: 'btn-primario', accion: () => (hayTinta ? recortarFirma(canvas) : (U.toast('Dibuja la firma primero', 'aviso'), false)) }
        ]
      });
      if (!r) return;
      reg.firmas[id] = Object.assign({}, reg.firmas[id], { img: r, fecha: Date.now() });
      if (!reg.firmas[id].nombre && fi.auto === 'inspector') reg.firmas[id].nombre = App.inspector;
      pintarCierre();
      cambio();
    }
    // Recorta el espacio en blanco y reduce la firma para que pese poco.
    function recortarFirma(canvas) {
      const ctx = canvas.getContext('2d');
      const { width: w, height: h } = canvas;
      const d = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const m = 8;
      x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
      const cw = x1 - x0, ch = y1 - y0;
      const esc = Math.min(1, 420 / cw, 140 / ch);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(cw * esc)); out.height = Math.max(1, Math.round(ch * esc));
      out.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }

    /* ---------------- Finalizar ---------------- */
    async function finalizar() {
      autoguardar.cancel();
      const r = M.resumen(reg, formato);
      const faltan = r.total - r.completas;
      const sinFirma = (formato.firmas || []).filter((fi) => !(reg.firmas[fi.id] && reg.firmas[fi.id].img));
      if (M.config.firmaObligatoria && sinFirma.length) {
        U.toast('Falta la firma: ' + sinFirma.map((x) => x.label).join(', '), 'error');
        U.$('#cierre', main).scrollIntoView({ behavior: 'smooth' });
        return;
      }
      let msg = '';
      if (faltan) msg += '<div class="aviso">' + U.icon('alerta') + '<div><b>Faltan ' + faltan + ' de ' + r.total + ' por completar</b>' + filas.filter((f) => !M.estadoFila(reg, formato, f).completa).map((f) => e(f.nombre)).join(', ') + '</div></div>';
      if (r.alertas.length) msg += '<div class="aviso" style="background:var(--bad-soft)">' + U.icon('alerta') + '<div><b>' + r.alertas.length + ' alerta' + (r.alertas.length === 1 ? '' : 's') + '</b>' + r.alertas.slice(0, 6).map((a) => e(a.fila.nombre + ' · ' + M.textoAlerta(a))).join('<br>') + (r.alertas.length > 6 ? '<br>…' : '') + '</div></div>';
      if (sinFirma.length) msg += '<p class="t-sm muted">Sin firma: ' + sinFirma.map((x) => e(x.label)).join(', ') + '.</p>';
      if (!msg) msg = '<p class="modal-texto">Todo completo y sin alertas. ¿Finalizar la rutina?</p>';
      const ok = await U.modal({
        titulo: eraCompleto ? 'Guardar cambios' : 'Finalizar rutina', contenido: msg, ancho: 560,
        botones: [{ texto: 'Seguir capturando', clase: 'btn-secundario', valor: false }, { texto: eraCompleto ? 'Guardar' : 'Finalizar', clase: 'btn-ok', valor: true }]
      });
      if (!ok) return;
      const enc = formato.encabezado.find((c) => c.auto === 'alFinalizar');
      if (enc && !reg.encabezado[enc.id]) reg.encabezado[enc.id] = U.ahoraHM();
      reg.estado = 'completo';
      if (!reg.finalizadoEn) reg.finalizadoEn = Date.now();
      guardar(eraCompleto ? 'Editado' : 'Finalizado');
      U.toast(eraCompleto ? 'Cambios guardados' : 'Rutina finalizada y guardada');
      App.ir('/ver/' + encodeURIComponent(reg.id), true);
    }

    /* ---------------- Eventos ---------------- */
    main.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.enc) {
        reg.encabezado[t.dataset.enc] = t.value;
        if (t.dataset.enc === 'inspector') {
          const fi = (formato.firmas || []).find((x) => x.auto === 'inspector');
          if (fi && reg.firmas[fi.id] && !reg.firmas[fi.id].img) { reg.firmas[fi.id].nombre = t.value; const n = U.$('[data-firma-nombre="' + fi.id + '"]', main); if (n) n.value = t.value; }
        }
        cambio(); return;
      }
      if (t.dataset.pie) { reg.pie[t.dataset.pie] = t.value; cambio(); return; }
      if (t.dataset.firmaNombre) { reg.firmas[t.dataset.firmaNombre] = Object.assign({}, reg.firmas[t.dataset.firmaNombre], { nombre: t.value }); cambio(); return; }
      if (t.dataset.f && t.dataset.c && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        const f = filas.find((x) => x.id === t.dataset.f);
        const c = cols.find((x) => x.id === t.dataset.c);
        let v = t.value;
        if (c.tipo === 'numero') v = v.replace(',', '.').replace(/[^0-9.\-]/g, '');
        if (c.tipo === 'numero' && v !== t.value.replace(',', '.')) t.value = v;
        ponerValor(f, c, c.tipo === 'texto' ? v : v.trim());
        // Evaluación en vivo
        const ev2 = M.evaluar(c, f, v);
        const med = t.closest('.med');
        if (med) {
          const lim = M.limite(c, f);
          med.classList.toggle('mal', M.esAlerta(ev2));
          med.classList.toggle('ok', ev2 === 'ok' && c.tipo === 'numero' && !!lim);
          const evEl = U.$('.ev', med);
          if (evEl) evEl.innerHTML = evaluacionHTML(c, f, v);
        }
        const td = t.closest('td');
        if (td) td.classList.toggle('fuera', M.esAlerta(ev2));
      }
    });
    main.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.dataset.foto) { const a = t.files && t.files[0]; if (a) agregarFoto(t.dataset.foto, a); t.value = ''; return; }
      if (t.tagName === 'SELECT' && t.dataset.f) {
        const f = filas.find((x) => x.id === t.dataset.f);
        const c = cols.find((x) => x.id === t.dataset.c);
        ponerValor(f, c, t.value);
      }
    });
    main.addEventListener('keydown', (ev) => {
      // Enter en un número pasa al siguiente campo
      if (ev.key === 'Enter' && ev.target.matches('input[inputmode="decimal"]')) {
        ev.preventDefault();
        const todos = U.$$('input[inputmode="decimal"], textarea[data-f]', main);
        const i = todos.indexOf(ev.target);
        if (todos[i + 1]) todos[i + 1].focus(); else ev.target.blur();
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset.firmar) { ev.preventDefault(); firmar(ev.target.dataset.firmar); }
    });
    main.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button, [data-firmar], [data-ver-foto]');
      if (!t) return;
      if (t.dataset.modo) { modo = t.dataset.modo; U.lsSet('ps_modo_captura', modo); pintarZona(); return; }
      if (t.dataset.maq != null) { actual = +t.dataset.maq; pintarMaquina(); return; }
      if (t.dataset.firmar) { firmar(t.dataset.firmar); return; }
      if (t.dataset.borrarFirma) { reg.firmas[t.dataset.borrarFirma].img = ''; pintarCierre(); cambio(); return; }
      if (t.dataset.verFoto) { const x = fotos.find((y) => y.id === t.dataset.verFoto); if (x) V.verFoto(x.data); return; }
      if (t.dataset.borrarFoto) {
        if (!(await U.confirmar('Borrar foto', '¿Seguro que quieres borrar esta foto?', 'Borrar', true))) return;
        const x = fotos.find((y) => y.id === t.dataset.borrarFoto);
        fotos = fotos.filter((y) => y !== x);
        DB.eliminarFoto(x.id);
        pintarFotos(x.filaId);
        return;
      }
      if (t.dataset.ahora) {
        const f = filas.find((x) => x.id === t.dataset.ahora);
        const c = cols.find((x) => x.id === t.dataset.c);
        const h = U.ahoraHM();
        U.$('[data-f="' + f.id + '"][data-c="' + c.id + '"]', main).value = h;
        ponerValor(f, c, h); return;
      }
      if (t.dataset.v != null && t.dataset.f) {
        const f = filas.find((x) => x.id === t.dataset.f);
        const c = cols.find((x) => x.id === t.dataset.c);
        const nuevo = vals(f)[c.id] === t.dataset.v ? '' : t.dataset.v;
        ponerValor(f, c, nuevo);
        U.$$('[data-f="' + f.id + '"][data-c="' + c.id + '"]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === nuevo));
        const med = t.closest('.med');
        if (med) med.classList.toggle('mal', nuevo === 'mal');
        return;
      }
      if (t.hasAttribute('data-ciclo')) {
        const f = filas.find((x) => x.id === t.dataset.f);
        const c = cols.find((x) => x.id === t.dataset.c);
        const orden = ['', 'ok', 'mal', 'na'];
        const sig = orden[(orden.indexOf(vals(f)[c.id] || '') + 1) % orden.length];
        ponerValor(f, c, sig);
        t.className = 'chk ' + sig;
        t.textContent = M.TEXTO_CHECK[sig] || '';
        t.closest('td').classList.toggle('fuera', sig === 'mal');
        return;
      }
      const a = t.dataset.a;
      if (!a) return;
      const f = filas[actual];
      if (a === 'sig') { actual = Math.min(filas.length - 1, actual + 1); pintarMaquina(); U.$('#maq-card', main).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (a === 'ant') { actual = Math.max(0, actual - 1); pintarMaquina(); U.$('#maq-card', main).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (a === 'irCierre') U.$('#cierre', main).scrollIntoView({ behavior: 'smooth' });
      else if (a === 'todoOk') {
        const o = vals(f);
        let n = 0;
        for (const c of cols) if (c.tipo === 'check' && !M.omitida(f, c) && !o[c.id]) { o[c.id] = 'ok'; n++; }
        const est = cols.find((c) => c.id === 'estado' && c.tipo === 'opciones');
        if (est && !o.estado && !M.omitida(f, est)) o.estado = est.opciones[0];
        const colHora = cols.find((x) => x.tipo === 'hora' && x.auto === 'ahora');
        if (colHora && !o[colHora.id]) o[colHora.id] = U.ahoraHM();
        cambio(); pintarMaquina();
        U.toast(n ? 'Verificaciones marcadas como ✓' : 'Ya estaban todas marcadas', n ? 'ok' : 'aviso', 1600);
      } else if (a === 'noOpera') {
        const o = vals(f);
        o._noOpera = !o._noOpera;
        const est = cols.find((c) => c.id === 'estado' && c.tipo === 'opciones');
        if (est && !M.omitida(f, est)) o.estado = o._noOpera ? (est.opciones.find((x) => /paro/i.test(x)) || est.opciones[1]) : (o.estado && /paro/i.test(o.estado) ? '' : o.estado);
        const colHora = cols.find((x) => x.tipo === 'hora' && x.auto === 'ahora');
        if (colHora && o._noOpera && !o[colHora.id]) o[colHora.id] = U.ahoraHM();
        cambio(); pintarMaquina();
      } else if (a === 'previa') { autoguardar.flush(); V.vistaPrevia({ registros: [reg] }); }
      else if (a === 'guardar') {
        autoguardar.cancel();
        guardar(null);
        U.toast('Guardado. Puedes continuar después desde Inicio.');
        App.ir('/inicio');
      } else if (a === 'finalizar') finalizar();
    });

    pintarZona();
    pintarCierre();
    pintarProgreso();

    // Guardar lo pendiente al salir de la vista o cerrar la pestaña
    const alOcultar = () => { if (document.visibilityState === 'hidden' && sucio) autoguardar.flush(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      if (sucio) autoguardar.flush(); else autoguardar.cancel();
    };
  };
})();
