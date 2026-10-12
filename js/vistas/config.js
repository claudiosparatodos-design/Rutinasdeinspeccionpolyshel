/* Configuración: turnos, inspectores, equipos y límites, seguridad y respaldos. */
(function () {
  'use strict';

  const e = U.esc;

  Vistas.config = async (main, params) => {
    let seccion = (params.consulta && params.consulta.get('s')) || U.lsGet('ps_conf_seccion', 'general');
    const secciones = [
      ['general', 'ajustes', 'General'],
      ['equipos', 'captura', 'Equipos y límites'],
      ['seguridad', 'candado', 'Seguridad'],
      ['datos', 'base', 'Datos y respaldo'],
      ['instalar', 'tableta', 'Instalar en tableta']
    ];
    main.innerHTML =
      '<div class="vista-cab"><div class="titulos"><h1>Configuración</h1><p>Los cambios se comparten con todas las tabletas' + (DB.modo === 'nube' ? ' a través de la nube' : '') + '.</p></div></div>' +
      '<div class="conf-grid"><nav class="tarjeta conf-menu">' + secciones.map(([id, ic, t]) => '<a class="nav-item" href="#" data-sec="' + id + '">' + U.icon(ic) + '<span>' + t + '</span></a>').join('') + '</nav>' +
      '<div id="conf-cont"></div></div>';
    const cont = U.$('#conf-cont', main);

    const guardarConfig = () => {
      DB.guardarConfig(M.config);
      U.toast('Configuración guardada');
    };

    /* ---------------- General ---------------- */
    function general() {
      cont.innerHTML =
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Turnos</h2></div><div class="tarjeta-cuerpo">' +
          '<p class="t-sm muted" style="margin-bottom:12px">Con estos horarios la app elige sola el turno al empezar una rutina.</p>' +
          '<div class="lista-edit" id="turnos">' + M.config.turnos.map((t, i) =>
            '<div class="item rejilla" style="grid-template-columns:2fr 1fr 1fr;width:100%">' +
              '<div class="campo"><label>Nombre</label><input class="input" data-t="' + i + '" data-k="nombre" value="' + e(t.nombre) + '"></div>' +
              '<div class="campo"><label>Inicia</label><input class="input" type="time" data-t="' + i + '" data-k="inicio" value="' + e(t.inicio) + '"></div>' +
              '<div class="campo"><label>Termina</label><input class="input" type="time" data-t="' + i + '" data-k="fin" value="' + e(t.fin) + '"></div></div>').join('') + '</div>' +
          '<div class="grupo-btns" style="margin-top:14px"><button class="btn btn-primario" data-g="turnos">' + U.icon('guardar') + '<span>Guardar turnos</span></button></div>' +
        '</div></div>' +
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Inspectores</h2></div><div class="tarjeta-cuerpo">' +
          '<p class="t-sm muted" style="margin-bottom:12px">Aparecen como opciones rápidas al elegir quién inspecciona.</p>' +
          '<div class="chips" id="insp">' + ((M.config.inspectores || []).length ? M.config.inspectores.slice().sort().map((n) =>
            '<span class="chip" style="cursor:default">' + U.icon('usuario', 'sm') + e(n) + '<button class="btn-icono chico" style="width:28px;height:28px" data-quitar-insp="' + e(n) + '" aria-label="Quitar ' + e(n) + '">' + U.icon('x', 'sm') + '</button></span>').join('') : '<span class="muted t-sm">Aún no hay inspectores registrados.</span>') + '</div>' +
          '<div class="fila-flex" style="margin-top:14px"><input class="input" id="nuevo-insp" placeholder="Nombre del inspector" style="max-width:320px"><button class="btn btn-secundario" data-g="insp">' + U.icon('mas') + '<span>Agregar</span></button></div>' +
        '</div></div>' +
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Reglas de captura</h2></div><div class="tarjeta-cuerpo">' +
          '<label class="switch"><input type="checkbox" id="firma-obl"' + (M.config.firmaObligatoria ? ' checked' : '') + '><span class="pista"></span><span><b>Firmas obligatorias</b><br><span class="t-sm muted">No se puede finalizar una rutina sin todas las firmas del formato.</span></span></label>' +
        '</div></div>';
    }

    /* ---------------- Equipos y límites ---------------- */
    let fSel = M.formatos()[0] && M.formatos()[0].id;
    let borradorFilas = null;
    function equipos() {
      const f = M.formato(fSel);
      const ov = M.config.formatos && M.config.formatos[f.id];
      if (!borradorFilas) borradorFilas = U.clone(ov && ov.filas && ov.filas.length ? ov.filas : f.tabla.filas);
      const nums = M.colsNumericas(f);
      const todas = f.tabla.columnas.filter((c) => c.tipo !== 'texto' && c.tipo !== 'hora');
      cont.innerHTML =
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Equipos y límites</h2><span class="espacio"></span>' +
          '<select class="select" id="conf-formato" style="max-width:360px">' + V.opcionesFormatos(fSel, false) + '</select></div>' +
        '<div class="tarjeta-cuerpo">' +
          '<p class="t-sm muted" style="margin-bottom:14px">Agrega, quita, renombra u ordena los equipos de este formato y ajusta los rangos de cada medición. Los registros ya capturados no cambian.' + (ov ? ' <b>Este formato tiene cambios respecto al original.</b>' : '') + '</p>' +
          '<div id="maqs">' + borradorFilas.map((x, i) => {
            const abierto = x._abierto;
            return '<div class="maq-edit"><div class="maq-edit-cab">' +
              '<div class="orden-btns"><button class="btn-icono" data-sube="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('arriba', 'sm') + '</button><button class="btn-icono" data-baja="' + i + '" aria-label="Bajar"' + (i === borradorFilas.length - 1 ? ' disabled' : '') + '>' + U.icon('abajo', 'sm') + '</button></div>' +
              '<input class="input" data-i="' + i + '" data-k="nombre" value="' + e(x.nombre) + '" aria-label="Nombre del equipo">' +
              '<input class="input" data-i="' + i + '" data-k="codigo" value="' + e(x.codigo || '') + '" placeholder="Código" aria-label="Código">' +
              '<label class="switch" title="Activo"><input type="checkbox" data-activo="' + i + '"' + (x.activo !== false ? ' checked' : '') + '><span class="pista"></span><span class="t-sm">Activo</span></label>' +
              '<div class="fila-flex" style="gap:4px"><button class="btn btn-texto btn-chico" data-abrir="' + i + '">' + U.icon(abierto ? 'arriba' : 'abajo', 'sm') + 'Rangos</button>' +
              '<button class="btn-icono" data-borrar="' + i + '" aria-label="Quitar equipo">' + U.icon('basura', 'sm') + '</button></div></div>' +
              (abierto ? '<div class="maq-edit-lim">' +
                nums.map((c) => {
                  const l = x.limites && x.limites[c.id];
                  const om = x.omitir && x.omitir.includes(c.id);
                  return '<div class="lim-campo"><span><b>' + e(c.label) + '</b>' + (c.unidad ? ' <span class="muted">' + e(c.unidad) + '</span>' : '') + '</span>' +
                    '<input class="input" inputmode="decimal" data-lim="' + i + '" data-c="' + e(c.id) + '" data-p="0" placeholder="' + e(c.min != null ? c.min : 'mín') + '" value="' + e(l && l[0] != null ? l[0] : '') + '"' + (om ? ' disabled' : '') + ' aria-label="Mínimo">' +
                    '<input class="input" inputmode="decimal" data-lim="' + i + '" data-c="' + e(c.id) + '" data-p="1" placeholder="' + e(c.max != null ? c.max : 'máx') + '" value="' + e(l && l[1] != null ? l[1] : '') + '"' + (om ? ' disabled' : '') + ' aria-label="Máximo"></div>';
                }).join('') +
                '<div style="grid-column:1/-1"><div class="etq" style="margin:6px 0 8px">No aplica para este equipo (celda sombreada)</div><div class="chips">' +
                  todas.map((c) => '<button class="chip" data-omit="' + i + '" data-c="' + e(c.id) + '" aria-pressed="' + !!(x.omitir && x.omitir.includes(c.id)) + '">' + e(c.label) + '</button>').join('') + '</div>' +
                '<p class="t-xs muted" style="margin-top:8px">Deja un rango vacío para usar el general del formato (el que aparece en gris).</p></div></div>' : '') +
            '</div>';
          }).join('') + '</div>' +
          '<div class="grupo-btns" style="margin-top:14px">' +
            '<button class="btn btn-secundario" data-g="agregarMaq">' + U.icon('mas') + '<span>Agregar equipo</span></button>' +
            '<span class="espacio"></span>' +
            (ov ? '<button class="btn btn-texto" data-g="restaurar">' + U.icon('historial', 'sm') + 'Restaurar original</button>' : '') +
            '<button class="btn btn-primario" data-g="equipos">' + U.icon('guardar') + '<span>Guardar cambios</span></button>' +
          '</div>' +
        '</div></div>';
    }

    /* ---------------- Seguridad ---------------- */
    function seguridad() {
      cont.innerHTML =
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Cambiar contraseña de acceso</h2></div><div class="tarjeta-cuerpo">' +
          '<p class="t-sm muted" style="margin-bottom:14px">' + (DB.modo === 'nube'
            ? 'La contraseña es la misma para todas las tabletas. Al cambiarla, las demás seguirán dentro hasta que cierren sesión; después deberán usar la nueva.'
            : 'En modo local, la contraseña solo cambia en este dispositivo.') + '</p>' +
          '<form id="form-pass" class="rejilla" style="max-width:640px">' +
            '<div class="campo"><label for="p-actual">Contraseña actual</label><input class="input" type="password" id="p-actual" autocomplete="current-password" required></div>' +
            '<div class="campo"><label for="p-nueva">Nueva contraseña</label><input class="input" type="password" id="p-nueva" autocomplete="new-password" minlength="6" required></div>' +
            '<div class="campo"><label for="p-conf">Confirmar nueva</label><input class="input" type="password" id="p-conf" autocomplete="new-password" minlength="6" required></div>' +
            '<div style="grid-column:1/-1"><button class="btn btn-primario" type="submit">' + U.icon('candado') + '<span>Cambiar contraseña</span></button></div>' +
          '</form></div></div>' +
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Sesión</h2></div><div class="tarjeta-cuerpo">' +
          '<p class="t-sm muted" style="margin-bottom:14px">La sesión se mantiene abierta en esta tableta para no escribir la contraseña cada vez.</p>' +
          '<button class="btn btn-secundario" data-g="salir">' + U.icon('salir') + '<span>Cerrar sesión en este dispositivo</span></button></div></div>';
    }

    /* ---------------- Datos ---------------- */
    function datos() {
      cont.innerHTML =
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Dónde se guardan los datos</h2></div><div class="tarjeta-cuerpo">' +
          (DB.modo === 'nube'
            ? '<div class="aviso info" style="margin:0">' + U.icon('nubeOk') + '<div><b>Nube conectada (Firebase)</b>Cada registro se guarda en la nube y también en la tableta. Si se va el internet, se sigue capturando y todo se sube solo al volver la señal.</div></div>'
            : '<div class="aviso" style="margin:0">' + U.icon('tableta') + '<div><b>Modo local</b>Los registros solo están en este dispositivo. Para guardarlos en la nube y compartirlos entre tabletas, conecta Firebase siguiendo README.md. Mientras tanto, descarga respaldos con frecuencia.</div></div>') +
          '<p class="t-sm" style="margin-top:14px" id="conteo">Contando registros…</p>' +
        '</div></div>' +
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Respaldo</h2></div><div class="tarjeta-cuerpo">' +
          '<p class="t-sm muted" style="margin-bottom:14px">Descarga un archivo con todos los registros, fotos y configuración. Sirve como copia de seguridad o para pasar datos de un dispositivo a otro.</p>' +
          '<div class="grupo-btns"><button class="btn btn-primario" data-g="respaldo">' + U.icon('descargar') + '<span>Descargar respaldo</span></button>' +
          '<label class="btn btn-secundario">' + U.icon('subir') + '<span>Restaurar respaldo</span><input type="file" accept=".json,application/json" id="restaurar" hidden></label></div>' +
        '</div></div>';
      DB.todosLosRegistros().then((l) => {
        const c = U.$('#conteo', cont);
        if (!c) return;
        const fin = l.filter((r) => r.estado === 'completo').length;
        c.innerHTML = '<b>' + l.length + '</b> registros guardados (' + fin + ' finalizados, ' + (l.length - fin) + ' en proceso)' +
          (l.length ? ' · desde el ' + e(U.fechaCorta(l[l.length - 1].fecha)) : '') + '.';
      }).catch(() => {});
    }

    /* ---------------- Instalar ---------------- */
    function instalar() {
      cont.innerHTML =
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Instalar como aplicación</h2></div><div class="tarjeta-cuerpo">' +
          '<p style="margin-bottom:14px">Instalada, la página abre a pantalla completa desde un ícono en la tableta y funciona aunque no haya internet.</p>' +
          (App.instalar ? '<button class="btn btn-primario btn-grande" data-g="instalar">' + U.icon('descargar') + '<span>Instalar ahora</span></button>' : '') +
          '<div class="rejilla" style="margin-top:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">' +
            '<div class="tarjeta tarjeta-cuerpo"><h3 style="margin-bottom:8px">iPad / iPhone (Safari)</h3><ol class="t-sm" style="margin:0;padding-left:18px;line-height:1.7"><li>Abre la página en Safari.</li><li>Toca el botón <b>Compartir</b> (cuadro con flecha).</li><li>Elige <b>Agregar a pantalla de inicio</b>.</li></ol></div>' +
            '<div class="tarjeta tarjeta-cuerpo"><h3 style="margin-bottom:8px">Android (Chrome)</h3><ol class="t-sm" style="margin:0;padding-left:18px;line-height:1.7"><li>Abre la página en Chrome.</li><li>Toca el menú <b>⋮</b>.</li><li>Elige <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.</li></ol></div>' +
          '</div></div></div>' +
        '<div class="tarjeta conf-seccion"><div class="tarjeta-cab"><h2>Formatos disponibles</h2></div><ul class="lista-simple">' +
          M.formatos().map((f) => '<li><div class="li">' + U.icon('hoja') + '<span class="principal"><b>' + e(f.titulo) + '</b><span>' + e(f.codigo) + ' · Rev. ' + e(f.revision) + ' · Vigencia ' + e(f.vigencia || '—') + (f.ejemplo ? ' · Ejemplo' : '') + '</span></span></div></li>').join('') +
        '</ul></div>';
    }

    const pintar = () => {
      U.$$('[data-sec]', main).forEach((a) => (a.dataset.sec === seccion ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      ({ general, equipos, seguridad, datos, instalar }[seccion] || general)();
    };

    /* ---------------- Eventos ---------------- */
    main.addEventListener('click', async (ev) => {
      const t = ev.target.closest('a, button');
      if (!t) return;
      if (t.dataset.sec) { ev.preventDefault(); seccion = t.dataset.sec; U.lsSet('ps_conf_seccion', seccion); pintar(); return; }
      if (t.dataset.quitarInsp) { M.config.inspectores = M.config.inspectores.filter((n) => n !== t.dataset.quitarInsp); guardarConfig(); general(); return; }
      // Equipos
      if (t.dataset.sube != null) { const i = +t.dataset.sube; [borradorFilas[i - 1], borradorFilas[i]] = [borradorFilas[i], borradorFilas[i - 1]]; equipos(); return; }
      if (t.dataset.baja != null) { const i = +t.dataset.baja; [borradorFilas[i + 1], borradorFilas[i]] = [borradorFilas[i], borradorFilas[i + 1]]; equipos(); return; }
      if (t.dataset.abrir != null) { const x = borradorFilas[+t.dataset.abrir]; x._abierto = !x._abierto; equipos(); return; }
      if (t.dataset.borrar != null) {
        const x = borradorFilas[+t.dataset.borrar];
        if (!(await U.confirmar('Quitar equipo', '¿Quitar <b>' + e(x.nombre) + '</b> del formato? Los registros anteriores lo conservan. Si solo dejará de usarse un tiempo, mejor desactívalo.', 'Quitar', true))) return;
        borradorFilas.splice(+t.dataset.borrar, 1); equipos(); return;
      }
      if (t.dataset.omit != null) {
        const x = borradorFilas[+t.dataset.omit];
        x.omitir = x.omitir || [];
        if (x.omitir.includes(t.dataset.c)) x.omitir = x.omitir.filter((c) => c !== t.dataset.c); else x.omitir.push(t.dataset.c);
        equipos(); return;
      }
      const g = t.dataset.g;
      if (!g) return;
      if (g === 'turnos') {
        U.$$('[data-t]', cont).forEach((inp) => { M.config.turnos[+inp.dataset.t][inp.dataset.k] = inp.value; });
        guardarConfig();
      } else if (g === 'insp') {
        const inp = U.$('#nuevo-insp', cont);
        const n = inp.value.trim().replace(/\s+/g, ' ');
        if (!n) return inp.focus();
        if (!M.config.inspectores.includes(n)) M.config.inspectores = M.config.inspectores.concat(n);
        guardarConfig(); general();
      } else if (g === 'agregarMaq') {
        borradorFilas.push({ id: 'eq-' + U.uid(), nombre: 'Nuevo equipo', codigo: '', _abierto: true });
        equipos();
        const ins = U.$$('[data-k="nombre"]', cont); const ult = ins[ins.length - 1]; if (ult) { ult.focus(); ult.select(); }
      } else if (g === 'equipos') {
        const limpias = borradorFilas.map((x) => {
          const y = Object.assign({}, x); delete y._abierto;
          if (y.limites) { for (const k of Object.keys(y.limites)) { const l = y.limites[k]; if (l[0] == null && l[1] == null) delete y.limites[k]; } if (!Object.keys(y.limites).length) delete y.limites; }
          if (y.omitir && !y.omitir.length) delete y.omitir;
          return y;
        });
        if (limpias.some((x) => !x.nombre.trim())) { U.toast('Todos los equipos necesitan nombre', 'error'); return; }
        M.config.formatos = Object.assign({}, M.config.formatos, { [fSel]: { filas: limpias } });
        guardarConfig();
        borradorFilas = null; equipos();
      } else if (g === 'restaurar') {
        if (!(await U.confirmar('Restaurar original', 'Se descartarán los cambios de equipos y rangos de este formato.', 'Restaurar', true))) return;
        const fs = Object.assign({}, M.config.formatos); delete fs[fSel]; M.config.formatos = fs;
        guardarConfig(); borradorFilas = null; equipos();
      } else if (g === 'salir') App.salir();
      else if (g === 'instalar' && App.instalar) { App.instalar.prompt(); App.instalar = null; }
      else if (g === 'respaldo') {
        t.disabled = true;
        try {
          const [registros, fotos] = await Promise.all([DB.todosLosRegistros(), DB.todasLasFotos()]);
          registros.forEach((r) => { delete r._pendiente; delete r._txt; });
          const datosResp = { app: 'rutinas-inspeccion', version: 1, generado: new Date().toISOString(), config: M.config, registros, fotos };
          U.descargar(new Blob([JSON.stringify(datosResp)], { type: 'application/json' }), 'respaldo_rutinas_' + U.hoyISO() + '.json');
          U.toast('Respaldo descargado (' + registros.length + ' registros)');
        } catch (err) { U.toast('No se pudo generar el respaldo', 'error'); }
        t.disabled = false;
      }
    });
    main.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.i != null && t.dataset.k) borradorFilas[+t.dataset.i][t.dataset.k] = t.value;
      if (t.dataset.lim != null) {
        const x = borradorFilas[+t.dataset.lim];
        x.limites = x.limites || {};
        const l = x.limites[t.dataset.c] || [null, null];
        l[+t.dataset.p] = U.aNumero(t.value);
        x.limites[t.dataset.c] = l;
      }
    });
    main.addEventListener('change', async (ev) => {
      const t = ev.target;
      if (t.id === 'firma-obl') { M.config.firmaObligatoria = t.checked; guardarConfig(); }
      else if (t.id === 'conf-formato') { fSel = t.value; borradorFilas = null; equipos(); }
      else if (t.dataset.activo != null) borradorFilas[+t.dataset.activo].activo = t.checked;
      else if (t.id === 'restaurar') {
        const a = t.files && t.files[0];
        t.value = '';
        if (!a) return;
        try {
          const d = JSON.parse(await a.text());
          if (!d || !Array.isArray(d.registros)) throw new Error('El archivo no es un respaldo válido');
          if (!(await U.confirmar('Restaurar respaldo', 'Se agregarán o actualizarán <b>' + d.registros.length + '</b> registros' + (d.fotos ? ' y ' + d.fotos.length + ' fotos' : '') + '. Los registros con el mismo folio se reemplazan.', 'Restaurar'))) return;
          const n = await DB.importar(d);
          if (d.config) App.aplicarConfig(d.config);
          U.toast('Respaldo restaurado: ' + n + ' registros');
          datos();
        } catch (err) { U.toast(err.message || 'No se pudo leer el archivo', 'error'); }
      }
    });
    main.addEventListener('submit', async (ev) => {
      if (ev.target.id !== 'form-pass') return;
      ev.preventDefault();
      const a = U.$('#p-actual', cont).value, n = U.$('#p-nueva', cont).value, c = U.$('#p-conf', cont).value;
      if (n !== c) { U.toast('La confirmación no coincide', 'error'); return; }
      try {
        await DB.cambiarPassword(a, n);
        U.toast('Contraseña actualizada');
        ev.target.reset();
      } catch (err) { U.toast(err.message || 'No se pudo cambiar la contraseña', 'error'); }
    });

    pintar();
  };
})();
