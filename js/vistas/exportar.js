/* Centro de exportación e impresión: elegir formato, fechas y registros. */
(function () {
  'use strict';

  const e = U.esc;
  const CLAVE = 'ps_filtros_exportar';

  Vistas.exportar = async (main) => {
    const g = U.lsGet(CLAVE, {});
    const st = {
      formato: g.formato && M.formato(g.formato) ? g.formato : '',
      modo: g.modo || 'rango',
      rapido: g.rapido || 'hoy',
      turno: g.turno || '',
      soloFinal: !!g.soloFinal,
      dias: new Set(),
      excluidos: new Set(),
      mes: U.hoyISO().slice(0, 7)
    };
    Object.assign(st, U.rangoRapido(st.rapido === 'personal' ? 'hoy' : st.rapido));
    if (st.rapido === 'personal' && g.desde) { st.desde = g.desde; st.hasta = g.hasta; }
    let clicPendiente = null; // primer clic de un rango en el calendario
    let registros = [];
    const guardarFiltros = () => U.lsSet(CLAVE, { formato: st.formato, modo: st.modo, rapido: st.rapido, turno: st.turno, soloFinal: st.soloFinal, desde: st.desde, hasta: st.hasta });

    main.innerHTML =
      '<div class="vista-cab"><div class="titulos"><h1>Exportar e imprimir</h1><p>Elige el formato y las fechas. Puedes ver la vista previa antes de imprimir o descargar en Excel con el mismo diseño del formato.</p></div></div>' +
      '<div class="exp-grid">' +
        '<div class="tarjeta tarjeta-cuerpo">' +
          '<div class="bloque"><div class="paso"><span class="n">1</span>Formato</div>' +
            '<select class="select" id="x-formato">' + V.opcionesFormatos(st.formato, true) + '</select></div>' +
          '<div class="bloque"><div class="paso"><span class="n">2</span>Fechas</div>' +
            '<div class="segmentado" style="margin-bottom:12px"><button data-modo="rango">' + U.icon('calendario', 'sm') + 'Rango de fechas</button><button data-modo="dias">' + U.icon('check', 'sm') + 'Días específicos</button></div>' +
            '<div class="chips" id="x-rapidos" style="margin-bottom:12px">' +
              [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['7d', '7 días'], ['mes', 'Este mes'], ['mesPasado', 'Mes pasado']].map(([k, t]) => '<button class="chip" data-rapido="' + k + '">' + t + '</button>').join('') + '</div>' +
            '<div class="rejilla" id="x-rango" style="grid-template-columns:1fr 1fr;margin-bottom:14px">' +
              '<div class="campo"><label for="x-desde">Desde</label><input class="input" type="date" id="x-desde"></div>' +
              '<div class="campo"><label for="x-hasta">Hasta</label><input class="input" type="date" id="x-hasta"></div></div>' +
            '<div class="calendario" id="x-cal"></div>' +
            '<p class="t-sm muted" id="x-ayuda-cal" style="margin-top:8px"></p></div>' +
          '<div class="bloque"><div class="paso"><span class="n">3</span>Filtros</div>' +
            '<div class="campo" style="margin-bottom:8px"><label for="x-turno">Turno</label><select class="select" id="x-turno">' + V.opcionesTurnos(st.turno) + '</select></div>' +
            '<label class="check-linea"><input type="checkbox" id="x-final"' + (st.soloFinal ? ' checked' : '') + '> Solo rutinas finalizadas</label></div>' +
        '</div>' +
        '<div>' +
          '<div class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-cuerpo">' +
            '<div class="exp-acciones">' +
              '<button class="btn btn-primario" data-acc="imprimir">' + U.icon('imprimir') + '<span class="t">Vista previa e imprimir<small id="x-cuenta1"></small></span></button>' +
              '<button class="btn btn-secundario" data-acc="excel">' + U.icon('excel') + '<span class="t">Excel con el formato<small>El mismo archivo original, ya lleno</small></span></button>' +
              '<button class="btn btn-secundario" data-acc="datos">' + U.icon('tabla') + '<span class="t">Excel de datos<small>Tabla para análisis</small></span></button>' +
              '<button class="btn btn-secundario" data-acc="blanco">' + U.icon('hoja') + '<span class="t">Formato en blanco<small>Para llenar a mano</small></span></button>' +
            '</div></div></div>' +
          '<div class="tarjeta" id="x-lista"></div>' +
        '</div>' +
      '</div>';

    const $ = (s) => U.$(s, main);

    /* ---------------- Calendario ---------------- */
    function pintarCalendario() {
      const [y, m] = st.mes.split('-').map(Number);
      const primero = new Date(y, m - 1, 1);
      const inicio = new Date(primero); inicio.setDate(1 - ((primero.getDay() + 6) % 7));
      const conDatos = new Set(registros.filter(coincideSinFecha).map((r) => r.fecha));
      const hoy = U.hoyISO();
      let html = '<div class="cal-cab"><button class="btn-icono chico" data-mes="-1" aria-label="Mes anterior">' + U.icon('izq') + '</button>' +
        '<b>' + U.MESES[m - 1] + ' ' + y + '</b><button class="btn-icono chico" data-mes="1" aria-label="Mes siguiente">' + U.icon('der') + '</button></div><div class="cal-dias">' +
        ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => '<span class="dsem">' + d + '</span>').join('');
      for (let i = 0; i < 42; i++) {
        const d = new Date(inicio); d.setDate(inicio.getDate() + i);
        const iso = U.hoyISO(d);
        let cls = 'cal-dia';
        if (d.getMonth() !== m - 1) cls += ' fuera-mes';
        if (iso === hoy) cls += ' hoy';
        if (conDatos.has(iso)) cls += ' con-datos';
        if (st.modo === 'dias') { if (st.dias.has(iso)) cls += ' sel'; }
        else if (clicPendiente) { if (iso === clicPendiente) cls += ' sel'; }
        else if (iso === st.desde || iso === st.hasta) cls += ' sel';
        else if (iso > st.desde && iso < st.hasta) cls += ' en-rango';
        html += '<button class="' + cls + '" data-dia="' + iso + '" aria-label="' + e(U.fechaLarga(iso)) + '">' + d.getDate() + '</button>';
      }
      html += '</div><div class="cal-leyenda"><span><i></i>Día con registros</span>' + (st.modo === 'dias' && st.dias.size ? '<button class="btn btn-texto btn-chico" data-limpiar-dias>Quitar días (' + st.dias.size + ')</button>' : '') + '</div>';
      $('#x-cal').innerHTML = html;
      $('#x-ayuda-cal').textContent = st.modo === 'dias'
        ? 'Toca cada día que quieras incluir. Puedes cambiar de mes y seguir eligiendo.'
        : (clicPendiente ? 'Ahora toca el día final del rango.' : 'Toca el día inicial y luego el día final para elegir un rango.');
    }

    /* ---------------- Filtrado ---------------- */
    function coincideSinFecha(r) {
      if (st.formato && r.formatoId !== st.formato) return false;
      if (st.turno && String(r.turno) !== st.turno) return false;
      if (st.soloFinal && r.estado !== 'completo') return false;
      return true;
    }
    function coincide(r) {
      if (!coincideSinFecha(r)) return false;
      if (st.modo === 'dias') return st.dias.has(r.fecha);
      return r.fecha >= st.desde && r.fecha <= st.hasta;
    }
    const encontrados = () => registros.filter(coincide).sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.turno).localeCompare(String(b.turno)));
    const elegidos = () => encontrados().filter((r) => !st.excluidos.has(r.id));

    function pintarLista() {
      const lista = encontrados();
      const n = lista.filter((r) => !st.excluidos.has(r.id)).length;
      const nh = M.paginas(lista.filter((r) => !st.excluidos.has(r.id))).length;
      $('#x-cuenta1').textContent = nh + (nh === 1 ? ' hoja' : ' hojas') + ' · ' + n + (n === 1 ? ' registro' : ' registros');
      let desc;
      if (st.modo === 'dias') desc = st.dias.size ? st.dias.size + (st.dias.size === 1 ? ' día elegido' : ' días elegidos') : 'Ningún día elegido';
      else desc = st.desde === st.hasta ? U.fechaLarga(st.desde) : U.fechaMedia(st.desde) + ' — ' + U.fechaMedia(st.hasta);
      $('#x-lista').innerHTML =
        '<div class="resultado-cab"><div><b>' + n + ' de ' + lista.length + ' rutina' + (lista.length === 1 ? '' : 's') + ' seleccionada' + (lista.length === 1 ? '' : 's') + '</b><div class="t-sm muted" style="text-transform:none">' + e(desc) + '</div></div><span class="espacio"></span>' +
          (lista.length ? '<button class="btn btn-texto btn-chico" data-todos="1">Todas</button><button class="btn btn-texto btn-chico" data-todos="0">Ninguna</button>' : '') + '</div>' +
        (lista.length
          ? '<div class="tabla-wrap"><table class="tabla responsiva"><thead><tr><th class="chk"></th><th>Fecha</th><th>Turno</th><th>Formato</th><th>Inspector</th><th>Estado</th><th>Alertas</th></tr></thead><tbody>' +
            lista.map((r) => {
              const f = M.formato(r.formatoId);
              const res = M.resumen(r, f);
              return '<tr data-tog="' + e(r.id) + '"><td class="chk"><input type="checkbox" data-x="' + e(r.id) + '"' + (st.excluidos.has(r.id) ? '' : ' checked') + ' aria-label="Incluir"></td>' +
                '<td class="fuerte num">' + e(U.fechaCorta(r.fecha)) + '</td><td class="nowrap">' + e(M.nombreTurno(r.turno)) + '</td>' +
                '<td class="col-formato"><div class="fuerte">' + e(f ? M.tituloRegistro(f, r) : r.formatoId) + '</div><div class="t-xs muted">' + e(f ? f.archivo : '') + '</div></td>' +
                '<td data-m="ocultar">' + e(r.encabezado && r.encabezado.inspector || '') + '</td><td data-m="ocultar">' + V.badgeEstado(r) + '</td><td>' + V.badgeAlertas(res.alertas.length) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<div class="vacio">' + U.icon('calendario') + '<p><b>No hay rutinas en esas fechas</b></p><p class="t-sm">Los días con registros tienen un punto azul en el calendario.</p></div>');
    }

    function pintarControles() {
      U.$$('[data-modo]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === st.modo));
      U.$$('[data-rapido]', main).forEach((b) => b.setAttribute('aria-pressed', st.modo === 'rango' && b.dataset.rapido === st.rapido));
      $('#x-rapidos').hidden = st.modo !== 'rango';
      $('#x-rango').hidden = st.modo !== 'rango';
      $('#x-desde').value = st.desde;
      $('#x-hasta').value = st.hasta;
    }
    const pintar = () => { pintarControles(); pintarCalendario(); pintarLista(); };

    /* ---------------- Datos ---------------- */
    let quitar = null;
    let rangoSus = '';
    function suscribir() {
      const [y, m] = st.mes.split('-').map(Number);
      const mesIni = st.mes + '-01';
      const mesFin = U.hoyISO(new Date(y, m, 0));
      const fechas = [mesIni, mesFin];
      if (st.modo === 'rango') fechas.push(st.desde, st.hasta); else fechas.push(...st.dias);
      fechas.sort();
      const desde = fechas[0], hasta = fechas[fechas.length - 1];
      if (rangoSus === desde + hasta) { pintar(); return; }
      rangoSus = desde + hasta;
      if (quitar) quitar();
      quitar = DB.suscribirRegistros({ desde, hasta }, (l) => { registros = l; pintar(); });
    }

    /* ---------------- Eventos ---------------- */
    main.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.id === 'x-formato') { st.formato = t.value; guardarFiltros(); pintar(); }
      else if (t.id === 'x-turno') { st.turno = t.value; guardarFiltros(); pintar(); }
      else if (t.id === 'x-final') { st.soloFinal = t.checked; guardarFiltros(); pintar(); }
      else if (t.id === 'x-desde' || t.id === 'x-hasta') {
        st.desde = $('#x-desde').value || st.desde; st.hasta = $('#x-hasta').value || st.hasta;
        if (st.desde > st.hasta) { const x = st.desde; st.desde = st.hasta; st.hasta = x; }
        st.rapido = 'personal'; st.mes = st.hasta.slice(0, 7); guardarFiltros(); suscribir();
      } else if (t.dataset.x) { if (t.checked) st.excluidos.delete(t.dataset.x); else st.excluidos.add(t.dataset.x); pintarLista(); }
    });
    main.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button, input');
      if (!b) {
        const tr = ev.target.closest('tr[data-tog]');
        if (tr) { const id = tr.dataset.tog; if (st.excluidos.has(id)) st.excluidos.delete(id); else st.excluidos.add(id); pintarLista(); }
        return;
      }
      if (b.dataset.modo) { st.modo = b.dataset.modo; clicPendiente = null; guardarFiltros(); suscribir(); return; }
      if (b.dataset.rapido) { st.rapido = b.dataset.rapido; Object.assign(st, U.rangoRapido(st.rapido)); st.mes = st.hasta.slice(0, 7); clicPendiente = null; guardarFiltros(); suscribir(); return; }
      if (b.dataset.mes) {
        const [y, m] = st.mes.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(b.dataset.mes), 1);
        st.mes = U.hoyISO(d).slice(0, 7); suscribir(); return;
      }
      if (b.hasAttribute('data-limpiar-dias')) { st.dias.clear(); pintar(); return; }
      if (b.dataset.dia) {
        const iso = b.dataset.dia;
        if (st.modo === 'dias') { if (st.dias.has(iso)) st.dias.delete(iso); else st.dias.add(iso); pintar(); return; }
        if (!clicPendiente) { clicPendiente = iso; st.desde = st.hasta = iso; }
        else { st.desde = clicPendiente < iso ? clicPendiente : iso; st.hasta = clicPendiente < iso ? iso : clicPendiente; clicPendiente = null; }
        st.rapido = 'personal'; guardarFiltros(); suscribir(); return;
      }
      if (b.dataset.todos) { encontrados().forEach((r) => (b.dataset.todos === '1' ? st.excluidos.delete(r.id) : st.excluidos.add(r.id))); pintarLista(); return; }
      const acc = b.dataset.acc;
      if (!acc) return;
      if (acc === 'blanco') {
        let f = M.formato(st.formato);
        if (!f && M.formatos().length === 1) f = M.formatos()[0];
        if (!f) {
          const id = await U.modal({ titulo: 'Formato en blanco', ancho: 520, contenido: '<p class="modal-texto" style="margin-bottom:12px">¿Qué formato quieres imprimir en blanco?</p>' +
            '<div class="lista-edit">' + M.formatos().map((x) => '<button class="btn btn-secundario btn-bloque" style="justify-content:flex-start" data-elegir="' + e(x.id) + '">' + U.icon('hoja') + e(x.titulo) + '</button>').join('') + '</div>',
            botones: [], alAbrir: (c, cerrar) => c.addEventListener('click', (ev2) => { const x = ev2.target.closest('[data-elegir]'); if (x) cerrar(x.dataset.elegir); }) });
          f = M.formato(id);
          if (!f) return;
        }
        V.vistaPrevia({ formatoBlanco: f });
        return;
      }
      const sel = elegidos();
      if (!sel.length) { U.toast('No hay rutinas seleccionadas para esas fechas', 'aviso'); return; }
      if (acc === 'imprimir') {
        const nh = M.paginas(sel).length;
        if (nh > 60 && !(await U.confirmar('Muchas hojas', 'Vas a generar ' + nh + ' hojas. Puede tardar un poco. ¿Continuar?', 'Continuar'))) return;
        V.vistaPrevia({ registros: sel });
      } else if (acc === 'excel') V.exportarExcel(sel);
      else if (acc === 'datos') V.exportarExcel(sel, 'datos');
    });

    pintarControles();
    suscribir();
    return () => { if (quitar) quitar(); };
  };
})();
