/* Tendencias: evolución de una medición por equipo y anomalías por equipo. */
(function () {
  'use strict';

  const e = U.esc;
  const CLAVE = 'ps_filtros_graficas';
  // Paleta categórica validada (3 primeros espacios, claro / oscuro)
  const SERIES = { claro: ['#2a78d6', '#eb6834', '#1baf7a'], oscuro: ['#3987e5', '#d95926', '#199e70'] };

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esOscuro = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };

  Vistas.graficas = async (main) => {
    const g = U.lsGet(CLAVE, {});
    const f0 = M.formato(g.formato) || M.formatos()[0];
    const st = { formato: f0.id, maquinas: g.maquinas || [], col: g.col || '', rapido: g.rapido || '30d', tabla: false };
    Object.assign(st, U.rangoRapido(st.rapido));
    let registros = [];
    let grafica = null;

    main.innerHTML =
      '<div class="vista-cab"><div class="titulos"><h1>Tendencias</h1><p>Cómo se comporta cada medición con el tiempo. Útil para detectar desgaste antes de una falla.</p></div></div>' +
      '<div class="tarjeta graf-filtros">' +
        '<div class="campo"><label for="g-formato">Formato</label><select class="select" id="g-formato">' + V.opcionesFormatos(st.formato, false) + '</select></div>' +
        '<div class="campo"><label for="g-col">Medición</label><select class="select" id="g-col"></select></div>' +
        '<div class="campo"><label for="g-desde">Desde</label><input class="input" type="date" id="g-desde"></div>' +
        '<div class="campo"><label for="g-hasta">Hasta</label><input class="input" type="date" id="g-hasta"></div>' +
        '<div style="grid-column:1/-1"><div class="etq" style="margin-bottom:8px">Equipos (hasta 3 para comparar)</div><div class="chips" id="g-maqs"></div></div>' +
        '<div class="chips" style="grid-column:1/-1">' + [['7d', '7 días'], ['30d', '30 días'], ['mes', 'Este mes'], ['mesPasado', 'Mes pasado'], ['anio', 'Este año']].map(([k, t]) => '<button class="chip" data-rapido="' + k + '">' + t + '</button>').join('') + '</div>' +
      '</div>' +
      '<div class="estad" id="g-estad"></div>' +
      '<div class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-cab"><h2 id="g-titulo"></h2><span class="espacio"></span>' +
        '<div class="segmentado"><button data-vista="graf" aria-pressed="true">' + U.icon('grafica', 'sm') + 'Gráfica</button><button data-vista="tabla">' + U.icon('tabla', 'sm') + 'Tabla</button></div></div>' +
        '<div class="graf-lienzo" id="g-lienzo"><canvas id="g-canvas" role="img"></canvas></div><div id="g-tabla" hidden></div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Alertas por equipo en el periodo</h2></div><div class="tarjeta-cuerpo" id="g-anom"></div></div>';

    const $ = (s) => U.$(s, main);
    const formato = () => M.formato(st.formato);
    const guardarFiltros = () => U.lsSet(CLAVE, { formato: st.formato, maquinas: st.maquinas, col: st.col, rapido: st.rapido });

    function pintarControles() {
      const f = formato();
      const nums = M.colsNumericas(f);
      if (!nums.find((c) => c.id === st.col)) st.col = nums[0] ? nums[0].id : '';
      $('#g-col').innerHTML = nums.map((c) => '<option value="' + e(c.id) + '"' + (c.id === st.col ? ' selected' : '') + '>' + e((c.grupo ? c.grupo.replace(/\s*\(.*\)/, '') + ' · ' : '') + c.label + (c.unidad ? ' (' + c.unidad + ')' : '')) + '</option>').join('');
      const filas = M.filasVigentes(f);
      const col = nums.find((c) => c.id === st.col);
      const aplican = filas.filter((x) => !col || !M.omitida(x, col));
      st.maquinas = st.maquinas.filter((id) => aplican.some((x) => x.id === id));
      if (!st.maquinas.length && aplican[0]) st.maquinas = [aplican[0].id];
      $('#g-maqs').innerHTML = aplican.map((x) => '<button class="chip" data-maq="' + e(x.id) + '" aria-pressed="' + st.maquinas.includes(x.id) + '">' + e(x.nombre) + '</button>').join('');
      $('#g-desde').value = st.desde; $('#g-hasta').value = st.hasta;
      U.$$('[data-rapido]', main).forEach((b) => b.setAttribute('aria-pressed', b.dataset.rapido === st.rapido));
    }

    function datos() {
      const f = formato();
      const col = f.tabla.columnas.find((c) => c.id === st.col);
      const regs = registros.filter((r) => r.formatoId === f.id).sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.turno).localeCompare(String(b.turno)) || a.creadoEn - b.creadoEn);
      const etiquetas = regs.map((r) => U.fechaCorta(r.fecha).slice(0, 5) + (r.turno ? ' T' + r.turno : ''));
      const series = st.maquinas.map((id) => {
        const fila = M.filasVigentes(f).find((x) => x.id === id) || { id, nombre: id };
        const puntos = regs.map((r) => {
          const fr = (r.filas || []).find((x) => x.id === id) || fila;
          const v = r.valores && r.valores[id] ? U.aNumero(r.valores[id][st.col]) : null;
          return { y: v, ev: v == null ? null : M.evaluar(col, fr, v), r };
        });
        return { fila, puntos, lim: col ? M.limite(col, fila) : null };
      });
      return { f, col, regs, etiquetas, series };
    }

    function pintarEstadisticas(d) {
      const vals = [];
      let fuera = 0;
      d.series.forEach((s) => s.puntos.forEach((p) => { if (p.y != null) { vals.push(p.y); if (M.esAlerta(p.ev)) fuera++; } }));
      const u = d.col && d.col.unidad ? ' <small>' + e(d.col.unidad) + '</small>' : '';
      const fmt = (n) => U.fmtNum(n, d.col && d.col.decimales != null ? d.col.decimales : 1);
      const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      $('#g-estad').innerHTML =
        '<div class="tarjeta tile"><span class="etq">Promedio</span><span class="valor">' + (prom == null ? '—' : fmt(prom) + u) + '</span></div>' +
        '<div class="tarjeta tile"><span class="etq">Mínimo</span><span class="valor">' + (vals.length ? fmt(Math.min(...vals)) + u : '—') + '</span></div>' +
        '<div class="tarjeta tile"><span class="etq">Máximo</span><span class="valor">' + (vals.length ? fmt(Math.max(...vals)) + u : '—') + '</span></div>' +
        '<div class="tarjeta tile"><span class="etq">Lecturas</span><span class="valor">' + vals.length + '</span></div>' +
        '<div class="tarjeta tile ' + (fuera ? 'alerta' : '') + '"><span class="etq">' + U.icon('alerta', 'sm') + 'Fuera de rango</span><span class="valor">' + fuera + (vals.length ? ' <small>' + Math.round(fuera / vals.length * 100) + '%</small>' : '') + '</span></div>';
    }

    async function pintarGrafica(d) {
      $('#g-titulo').textContent = d.col ? d.col.label + (d.col.unidad ? ' (' + d.col.unidad + ')' : '') + (d.series.length === 1 ? ' · ' + d.series[0].fila.nombre : '') : 'Sin mediciones numéricas';
      $('#g-lienzo').hidden = st.tabla; $('#g-tabla').hidden = !st.tabla;
      U.$$('[data-vista]', main).forEach((b) => b.setAttribute('aria-pressed', (b.dataset.vista === 'tabla') === st.tabla));

      // Tabla (siempre disponible como alternativa accesible)
      $('#g-tabla').innerHTML = d.regs.length
        ? '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha</th><th>Turno</th>' + d.series.map((s) => '<th>' + e(s.fila.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
          d.regs.map((r, i) => '<tr data-id="' + e(r.id) + '"><td class="num fuerte">' + e(U.fechaCorta(r.fecha)) + '</td><td>' + e(M.nombreTurno(r.turno)) + '</td>' +
            d.series.map((s) => { const p = s.puntos[i]; return '<td class="num">' + (p.y == null ? '<span class="muted">—</span>' : M.esAlerta(p.ev) ? '<span class="badge badge-bad">' + U.icon('alerta') + e(U.fmtNum(p.y, d.col.decimales)) + '</span>' : e(U.fmtNum(p.y, d.col.decimales))) + '</td>'; }).join('') + '</tr>').join('') +
          '</tbody></table></div>'
        : '<div class="vacio">Sin datos en el periodo</div>';

      if (!window.Chart) await V.cargarScript('vendor/chart.umd.min.js');
      if (grafica) { grafica.destroy(); grafica = null; }
      const canvas = $('#g-canvas');
      if (!d.regs.length || !d.col) {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        $('#g-lienzo').innerHTML = '<div class="vacio" style="padding-top:120px">' + U.icon('grafica') + '<p>No hay lecturas en el periodo elegido</p></div><canvas id="g-canvas" hidden></canvas>';
        return;
      }
      if (!canvas.isConnected || canvas.hidden) { $('#g-lienzo').innerHTML = '<canvas id="g-canvas" role="img"></canvas>'; }
      const cv = $('#g-canvas');
      cv.setAttribute('aria-label', 'Gráfica de ' + d.col.label);
      const pal = esOscuro() ? SERIES.oscuro : SERIES.claro;
      const superficie = css('--surface'), texto2 = css('--text-2'), rejilla = css('--border'), malo = css('--bad'), muted = css('--muted');
      const datasets = d.series.map((s, i) => ({
        label: s.fila.nombre,
        data: s.puntos.map((p) => p.y),
        borderColor: pal[i], backgroundColor: pal[i],
        borderWidth: 2, cubicInterpolationMode: 'monotone', spanGaps: true,
        pointRadius: s.puntos.map((p) => (M.esAlerta(p.ev) ? 6 : 4)),
        pointHoverRadius: 7,
        pointBackgroundColor: s.puntos.map((p) => (M.esAlerta(p.ev) ? malo : pal[i])),
        pointBorderColor: superficie, pointBorderWidth: 2
      }));
      // Límites como líneas de referencia (con una sola serie, o si todos comparten límite)
      const lims = d.series.map((s) => JSON.stringify(s.lim));
      const lim = d.series.length && lims.every((x) => x === lims[0]) ? d.series[0].lim : null;
      if (lim) {
        [['Máximo', lim[1]], ['Mínimo', lim[0]]].forEach(([n, v]) => {
          if (v == null) return;
          datasets.push({ label: n + ' (' + v + ')', data: d.etiquetas.map(() => Number(v)), borderColor: malo, borderWidth: 1, pointRadius: 0, pointHoverRadius: 0, fill: false, tension: 0, esLimite: true });
        });
      }
      grafica = new Chart(cv, {
        type: 'line',
        data: { labels: d.etiquetas, datasets },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: d.series.length > 1 || !!lim, position: 'top', align: 'end', labels: { color: texto2, usePointStyle: true, boxWidth: 8, boxHeight: 8, font: { size: 12 } } },
            tooltip: {
              backgroundColor: css('--surface'), titleColor: css('--text'), bodyColor: texto2, borderColor: rejilla, borderWidth: 1, padding: 10,
              filter: (it) => !it.dataset.esLimite,
              callbacks: {
                title: (it) => { const r = d.regs[it[0].dataIndex]; return U.fechaLarga(r.fecha) + ' · ' + M.nombreTurno(r.turno); },
                label: (it) => { const p = d.series[it.datasetIndex].puntos[it.dataIndex]; return ' ' + it.dataset.label + ': ' + U.fmtNum(it.parsed.y, d.col.decimales) + (d.col.unidad ? ' ' + d.col.unidad : '') + (M.esAlerta(p.ev) ? '  ⚠ fuera de rango' : ''); }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, border: { color: rejilla } },
            y: { grid: { color: rejilla }, ticks: { color: muted }, border: { display: false }, title: { display: !!d.col.unidad, text: d.col.unidad, color: muted } }
          },
          onClick: (ev, els) => { if (els[0]) App.ir('/ver/' + encodeURIComponent(d.regs[els[0].index].id)); }
        }
      });
    }

    function pintarAnomalias() {
      const f = formato();
      const conteo = new Map();
      registros.filter((r) => r.formatoId === f.id).forEach((r) => M.resumen(r, f).alertas.forEach((a) => {
        const c = conteo.get(a.fila.id) || { nombre: a.fila.nombre, n: 0, tipos: {} };
        c.n++; c.tipos[a.col.label] = (c.tipos[a.col.label] || 0) + 1;
        conteo.set(a.fila.id, c);
      }));
      const lista = Array.from(conteo.values()).sort((a, b) => b.n - a.n);
      const max = lista.length ? lista[0].n : 1;
      $('#g-anom').innerHTML = lista.length
        ? lista.map((c) => '<div style="display:grid;grid-template-columns:minmax(120px,200px) 1fr 40px;gap:12px;align-items:center;margin-bottom:10px">' +
            '<b class="t-sm">' + e(c.nombre) + '</b>' +
            '<div><div style="height:14px;border-radius:0 4px 4px 0;background:var(--primary);width:' + Math.max(3, c.n / max * 100) + '%"></div>' +
            '<div class="t-xs muted" style="margin-top:3px">' + Object.entries(c.tipos).map(([k, v]) => e(k) + ' (' + v + ')').join(' · ') + '</div></div>' +
            '<span class="num fuerte" style="text-align:right">' + c.n + '</span></div>').join('')
        : '<div class="vacio" style="padding:16px">' + U.icon('check') + '<p>Sin alertas en el periodo</p></div>';
    }

    const pintar = () => { pintarControles(); const d = datos(); pintarEstadisticas(d); pintarGrafica(d); pintarAnomalias(); };

    let quitar = null;
    const suscribir = () => { if (quitar) quitar(); quitar = DB.suscribirRegistros({ desde: st.desde, hasta: st.hasta }, (l) => { registros = l; pintar(); }); };

    main.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.id === 'g-formato') { st.formato = t.value; st.maquinas = []; st.col = ''; guardarFiltros(); pintar(); }
      else if (t.id === 'g-col') { st.col = t.value; guardarFiltros(); pintar(); }
      else if (t.id === 'g-desde' || t.id === 'g-hasta') {
        st.desde = $('#g-desde').value || st.desde; st.hasta = $('#g-hasta').value || st.hasta;
        if (st.desde > st.hasta) { const x = st.desde; st.desde = st.hasta; st.hasta = x; }
        st.rapido = 'personal'; suscribir();
      }
    });
    main.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) { const tr = ev.target.closest('tr[data-id]'); if (tr) App.ir('/ver/' + encodeURIComponent(tr.dataset.id)); return; }
      if (b.dataset.maq) {
        const id = b.dataset.maq;
        if (st.maquinas.includes(id)) { if (st.maquinas.length > 1) st.maquinas = st.maquinas.filter((x) => x !== id); }
        else { st.maquinas.push(id); if (st.maquinas.length > 3) st.maquinas.shift(); }
        guardarFiltros(); pintar();
      } else if (b.dataset.rapido) { st.rapido = b.dataset.rapido; Object.assign(st, U.rangoRapido(st.rapido)); guardarFiltros(); suscribir(); }
      else if (b.dataset.vista) { st.tabla = b.dataset.vista === 'tabla'; pintarGrafica(datos()); }
    });
    const alTema = () => pintarGrafica(datos());
    document.addEventListener('tema', alTema);

    pintarControles();
    suscribir();
    return () => { if (quitar) quitar(); if (grafica) grafica.destroy(); document.removeEventListener('tema', alTema); };
  };
})();
