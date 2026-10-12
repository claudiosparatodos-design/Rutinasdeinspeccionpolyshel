/* Ver un registro con el diseño de la hoja, alertas, fotos e historial. */
(function () {
  'use strict';

  const e = U.esc;

  Vistas.visor = async (main, params) => {
    const reg = await DB.obtenerRegistro(params.id);
    if (!reg) {
      main.innerHTML = '<div class="tarjeta vacio">' + U.icon('buscar') + '<p><b>No se encontró el registro.</b></p><p class="t-sm">Pudo haber sido eliminado.</p><p style="margin-top:12px"><a class="btn btn-secundario" href="#/registros">Ir a registros</a></p></div>';
      return;
    }
    const f = M.formato(reg.formatoId);
    if (!f) throw new Error('El formato de este registro ya no existe');
    const res = M.resumen(reg, f);

    main.innerHTML =
      '<div class="migas"><a href="#/registros">Registros</a>' + U.icon('der', 'sm') + '<span>' + e(U.fechaCorta(reg.fecha)) + '</span></div>' +
      '<div class="vista-cab"><div class="titulos"><h1>' + e(f.titulo) + '</h1>' +
        '<p>' + e(U.fechaLarga(reg.fecha)) + ' · ' + e(M.nombreTurno(reg.turno)) + ' · ' + e(reg.encabezado.inspector || reg.creadoPor || '') + '</p>' +
        '<div class="fila-flex" style="margin-top:10px">' + V.badgeEstado(reg) + V.badgeAlertas(res.alertas.length) + V.badgeSync(reg) +
          '<span class="badge">' + res.completas + ' de ' + res.total + ' revisados</span></div></div>' +
        '<div class="grupo-btns">' +
          '<a class="btn btn-secundario" href="#/editar/' + encodeURIComponent(reg.id) + '">' + U.icon('editar') + '<span>' + (reg.estado === 'completo' ? 'Editar' : 'Continuar captura') + '</span></a>' +
          '<button class="btn btn-secundario" data-a="excel">' + U.icon('excel') + '<span>Excel</span></button>' +
          '<button class="btn btn-primario" data-a="imprimir">' + U.icon('imprimir') + '<span>Imprimir</span></button>' +
          '<button class="btn-icono" data-a="borrar" title="Eliminar registro" aria-label="Eliminar registro">' + U.icon('basura') + '</button>' +
        '</div></div>' +
      (res.alertas.length
        ? '<div class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-cab"><h2>' + U.icon('alerta', 'sm') + ' Alertas (' + res.alertas.length + ')</h2></div>' +
          '<ul class="lista-simple">' + res.alertas.map((a) => '<li><div class="li"><span class="punto bad"></span><span class="principal"><b>' + e(a.fila.nombre) + '</b><span>' + e(M.textoAlerta(a)) + '</span></span></div></li>').join('') + '</ul></div>'
        : '') +
      '<div class="visor-hoja" id="visor-hoja"></div>' +
      '<div class="tarjeta" style="margin-top:16px" id="fotos" hidden><div class="tarjeta-cab"><h2>Fotos de evidencia</h2></div><div class="tarjeta-cuerpo"><div class="fotos-grid" id="fotos-grid"></div></div></div>' +
      '<div class="tarjeta" style="margin-top:16px"><div class="tarjeta-cab"><h2>Historial del registro</h2></div>' +
        '<ul class="lista-simple">' + (reg.historial || []).slice().reverse().map((h) =>
          '<li><div class="li">' + U.icon('historial', 'sm') + '<span class="principal"><b>' + e(h.accion) + '</b><span>' + e(h.por || '—') + ' · ' + e(U.fechaHora(h.en)) + '</span></span></div></li>').join('') + '</ul></div>';

    const visor = U.$('#visor-hoja', main);
    visor.appendChild(V.pagina(f, reg));
    const escalar = () => V.escalar(visor, 'ajustar');
    requestAnimationFrame(escalar);
    const onResize = U.debounce(escalar, 150);
    window.addEventListener('resize', onResize);

    let fotos = [];
    DB.fotosDe(reg.id).then((l) => {
      fotos = l;
      if (!l.length) return;
      U.$('#fotos', main).hidden = false;
      U.$('#fotos-grid', main).innerHTML = l.map((x) => {
        const fila = (reg.filas || []).find((y) => y.id === x.filaId);
        return '<figure><img src="' + U.srcImagen(x.data) + '" alt="" data-foto="' + e(x.id) + '"><figcaption>' + e(fila ? fila.nombre : '') + ' · ' + e(U.fechaHora(x.creadoEn)) + '</figcaption></figure>';
      }).join('');
    }).catch(() => {});

    main.addEventListener('click', async (ev) => {
      const img = ev.target.closest('[data-foto]');
      if (img) { const x = fotos.find((y) => y.id === img.dataset.foto); if (x) V.verFoto(x.data); return; }
      const b = ev.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'imprimir') V.vistaPrevia({ registros: [reg] });
      else if (b.dataset.a === 'excel') V.exportarExcel([reg]);
      else if (b.dataset.a === 'borrar') {
        const ok = await U.confirmar('Eliminar registro',
          'Se eliminará permanentemente la rutina del <b>' + e(U.fechaCorta(reg.fecha)) + '</b> (' + e(M.nombreTurno(reg.turno)) + ') con sus fotos. Esta acción no se puede deshacer.', 'Eliminar', true);
        if (!ok) return;
        await DB.eliminarRegistro(reg.id);
        U.toast('Registro eliminado');
        App.ir('/registros', true);
      }
    });

    return () => window.removeEventListener('resize', onResize);
  };
})();
