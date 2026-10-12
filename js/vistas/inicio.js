/* Inicio (tablero del día) y selección de formato para capturar. */
(function () {
  'use strict';

  const e = U.esc;

  function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  function avisos() {
    let html = '';
    if (DB.modo === 'local') {
      html += '<div class="aviso">' + U.icon('tableta') + '<div><b>Modo local</b>Los registros se guardan solo en este dispositivo. Para guardarlos en la nube y verlos desde cualquier tableta o computadora, conecta Firebase (instrucciones en README.md).</div></div>';
    }
    if (M.formatos().some((f) => f.ejemplo)) {
      html += '<div class="aviso info">' + U.icon('info') + '<div><b>Formatos de ejemplo</b>Los formatos que ves son de muestra. Se reemplazarán por los formatos oficiales de la planta, con el mismo orden y diseño de la hoja impresa.</div></div>';
    }
    return html;
  }

  /** Tarjetas de formato con estado de los turnos de hoy. */
  function tarjetasFormatos(registros) {
    const hoy = U.hoyISO();
    const turnoAhora = U.turnoActual(M.config.turnos);
    return M.formatos().map((f) => {
      const deHoy = registros.filter((r) => r.formatoId === f.id && r.fecha === hoy);
      const pills = (M.config.turnos || []).map((t) => {
        const rs = deHoy.filter((r) => String(r.turno) === t.id);
        const hecho = rs.some((r) => r.estado === 'completo');
        const proc = !hecho && rs.length;
        return '<span class="turno-pill ' + (hecho ? 'hecho' : proc ? 'proceso' : '') + '" title="' + e(t.nombre) + '">' +
          U.icon(hecho ? 'check' : proc ? 'editar' : 'reloj') + e(t.nombre) + '</span>';
      }).join('');
      const borradores = registros.filter((r) => r.formatoId === f.id && r.estado !== 'completo')
        .slice(0, 3).map((r) => {
          const res = M.resumen(r, f);
          return '<div class="borrador-card"><div class="info"><b>En proceso · ' + e(U.fechaMedia(r.fecha)) + ' · ' + e(M.nombreTurno(r.turno)) + '</b>' +
            '<span>' + e(r.encabezado.inspector || r.creadoPor || '') + ' · ' + res.completas + ' de ' + res.total + ' revisadas</span></div>' +
            '<a class="btn btn-primario btn-chico" href="#/editar/' + encodeURIComponent(r.id) + '">Continuar</a></div>';
        }).join('');
      const filas = M.filasVigentes(f);
      return '<div class="tarjeta formato-card">' +
        '<div class="cab"><div class="ico-caja">' + U.icon('captura', 'lg') + '</div>' +
          '<div style="flex:1;min-width:0"><h3>' + e(f.titulo) + '</h3>' +
          '<div class="meta">' + e(f.codigo) + ' · Rev. ' + e(f.revision) + ' · ' + filas.length + ' ' + e(f.tabla.titulo.toLowerCase()) + (filas.length === 1 ? '' : 's') + (f.subtitulo ? ' · ' + e(f.subtitulo) : '') + '</div></div></div>' +
        '<div><div class="etq" style="margin-bottom:8px">Hoy</div><div class="turnos-hoy">' + pills + '</div></div>' +
        borradores +
        '<div class="grupo-btns">' +
          '<button class="btn btn-primario" data-nuevo="' + e(f.id) + '">' + U.icon('mas') + '<span>Nueva rutina · ' + e(M.nombreTurno(turnoAhora)) + '</span></button>' +
          '<button class="btn btn-secundario" data-blanco="' + e(f.id) + '">' + U.icon('imprimir') + '<span>Formato en blanco</span></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /** Acciones compartidas de las tarjetas de formato. */
  async function accionesFormato(ev, registros) {
    const n = ev.target.closest('[data-nuevo]');
    const b = ev.target.closest('[data-blanco]');
    if (b) { V.vistaPrevia({ formatoBlanco: M.formato(b.dataset.blanco) }); return; }
    if (!n) return;
    const f = M.formato(n.dataset.nuevo);
    const hoy = U.hoyISO();
    const turno = U.turnoActual(M.config.turnos);
    const abierto = registros.find((r) => r.formatoId === f.id && r.fecha === hoy && String(r.turno) === turno && r.estado !== 'completo');
    if (abierto) {
      const r = await U.modal({
        titulo: 'Ya hay una rutina en proceso',
        contenido: '<p class="modal-texto">Para <b>' + e(f.titulo) + '</b> ya existe una rutina de hoy (' + e(M.nombreTurno(turno)) + ') que no se ha finalizado. ¿Quieres continuarla o empezar una nueva?</p>',
        ancho: 520,
        botones: [
          { texto: 'Empezar nueva', clase: 'btn-secundario', valor: 'nueva' },
          { texto: 'Continuar la existente', clase: 'btn-primario', valor: 'seguir' }
        ]
      });
      if (r === 'seguir') return App.ir('/editar/' + encodeURIComponent(abierto.id));
      if (r !== 'nueva') return;
    }
    App.ir('/nuevo/' + f.id);
  }

  Vistas.inicio = async (main) => {
    const rango = { desde: U.sumarDias(U.hoyISO(), -6), hasta: U.hoyISO() };
    main.innerHTML =
      '<div class="vista-cab saludo"><div class="titulos"><h1 id="saludo"></h1><p>' + e(U.capital(U.fechaLarga(U.hoyISO()))) + '</p></div>' +
      '<a class="btn btn-primario btn-grande" href="#/capturar">' + U.icon('mas') + '<span>Capturar rutina</span></a></div>' +
      avisos() +
      '<div class="tiles" id="tiles"></div>' +
      '<div class="inicio-grid">' +
        '<section><div class="seccion-tit"><h2>Rutinas de inspección</h2></div><div id="formatos"></div></section>' +
        '<section>' +
          '<div class="seccion-tit"><h2>Alertas de los últimos 7 días</h2></div>' +
          '<div class="tarjeta" id="alertas"></div>' +
          '<div class="seccion-tit" style="margin-top:18px"><h2>Últimos registros</h2><a class="btn btn-texto btn-chico" href="#/registros">Ver todos</a></div>' +
          '<div class="tarjeta" id="ultimos"></div>' +
        '</section>' +
      '</div>';
    U.$('#saludo', main).textContent = saludo() + (App.inspector ? ', ' + App.inspector.split(' ')[0] : '');

    let registros = [];
    const pintar = () => {
      const hoy = U.hoyISO();
      const deHoy = registros.filter((r) => r.fecha === hoy);
      let maqRev = 0, maqTot = 0, alertasHoy = 0;
      for (const r of deHoy) { const res = M.resumen(r); maqRev += res.completas; maqTot += res.total; alertasHoy += res.alertas.length; }
      const fin = deHoy.filter((r) => r.estado === 'completo').length;
      const t = (M.config.turnos || []).find((x) => x.id === U.turnoActual(M.config.turnos));
      U.$('#tiles', main).innerHTML =
        '<div class="tarjeta tile"><span class="etq">' + U.icon('captura', 'sm') + 'Rutinas de hoy</span><span class="valor">' + fin + '<small> / ' + deHoy.length + '</small></span><span class="det">finalizadas / iniciadas</span></div>' +
        '<div class="tarjeta tile"><span class="etq">' + U.icon('check', 'sm') + 'Equipos revisados hoy</span><span class="valor">' + maqRev + '<small> / ' + maqTot + '</small></span><span class="det">en rutinas de hoy</span></div>' +
        '<div class="tarjeta tile ' + (alertasHoy ? 'alerta' : '') + '"><span class="etq">' + U.icon('alerta', 'sm') + 'Alertas de hoy</span><span class="valor">' + alertasHoy + '</span><span class="det">fuera de rango o anomalías</span></div>' +
        '<div class="tarjeta tile"><span class="etq">' + U.icon('reloj', 'sm') + 'Turno actual</span><span class="valor" style="font-size:22px">' + e(t ? t.nombre : '—') + '</span><span class="det">' + (t ? e(t.inicio + ' a ' + t.fin) : '') + '</span></div>';

      U.$('#formatos', main).innerHTML = tarjetasFormatos(registros);

      const alertas = [];
      for (const r of registros) for (const a of M.resumen(r).alertas) alertas.push({ r, a });
      U.$('#alertas', main).innerHTML = alertas.length
        ? '<ul class="lista-simple">' + alertas.slice(0, 8).map(({ r, a }) =>
          '<li><a href="#/ver/' + encodeURIComponent(r.id) + '"><span class="punto bad"></span><span class="principal"><b>' + e(a.fila.nombre) + ' · ' + e(M.textoAlerta(a)) + '</b>' +
          '<span>' + e(U.fechaMedia(r.fecha)) + ' · ' + e(M.nombreTurno(r.turno)) + ' · ' + e(r.encabezado.inspector || '') + '</span></span>' + U.icon('der', 'sm') + '</a></li>').join('') + '</ul>' +
          (alertas.length > 8 ? '<div style="padding:10px 18px;border-top:1px solid var(--border)"><a class="btn btn-texto btn-chico" href="#/registros?alertas=1">Ver las ' + alertas.length + ' alertas</a></div>' : '')
        : '<div class="vacio">' + U.icon('check') + '<p>Sin alertas en los últimos 7 días</p></div>';

      U.$('#ultimos', main).innerHTML = registros.length
        ? '<ul class="lista-simple">' + registros.slice(0, 6).map((r) => {
          const f = M.formato(r.formatoId);
          const res = M.resumen(r, f);
          return '<li><a href="#/ver/' + encodeURIComponent(r.id) + '"><span class="punto ' + (res.alertas.length ? 'bad' : r.estado === 'completo' ? 'ok' : 'azul') + '"></span>' +
            '<span class="principal"><b>' + e(f ? M.tituloCorto(f) : r.formatoId) + '</b><span>' + e(U.fechaMedia(r.fecha)) + ' · ' + e(M.nombreTurno(r.turno)) + ' · ' + e(r.encabezado.inspector || '') + '</span></span>' +
            V.badgeEstado(r) + '</a></li>';
        }).join('') + '</ul>'
        : '<div class="vacio">' + U.icon('captura') + '<p>Aún no hay registros esta semana</p></div>';
    };
    pintar();
    main.addEventListener('click', (ev) => accionesFormato(ev, registros));
    const quitar = DB.suscribirRegistros(rango, (l) => { registros = l; pintar(); });
    return () => quitar();
  };

  Vistas.elegirFormato = async (main) => {
    main.innerHTML =
      '<div class="vista-cab"><div class="titulos"><h1>Capturar rutina</h1><p>Elige el formato que vas a llenar. La fecha, el turno y tu nombre se llenan solos.</p></div></div>' +
      '<div id="formatos"></div>';
    let registros = [];
    const pintar = () => { U.$('#formatos', main).innerHTML = tarjetasFormatos(registros); };
    pintar();
    main.addEventListener('click', (ev) => accionesFormato(ev, registros));
    const quitar = DB.suscribirRegistros({ desde: U.sumarDias(U.hoyISO(), -6), hasta: U.hoyISO() }, (l) => { registros = l; pintar(); });
    return () => quitar();
  };

  Vistas._tarjetasFormatos = tarjetasFormatos;
})();
