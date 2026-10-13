/* ==========================================================================
   Captura en tableta.
     - "Captura": una tarjeta por sección (equipo / área), ideal para ir
       caminando de equipo en equipo.
     - "Ver formato": la hoja del Excel original con lo capturado, en vivo.
   Todo se guarda solo (borrador) mientras se captura.
   ========================================================================== */
(function () {
  'use strict';

  const e = U.esc;

  Vistas.captura = async (main, params) => {
    const inspector = await App.requerirInspector();
    let reg, f;
    if (params.nuevo) {
      f = M.formato(params.nuevo);
      if (!f) throw new Error('El formato no existe');
      const extra = {};
      const tipo = params.consulta && params.consulta.get('tipo');
      if (tipo && f.tipos && f.tipos.some((t) => t.id === tipo)) extra.tipo = tipo;
      reg = M.nuevoRegistro(f, inspector, extra);
    } else {
      reg = await DB.obtenerRegistro(params.id);
      if (!reg) throw new Error('No se encontró el registro');
      delete reg._pendiente;
      f = M.formato(reg.formatoId);
      if (!f) throw new Error('El formato de este registro ya no existe');
    }
    reg.valores = reg.valores || {};
    reg.firmas = reg.firmas || {};
    reg.encabezado = reg.encabezado || {};
    const esNuevo = !!params.nuevo;
    let guardadoUnaVez = !esNuevo;
    const eraCompleto = reg.estado === 'completo';
    const secciones = () => M.secciones(f, reg);

    let modo = 'captura';

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
    let sucio = false;
    let edicionAnotada = false;
    const guardar = (accion) => {
      sucio = false;
      reg.modificadoPor = App.inspector || inspector;
      reg.modificadoEn = Date.now();
      const r = M.resumen(reg, f);
      reg.resumen = { pct: r.pct, alertas: r.alertas.length, fuera: r.fuera, anomalias: r.anomalias };
      if (accion) reg.historial = (reg.historial || []).concat({ accion, por: reg.modificadoPor, en: Date.now() }).slice(-30);
      estadoGuardado = 'guardando';
      pintarGuardado();
      const p = DB.guardarRegistro(reg);
      if (!guardadoUnaVez) {
        guardadoUnaVez = true;
        history.replaceState(null, '', '#/editar/' + encodeURIComponent(reg.id));
      }
      p.local.then(() => {
        if (estadoGuardado === 'guardando' && DB.modo === 'nube' && !navigator.onLine) { estadoGuardado = 'tableta'; pintarGuardado(); }
      });
      p.nube.then(() => { estadoGuardado = 'ok'; pintarGuardado(); }).catch((err) => {
        console.error(err); estadoGuardado = 'tableta'; pintarGuardado();
        U.toast('No se pudo subir a la nube: ' + (err.message || err), 'error');
      });
      setTimeout(() => { if (estadoGuardado === 'guardando') { estadoGuardado = 'tableta'; pintarGuardado(); } }, 2500);
      return p;
    };
    const autoguardar = U.debounce(() => {
      let accion = null;
      if (eraCompleto && !edicionAnotada) { edicionAnotada = true; accion = 'Editado'; }
      guardar(accion);
    }, 900);
    const cambio = () => { sucio = true; autoguardar(); pintarProgreso(); if (modo === 'formato') pintarFormatoDebounce(); };

    /* ---------------- Estructura ---------------- */
    const opcTurnos = (M.config.turnos || []).map((t) => '<option value="' + e(t.id) + '"' + (String(reg.turno) === t.id ? ' selected' : '') + '>' + e(t.nombre) + '</option>').join('');
    const etiquetaPersona = f.id === 'paro-arranque' ? 'Nombre del técnico' : 'Inspector';
    main.innerHTML =
      // Encabezado compacto: una sola línea; al tocarlo se abren los datos generales
      '<div class="tarjeta cap-mini">' +
        '<div class="cap-mini-fila">' +
          '<button class="cap-mini-btn" data-a="cabecera" aria-expanded="false" aria-controls="cap-detalle">' +
            '<span class="cap-mini-t"><b id="cap-titulo"></b><span id="cap-resumen"></span></span>' +
            '<span class="cap-mini-prog"><span class="avance" id="prog-barra"><span></span></span><span class="num" id="prog-pct"></span></span>' +
            '<span id="alertas-mini"></span>' +
            '<span class="cap-mini-flecha">' + U.icon('abajo', 'sm') + '</span>' +
          '</button>' +
          '<span class="guardado" id="guardado"></span>' +
          '<div class="segmentado" role="group" aria-label="Modo">' +
            '<button data-modo="captura">' + U.icon('tarjeta', 'sm') + '<span class="solo-ancho">Captura</span></button>' +
            '<button data-modo="formato">' + U.icon('hoja', 'sm') + '<span class="solo-ancho">Ver formato</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="cap-detalle" id="cap-detalle" hidden>' +
          '<div class="codigo">' + U.icon('hoja', 'sm') + ' ' + e(f.archivo) + '</div>' +
          (f.tipos ? '<div class="segmentado" role="group" aria-label="Tipo" style="margin-top:10px">' + f.tipos.map((t) => '<button data-tipo="' + e(t.id) + '">' + e(t.nombre) + '</button>').join('') + '</div>' : '') +
          '<div class="cap-datos">' +
            '<div class="campo"><label for="c-fecha">Fecha</label><input class="input" type="date" id="c-fecha" value="' + e(reg.fecha) + '"></div>' +
            (M.usaTurno(f) ? '<div class="campo"><label for="c-turno">Turno</label><select class="select" id="c-turno">' + opcTurnos + '</select></div>' : '') +
            '<div class="campo ancho2"><label for="c-insp">' + etiquetaPersona + '</label><input class="input" id="c-insp" list="lista-insp" value="' + e(reg.encabezado.inspector || '') + '"></div>' +
          '</div>' +
          '<div class="t-sm muted" id="prog-txt" style="margin-top:10px"></div>' +
        '</div>' +
        '<datalist id="lista-insp">' + (M.config.inspectores || []).map((n) => '<option value="' + e(n) + '">').join('') + '</datalist>' +
      '</div>' +
      '<div id="zona"></div>' +
      '<div class="tarjeta cierre" id="cierre"' + ((f.firmas || []).length ? '' : ' hidden') + '></div>' +
      '<div class="barra-final">' +
        '<button class="btn btn-secundario" data-a="previa">' + U.icon('ojo') + '<span>Vista previa</span></button>' +
        '<button class="btn btn-secundario" data-a="guardar">' + U.icon('guardar') + '<span>Guardar y salir</span></button>' +
        '<button class="btn btn-ok" data-a="finalizar">' + U.icon('check') + '<span>' + (eraCompleto ? 'Guardar cambios' : 'Finalizar rutina') + '</span></button>' +
      '</div>';
    pintarGuardado();

    const pintarTitulo = () => {
      U.$('#cap-titulo', main).textContent = f.tipos ? 'Rutina de ' + M.nombreTipo(f, reg).toLowerCase() : f.titulo;
      U.$('#cap-resumen', main).textContent = [U.fechaCorta(reg.fecha), M.usaTurno(f) ? M.nombreTurno(reg.turno) : '', reg.encabezado.inspector || ''].filter(Boolean).join(' · ');
      U.$$('[data-tipo]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.tipo === reg.tipo));
    };

    /* ---------------- Progreso ---------------- */
    function pintarProgreso() {
      const r = M.resumen(reg, f);
      U.$('#prog-txt', main).textContent = r.llenos + ' de ' + r.requeridos + ' datos capturados · ' + r.completas + ' de ' + r.total + ' secciones completas';
      U.$('#prog-pct', main).textContent = r.pct + '%';
      U.$('#alertas-mini', main).innerHTML = r.alertas.length ? '<span class="badge badge-bad">' + U.icon('alerta') + r.alertas.length + '</span>' : '';
      const barra = U.$('#prog-barra', main);
      barra.className = 'avance' + (r.pct === 100 ? ' ok' : '');
      barra.firstElementChild.style.width = r.pct + '%';
      secciones().forEach((s, i) => {
        const st = M.estadoSeccion(f, reg, s);
        const cls = st.alertas ? 'bad' : st.completa ? 'ok' : st.tocada ? 'azul' : '';
        const chip = U.$('[data-ir="' + i + '"] .punto', main);
        if (chip) chip.className = 'punto ' + cls;
        const est = U.$('#sec-' + i + ' .cap-sec-estado', main);
        if (est) est.innerHTML = st.alertas ? '<span class="badge badge-bad">' + U.icon('alerta') + st.alertas + '</span>'
          : st.completa ? '<span class="badge badge-ok">' + U.icon('check') + 'Completa</span>'
          : '<span class="badge">' + st.llenos + ' / ' + st.total + '</span>';
      });
    }

    /* ---------------- Campos (un renglón por dato, en el orden del formato) ---------------- */
    function evaluacionHTML(c, v) {
      const ev = M.evaluar(f, c, v);
      if (c.tipo !== 'numero' || ev == null) return '';
      const lim = M.limite(f, c);
      if (ev === 'ok') return lim ? U.icon('check', 'sm') + 'Dentro de rango' : '';
      return U.icon('alerta', 'sm') + (ev === 'alto' ? 'Arriba del máximo (' + lim[1] + ')' : 'Abajo del mínimo (' + lim[0] + ')');
    }

    function campoHTML(c) {
      const v = reg.valores[c.id];
      const id = 'f_' + c.id;
      const lim = M.limite(f, c);
      const ev = M.evaluar(f, c, v);
      const cls = M.esAlerta(ev) ? ' mal' : ev === 'ok' && c.tipo === 'numero' && lim ? ' ok' : '';
      if (c.tipo === 'paloma') {
        return '<button type="button" class="cf-paloma' + (v ? ' hecho' : '') + '" data-paloma="' + e(c.id) + '" aria-pressed="' + !!v + '">' +
          '<span class="paloma-caja">' + (v ? U.icon('check') : '') + '</span><span class="paloma-txt">' + e(c.label) + '</span></button>';
      }
      const extra = [lim ? M.textoLimite(lim, c.unidad) : '', c.ayuda && !lim ? c.ayuda : ''].filter(Boolean).join(' · ');
      const etiqueta = '<label class="cf-lbl" for="' + id + '">' + e(c.label) + (extra ? '<small>' + e(extra) + '</small>' : '') + '</label>';
      let ctrl;
      if (c.tipo === 'numero') {
        ctrl = '<div class="cf-ctrl"><input class="input cf-num" id="' + id + '" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" data-c="' + e(c.id) + '" value="' + e(v == null ? '' : v) + '" placeholder="—">' +
          '<span class="unidad">' + e(c.unidad || '') + '</span></div><div class="ev">' + evaluacionHTML(c, v) + '</div>';
      } else if (c.tipo === 'check') {
        ctrl = '<div class="opciones-btn cf-ctrl" role="group" aria-label="' + e(c.label) + '">' +
          [['ok', '✓ Bien', 'b-ok'], ['mal', '✗ Falla', 'b-mal'], ['na', 'N/A', 'b-na']].map(([val, txt, k]) =>
            '<button type="button" class="' + k + '" data-c="' + e(c.id) + '" data-v="' + val + '" aria-pressed="' + (v === val) + '">' + txt + '</button>').join('') + '</div>';
      } else if (c.tipo === 'opciones') {
        ctrl = '<div class="opciones-btn cf-ctrl" role="group" aria-label="' + e(c.label) + '">' +
          (c.opciones || []).map((o) => '<button type="button" class="' + (c.alerta && c.alerta.includes(o) ? 'b-mal' : 'b-ok') + '" data-c="' + e(c.id) + '" data-v="' + e(o) + '" aria-pressed="' + (v === o) + '">' + e(o) + '</button>').join('') + '</div>';
      } else {
        return '<div class="cf cf-texto">' + etiqueta + '<textarea class="textarea" id="' + id + '" rows="2" data-c="' + e(c.id) + '" placeholder="Escribe aquí cualquier detalle o anomalía">' + e(v || '') + '</textarea></div>';
      }
      return '<div class="cf' + cls + '">' + etiqueta + ctrl + '</div>';
    }

    function matrizHTML(s) {
      const m = s.matriz;
      const porClave = {};
      for (const c of s.campos) if (c.grupo) porClave[c.equipo + '|' + c.grupo] = c;
      return '<div class="matriz-env"><table class="matriz"><thead><tr><th></th>' + m.columnas.map((col) => '<th>' + e(col) + '</th>').join('') + '</tr></thead><tbody>' +
        m.filas.map((fila) => '<tr><th>' + e(fila) + '</th>' + m.columnas.map((col) => {
          const c = porClave[fila + '|' + col];
          if (!c) return '<td></td>';
          const v = reg.valores[c.id];
          return '<td><button type="button" class="matriz-btn' + (v ? ' hecho' : '') + '" data-paloma="' + e(c.id) + '" aria-pressed="' + !!v + '" aria-label="' + e(fila + ': ' + col) + '">' + (v ? U.icon('check') : '') + '</button></td>';
        }).join('') + '</tr>').join('') + '</tbody></table></div>';
    }

    function seccionHTML(s, i) {
      let cuerpo = '';
      if (s.porDia) cuerpo += '<div class="cf-nota">' + U.icon('info', 'sm') + 'Se registra una vez al día (en la hoja ocupa los 3 turnos de la fecha).</div>';
      if (s.matriz) {
        cuerpo += matrizHTML(s) + s.campos.filter((c) => !c.grupo).map(campoHTML).join('');
      } else {
        let grupo = null;
        for (const c of s.campos) {
          if (c.grupo && c.grupo !== grupo) cuerpo += '<div class="cf-grupo">' + e(c.grupo) + '</div>';
          grupo = c.grupo || grupo;
          cuerpo += campoHTML(c);
        }
      }
      const hayChecks = s.campos.some((c) => c.tipo === 'check' || c.tipo === 'paloma');
      return '<section class="tarjeta cap-sec" id="sec-' + i + '">' +
        '<div class="cap-sec-cab"><h2>' + e(s.titulo) + '</h2><span class="cap-sec-estado"></span><span class="espacio"></span>' +
          (hayChecks ? '<button class="btn btn-texto btn-chico" data-todo="' + i + '">' + U.icon('check', 'sm') + '<span>' + (s.campos.some((c) => c.tipo === 'paloma') ? 'Marcar todo' : 'Todo bien') + '</span></button>' : '') +
          '<label class="btn btn-texto btn-chico" style="cursor:pointer">' + U.icon('camara', 'sm') + '<span>Foto</span><input type="file" accept="image/*" capture="environment" data-foto="' + e(s.id) + '" hidden></label>' +
        '</div>' +
        '<div class="cap-sec-cuerpo">' + cuerpo + '<div class="fotos-mini" id="fotos-' + e(s.id) + '"></div></div>' +
      '</section>';
    }

    function pintarModoCaptura() {
      const lista = secciones();
      U.$('#zona', main).innerHTML =
        (lista.length > 1 ? '<nav class="cap-saltos" aria-label="Ir a sección">' + lista.map((s, i) => '<button data-ir="' + i + '"><span class="punto"></span>' + e(s.titulo) + '</button>').join('') + '</nav>' : '') +
        '<div class="cap-lista">' + lista.map(seccionHTML).join('') + '</div>';
      lista.forEach((s) => pintarFotos(s.id));
      pintarProgreso();
    }

    /* ---------------- Ver formato (en vivo) ---------------- */
    function pintarFormato() {
      const zona = U.$('#zona', main);
      let cont = U.$('#vivo', zona);
      if (!cont) {
        zona.innerHTML = '<div class="aviso info">' + U.icon('info') + '<div>Así se verá en la hoja impresa y en el Excel. Solo se muestra este registro; al exportar o imprimir varias fechas, se acomodan juntas como en el papel.</div></div><div class="visor-hoja" id="vivo"></div>';
        cont = U.$('#vivo', zona);
      }
      cont.innerHTML = '';
      let pags = M.paginas([reg]);
      // Sin datos todavía: mostrar el formato en blanco
      if (!pags.length) {
        const hojas = f.hojaPlantilla ? [f.hojaPlantilla] : M.secciones(f, reg).map((x) => x.hoja).filter(Boolean);
        pags = M.paginasBlanco(f).filter((pg) => (f.tipos ? pg.hoja.toLowerCase().includes(reg.tipo) : hojas.includes(pg.hoja)));
      }
      pags.forEach((pg) => cont.appendChild(V.pagina(pg)));
      requestAnimationFrame(() => V.escalar(cont, 'ajustar'));
      pintarProgreso();
    }
    const pintarFormatoDebounce = U.debounce(pintarFormato, 400);

    function pintarZona() {
      U.$$('[data-modo]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === modo));
      if (modo === 'formato') pintarFormato(); else pintarModoCaptura();
    }

    /* ---------------- Firmas ---------------- */
    function pintarCierre() {
      if (!(f.firmas || []).length) return;
      let html = '<div class="tarjeta-cab"><h2>Firmas</h2>' + (M.config.firmaObligatoria ? '<span class="badge badge-warn">Obligatorias para finalizar</span>' : '') + '</div><div class="tarjeta-cuerpo"><div class="firmas-cap">';
      for (const fi of f.firmas) {
        const d = reg.firmas[fi.id] || {};
        html += '<div class="firma-caja"><b>' + e(fi.label) + '</b>' +
          '<div class="lienzo-firma" data-firmar="' + e(fi.id) + '" role="button" tabindex="0" aria-label="Firmar ' + e(fi.label) + '">' +
            (U.srcImagen(d.img) ? '<img src="' + U.srcImagen(d.img) + '" alt="Firma">' : '<span>' + U.icon('firma') + 'Toca para firmar</span>') + '</div>' +
          '<input class="input" data-firma-nombre="' + e(fi.id) + '" placeholder="Nombre" value="' + e(d.nombre || '') + '" list="lista-insp">' +
          (d.img ? '<button class="btn btn-texto btn-chico" data-borrar-firma="' + e(fi.id) + '">' + U.icon('basura', 'sm') + 'Borrar firma</button>' : '') +
        '</div>';
      }
      U.$('#cierre', main).innerHTML = html + '</div></div>';
    }

    // La imagen de la firma lleva el trazo y el nombre debajo, centrados.
    function componerFirma(trazo, nombre) {
      return new Promise((ok) => {
        const W = 600, Hh = 250;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
        const ctx = cv.getContext('2d');
        const fin = () => {
          if (nombre) {
            ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.font = '600 34px Calibri, Carlito, Arial, sans-serif';
            ctx.fillText(nombre, W / 2, Hh - 4, W - 20);
          }
          ok(cv.toDataURL('image/png'));
        };
        if (!trazo) return fin();
        const im = new Image();
        im.onload = () => {
          const esc = Math.min((W - 20) / im.width, (Hh - 50) / im.height, 2.5);
          const w = im.width * esc, h = im.height * esc;
          ctx.drawImage(im, (W - w) / 2, Hh - 44 - h, w, h);
          fin();
        };
        im.onerror = fin;
        im.src = trazo;
      });
    }
    async function actualizarFirma(id) {
      const d = reg.firmas[id] = reg.firmas[id] || {};
      d.img = d.trazo || d.nombre ? await componerFirma(d.trazo, d.nombre) : '';
    }

    async function firmar(id) {
      const fi = f.firmas.find((x) => x.id === id);
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
          ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0a1a3a';
          const pos = (ev) => { const b = canvas.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; };
          canvas.addEventListener('pointerdown', (ev) => { trazo = true; ultimo = pos(ev); canvas.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0a1a3a'; ctx.fill(); hayTinta = true; });
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
      const d = reg.firmas[id] = Object.assign({}, reg.firmas[id], { trazo: r, fecha: Date.now() });
      if (!d.nombre && fi.auto === 'inspector') d.nombre = reg.encabezado.inspector || App.inspector;
      await actualizarFirma(id);
      pintarCierre();
      cambio();
    }
    function recortarFirma(canvas) {
      const ctx = canvas.getContext('2d');
      const { width: w, height: h } = canvas;
      const d = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const m = 8;
      x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
      const cw = x1 - x0, ch = y1 - y0;
      const esc = Math.min(1, 500 / cw, 180 / ch);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(cw * esc)); out.height = Math.max(1, Math.round(ch * esc));
      out.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }

    /* ---------------- Fotos ---------------- */
    let fotos = [];
    if (!esNuevo) DB.fotosDe(reg.id).then((l) => { fotos = l; if (modo === 'captura') secciones().forEach((x) => pintarFotos(x.id)); }).catch(() => {});
    function pintarFotos(secId) {
      const cont = U.$('#fotos-' + CSS.escape(secId), main);
      if (!cont) return;
      cont.innerHTML = fotos.filter((x) => x.filaId === secId).map((x) =>
        '<figure><img src="' + U.srcImagen(x.data) + '" alt="Foto" data-ver-foto="' + e(x.id) + '"><button data-borrar-foto="' + e(x.id) + '" aria-label="Borrar foto">' + U.icon('x') + '</button></figure>').join('');
    }
    async function agregarFoto(secId, archivo) {
      try {
        const data = await U.comprimirImagen(archivo, 1280, 0.7);
        if (!guardadoUnaVez) await guardar('Creado').local;
        const foto = { id: U.uid('foto'), registroId: reg.id, filaId: secId, data, creadoEn: Date.now(), por: App.inspector };
        fotos.push(foto);
        DB.guardarFoto(foto);
        pintarFotos(secId);
        U.toast('Foto agregada');
      } catch (err) { U.toast(err.message, 'error'); }
    }

    /* ---------------- Finalizar ---------------- */
    async function finalizar() {
      autoguardar.cancel();
      const r = M.resumen(reg, f);
      const faltan = r.requeridos - r.llenos;
      const sinFirma = (f.firmas || []).filter((fi) => !(reg.firmas[fi.id] && reg.firmas[fi.id].img));
      if (M.config.firmaObligatoria && sinFirma.length) {
        U.toast('Falta la firma: ' + sinFirma.map((x) => x.label).join(', '), 'error');
        U.$('#cierre', main).scrollIntoView({ behavior: 'smooth' });
        return;
      }
      let msg = '';
      if (faltan > 0) msg += '<div class="aviso">' + U.icon('alerta') + '<div><b>Faltan ' + faltan + ' de ' + r.requeridos + ' datos</b>Secciones incompletas: ' + secciones().filter((s) => !M.estadoSeccion(f, reg, s).completa).map((s) => e(s.titulo)).join(', ') + '</div></div>';
      if (r.alertas.length) msg += '<div class="aviso" style="background:var(--bad-soft)">' + U.icon('alerta') + '<div><b>' + r.alertas.length + ' alerta' + (r.alertas.length === 1 ? '' : 's') + '</b>' + r.alertas.slice(0, 6).map((a) => e(a.seccion.titulo + ' · ' + M.textoAlerta(a))).join('<br>') + (r.alertas.length > 6 ? '<br>…' : '') + '</div></div>';
      if (sinFirma.length) msg += '<p class="t-sm muted">Sin firma: ' + sinFirma.map((x) => e(x.label)).join(', ') + '.</p>';
      if (!msg) msg = '<p class="modal-texto">Todo completo y sin alertas. ¿Finalizar la rutina?</p>';
      const ok = await U.modal({
        titulo: eraCompleto ? 'Guardar cambios' : 'Finalizar rutina', contenido: msg, ancho: 560,
        botones: [{ texto: 'Seguir capturando', clase: 'btn-secundario', valor: false }, { texto: eraCompleto ? 'Guardar' : 'Finalizar', clase: 'btn-ok', valor: true }]
      });
      if (!ok) return;
      for (const fi of f.firmas || []) { const d = reg.firmas[fi.id]; if (d && d.nombre && !d.img) await actualizarFirma(fi.id); }
      reg.estado = 'completo';
      if (!reg.finalizadoEn) reg.finalizadoEn = Date.now();
      reg.encabezado.horaFin = reg.encabezado.horaFin || U.ahoraHM();
      guardar(eraCompleto ? 'Editado' : 'Finalizado');
      U.toast(eraCompleto ? 'Cambios guardados' : 'Rutina finalizada y guardada');
      App.ir('/ver/' + encodeURIComponent(reg.id), true);
    }

    /* ---------------- Eventos ---------------- */
    const campoPorId = (id) => M.campo(f, reg, id);
    const ponerValor = (c, v) => {
      if (v === '' || v == null) delete reg.valores[c.id]; else reg.valores[c.id] = v;
      cambio();
    };

    main.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.id === 'c-insp') {
        reg.encabezado.inspector = t.value;
        pintarTitulo();
        const fi = (f.firmas || []).find((x) => x.auto === 'inspector');
        if (fi && reg.firmas[fi.id] && !reg.firmas[fi.id].trazo) { reg.firmas[fi.id].nombre = t.value; const n = U.$('[data-firma-nombre="' + fi.id + '"]', main); if (n) n.value = t.value; }
        cambio(); return;
      }
      if (t.dataset.firmaNombre) {
        const id = t.dataset.firmaNombre;
        reg.firmas[id] = Object.assign({}, reg.firmas[id], { nombre: t.value });
        actualizarFirmaDeb(id);
        return;
      }
      if (t.dataset.c && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        const c = campoPorId(t.dataset.c);
        if (!c) return;
        let v = t.value;
        if (c.tipo === 'numero') { v = v.replace(',', '.').replace(/[^0-9.\-]/g, ''); if (v !== t.value.replace(',', '.')) t.value = v; v = v.trim(); }
        ponerValor(c, v);
        const ev2 = M.evaluar(f, c, v);
        const med = t.closest('.cf');
        if (med) {
          const lim = M.limite(f, c);
          med.classList.toggle('mal', M.esAlerta(ev2));
          med.classList.toggle('ok', ev2 === 'ok' && c.tipo === 'numero' && !!lim);
          const evEl = U.$('.ev', med);
          if (evEl) evEl.innerHTML = evaluacionHTML(c, v);
        }
      }
    });
    const actualizarFirmaDeb = U.debounce(async (id) => { if (reg.firmas[id].trazo || reg.firmas[id].img) { await actualizarFirma(id); pintarCierre(); } cambio(); }, 600);

    main.addEventListener('change', async (ev) => {
      const t = ev.target;
      if (t.dataset.foto) { const a = t.files && t.files[0]; if (a) agregarFoto(t.dataset.foto, a); t.value = ''; return; }
      if (t.id === 'c-fecha') { if (t.value) { reg.fecha = t.value; pintarTitulo(); cambio(); } return; }
      if (t.id === 'c-turno') { reg.turno = t.value; pintarTitulo(); cambio(); }
    });
    main.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.matches('input[inputmode="decimal"]')) {
        ev.preventDefault();
        const todos = U.$$('input[inputmode="decimal"], textarea[data-c]', main);
        const i = todos.indexOf(ev.target);
        if (todos[i + 1]) todos[i + 1].focus(); else ev.target.blur();
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset.firmar) { ev.preventDefault(); firmar(ev.target.dataset.firmar); }
    });
    main.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button, [data-firmar], [data-ver-foto]');
      if (!t) return;
      if (t.dataset.modo) { modo = t.dataset.modo; pintarZona(); return; }
      if (t.dataset.tipo) {
        if (t.dataset.tipo === reg.tipo) return;
        const marcadas = Object.keys(reg.valores).some((k) => k.startsWith('chk_') && reg.valores[k]);
        if (marcadas && !(await U.confirmar('Cambiar tipo de rutina', 'Las actividades de arranque y paro son distintas; se quitarán las casillas ya marcadas. ¿Continuar?', 'Cambiar'))) return;
        for (const k of Object.keys(reg.valores)) if (k.startsWith('chk_') || k.startsWith('obs_')) delete reg.valores[k];
        reg.tipo = t.dataset.tipo;
        pintarTitulo(); pintarZona(); cambio();
        return;
      }
      if (t.dataset.ir != null) { const sec = U.$('#sec-' + t.dataset.ir, main); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (t.dataset.todo != null) {
        let n = 0;
        for (const c of secciones()[+t.dataset.todo].campos) {
          if (reg.valores[c.id]) continue;
          if (c.tipo === 'check') { reg.valores[c.id] = 'ok'; n++; }
          if (c.tipo === 'paloma') { reg.valores[c.id] = 'si'; n++; }
        }
        cambio();
        const sec = U.$('#sec-' + t.dataset.todo, main);
        sec.outerHTML = seccionHTML(secciones()[+t.dataset.todo], +t.dataset.todo);
        pintarFotos(secciones()[+t.dataset.todo].id);
        pintarProgreso();
        U.toast(n ? 'Se marc' + (n === 1 ? 'ó 1 casilla' : 'aron ' + n + ' casillas') : 'Ya estaban todas marcadas', n ? 'ok' : 'aviso', 1600);
        return;
      }
      if (t.dataset.firmar) { firmar(t.dataset.firmar); return; }
      if (t.dataset.borrarFirma) { const d = reg.firmas[t.dataset.borrarFirma]; d.trazo = ''; await actualizarFirma(t.dataset.borrarFirma); pintarCierre(); cambio(); return; }
      if (t.dataset.verFoto) { const x = fotos.find((y) => y.id === t.dataset.verFoto); if (x) V.verFoto(x.data); return; }
      if (t.dataset.borrarFoto) {
        if (!(await U.confirmar('Borrar foto', '¿Seguro que quieres borrar esta foto?', 'Borrar', true))) return;
        const x = fotos.find((y) => y.id === t.dataset.borrarFoto);
        fotos = fotos.filter((y) => y !== x);
        DB.eliminarFoto(x.id);
        pintarFotos(x.filaId);
        return;
      }
      if (t.dataset.paloma) {
        const c = campoPorId(t.dataset.paloma);
        const nuevo = reg.valores[c.id] ? '' : 'si';
        ponerValor(c, nuevo);
        t.setAttribute('aria-pressed', !!nuevo);
        t.classList.toggle('hecho', !!nuevo);
        const caja = U.$('.paloma-caja', t) || t;
        caja.innerHTML = nuevo ? U.icon('check') : '';
        return;
      }
      if (t.dataset.v != null && t.dataset.c) {
        const c = campoPorId(t.dataset.c);
        const nuevo = reg.valores[c.id] === t.dataset.v ? '' : t.dataset.v;
        ponerValor(c, nuevo);
        U.$$('[data-c="' + CSS.escape(c.id) + '"][data-v]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === nuevo));
        const med = t.closest('.cf');
        if (med) med.classList.toggle('mal', M.esAlerta(M.evaluar(f, c, nuevo)));
        return;
      }
      const a = t.dataset.a;
      if (!a) return;
      if (a === 'cabecera') {
        const det = U.$('#cap-detalle', main);
        det.hidden = !det.hidden;
        t.setAttribute('aria-expanded', !det.hidden);
      } else if (a === 'previa') { autoguardar.flush(); V.vistaPrevia({ registros: [reg] }); }
      else if (a === 'guardar') {
        autoguardar.cancel();
        guardar(null);
        U.toast('Guardado. Puedes continuar después desde Inicio.');
        App.ir('/inicio');
      } else if (a === 'finalizar') finalizar();
    });

    U.$('#vista').classList.add('vista-compacta');
    pintarTitulo();
    pintarZona();
    pintarCierre();
    pintarProgreso();

    const alOcultar = () => { if (document.visibilityState === 'hidden' && sucio) autoguardar.flush(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      U.$('#vista').classList.remove('vista-compacta');
      document.removeEventListener('visibilitychange', alOcultar);
      if (sucio) autoguardar.flush(); else autoguardar.cancel();
    };
  };
})();
