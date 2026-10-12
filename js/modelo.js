/* Lógica de formatos y registros: límites, evaluación, avance y alertas. */
(function () {
  'use strict';

  const M = {};

  M.CONFIG_DEFECTO = {
    turnos: [
      { id: '1', nombre: '1er turno', inicio: '07:00', fin: '15:00' },
      { id: '2', nombre: '2do turno', inicio: '15:00', fin: '23:00' },
      { id: '3', nombre: '3er turno', inicio: '23:00', fin: '07:00' }
    ],
    inspectores: [],
    firmaObligatoria: false,
    formatos: {} // { formatoId: { filas: [...] } } — máquinas y límites editados en Configuración
  };

  M.config = U.clone(M.CONFIG_DEFECTO);

  M.formatos = () => window.FORMATOS || [];
  M.formato = (id) => M.formatos().find((f) => f.id === id);

  /** Filas (máquinas) vigentes para un formato, tomando en cuenta lo editado en Configuración. */
  M.filasVigentes = (formato) => {
    const ov = M.config.formatos && M.config.formatos[formato.id];
    const filas = ov && Array.isArray(ov.filas) && ov.filas.length ? ov.filas : formato.tabla.filas;
    return filas.filter((f) => f.activo !== false);
  };

  M.columnas = (formato) => formato.tabla.columnas;
  M.colsNumericas = (formato) => formato.tabla.columnas.filter((c) => c.tipo === 'numero');

  M.omitida = (fila, col) => !!(fila.omitir && fila.omitir.includes(col.id));

  /** Límite [min, max] de una columna para una fila (null si no tiene). */
  M.limite = (col, fila) => {
    if (col.tipo !== 'numero') return null;
    const l = fila && fila.limites && fila.limites[col.id];
    // Cada lado del rango propio, si está vacío, toma el general de la columna
    const min = l && l[0] != null && l[0] !== '' ? l[0] : col.min;
    const max = l && l[1] != null && l[1] !== '' ? l[1] : col.max;
    if ((min == null || min === '') && (max == null || max === '')) return null;
    return [min === '' ? null : min, max === '' ? null : max];
  };

  M.textoLimite = (lim, unidad) => {
    if (!lim) return '';
    const u = unidad ? ' ' + unidad : '';
    if (lim[0] != null && lim[1] != null) return lim[0] + ' – ' + lim[1] + u;
    if (lim[0] != null) return '≥ ' + lim[0] + u;
    return '≤ ' + lim[1] + u;
  };

  /** Evalúa un valor: null (vacío/sin criterio), 'ok', 'bajo', 'alto', 'mal' (✗). */
  M.evaluar = (col, fila, valor) => {
    if (valor == null || valor === '') return null;
    if (col.tipo === 'check') return valor === 'mal' ? 'mal' : 'ok';
    if (col.tipo !== 'numero') return null;
    const n = U.aNumero(valor);
    if (n == null) return null;
    const lim = M.limite(col, fila);
    if (!lim) return 'ok';
    if (lim[0] != null && n < Number(lim[0])) return 'bajo';
    if (lim[1] != null && n > Number(lim[1])) return 'alto';
    return 'ok';
  };

  M.esAlerta = (ev) => ev === 'bajo' || ev === 'alto' || ev === 'mal';

  M.TEXTO_CHECK = { ok: '✓', mal: '✗', na: 'N/A' };

  /** Texto para mostrar/imprimir un valor. */
  M.textoValor = (col, v) => {
    if (v == null || v === '') return '';
    if (col.tipo === 'check') return M.TEXTO_CHECK[v] || String(v);
    if (col.tipo === 'numero') { const n = U.aNumero(v); return n == null ? String(v) : U.fmtNum(n, col.decimales); }
    return String(v);
  };

  /** Columnas que cuentan para considerar completa una fila. */
  M.requeridas = (formato, fila) => formato.tabla.columnas.filter((c) => c.tipo !== 'texto' && !M.omitida(fila, c));

  M.estadoFila = (reg, formato, fila) => {
    const vals = (reg.valores && reg.valores[fila.id]) || {};
    const req = M.requeridas(formato, fila);
    let llenos = 0, alertas = 0;
    const cols = formato.tabla.columnas;
    for (const c of cols) {
      if (M.omitida(fila, c)) continue;
      const v = vals[c.id];
      if (v != null && v !== '' && c.tipo !== 'texto') llenos++;
      if (M.esAlerta(M.evaluar(c, fila, v))) alertas++;
    }
    const noOpera = !!vals._noOpera;
    const tocada = llenos > 0 || noOpera || !!vals.obs;
    const completa = noOpera || req.every((c) => vals[c.id] != null && vals[c.id] !== '');
    return { llenos, total: req.length, alertas, noOpera, completa, tocada };
  };

  /** Resumen del registro: avance y lista de alertas. */
  M.resumen = (reg, formato) => {
    formato = formato || M.formato(reg.formatoId);
    const filas = reg.filas || (formato ? M.filasVigentes(formato) : []);
    let completas = 0;
    const alertas = [];
    if (!formato) return { completas: 0, total: filas.length, alertas, fuera: 0, anomalias: 0, pct: 0 };
    for (const f of filas) {
      const e = M.estadoFila(reg, formato, f);
      if (e.completa) completas++;
      const vals = (reg.valores && reg.valores[f.id]) || {};
      for (const c of formato.tabla.columnas) {
        if (M.omitida(f, c)) continue;
        const ev = M.evaluar(c, f, vals[c.id]);
        if (M.esAlerta(ev)) alertas.push({ fila: f, col: c, valor: vals[c.id], tipo: ev, lim: M.limite(c, f) });
      }
    }
    const fuera = alertas.filter((a) => a.tipo !== 'mal').length;
    return {
      completas, total: filas.length, alertas, fuera, anomalias: alertas.length - fuera,
      pct: filas.length ? Math.round((completas / filas.length) * 100) : 0
    };
  };

  M.textoAlerta = (a) => {
    if (a.tipo === 'mal') return a.col.label + ': anomalía (✗)';
    const v = M.textoValor(a.col, a.valor) + (a.col.unidad ? ' ' + a.col.unidad : '');
    return a.col.label + ': ' + v + ' (' + (a.tipo === 'alto' ? 'arriba de ' + a.lim[1] : 'abajo de ' + a.lim[0]) + ')';
  };

  M.nombreTurno = (id) => {
    const t = (M.config.turnos || []).find((x) => x.id === String(id));
    return t ? t.nombre : (id ? 'Turno ' + id : '');
  };

  /** Crea un registro nuevo con los datos automáticos llenos. */
  M.nuevoRegistro = (formato, inspector) => {
    const ahora = new Date();
    const enc = {};
    for (const c of formato.encabezado) {
      if (c.auto === 'hoy') enc[c.id] = U.hoyISO(ahora);
      else if (c.auto === 'turno') enc[c.id] = U.turnoActual(M.config.turnos, ahora);
      else if (c.auto === 'ahora') enc[c.id] = U.ahoraHM(ahora);
      else if (c.auto === 'inspector') enc[c.id] = inspector || '';
      else enc[c.id] = '';
    }
    const firmas = {};
    for (const f of formato.firmas || []) firmas[f.id] = { nombre: f.auto === 'inspector' ? (inspector || '') : '', img: '' };
    return {
      id: U.hoyISO(ahora) + '_' + formato.id + '_' + U.uid(),
      formatoId: formato.id,
      formatoVersion: formato.codigo + ' rev ' + formato.revision,
      fecha: enc.fecha || U.hoyISO(ahora),
      turno: enc.turno || '',
      encabezado: enc,
      filas: U.clone(M.filasVigentes(formato)),
      valores: {},
      pie: {},
      firmas,
      estado: 'borrador',
      creadoPor: inspector || '',
      creadoEn: Date.now(),
      modificadoPor: inspector || '',
      modificadoEn: Date.now(),
      historial: [{ accion: 'Creado', por: inspector || '', en: Date.now() }]
    };
  };

  /** Texto plano con todo el contenido del registro, para el buscador. */
  M.textoBusqueda = (reg) => {
    const f = M.formato(reg.formatoId);
    const partes = [reg.fecha, U.fechaCorta(reg.fecha), M.nombreTurno(reg.turno), reg.estado === 'completo' ? 'completo' : 'en proceso'];
    if (f) partes.push(f.titulo, f.codigo, f.subtitulo || '');
    for (const k in (reg.encabezado || {})) partes.push(reg.encabezado[k]);
    for (const k in (reg.pie || {})) partes.push(reg.pie[k]);
    for (const k in (reg.firmas || {})) partes.push(reg.firmas[k] && reg.firmas[k].nombre);
    for (const fila of reg.filas || []) {
      const vals = (reg.valores || {})[fila.id];
      if (!vals) continue;
      partes.push(fila.nombre, fila.codigo || '');
      if (f) for (const c of f.tabla.columnas) if (vals[c.id] != null) partes.push(M.textoValor(c, vals[c.id]));
      if (vals._noOpera) partes.push('no opera');
    }
    return M.normalizar(partes.filter(Boolean).join(' '));
  };

  /** Título del formato en tipo oración, para listas (la hoja conserva las mayúsculas). */
  M.tituloCorto = (f) => (f ? f.nombreCorto || U.capital(f.titulo.toLowerCase()) : '');

  M.normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /** Agrupa columnas consecutivas con el mismo "grupo" para encabezados combinados. */
  M.gruposColumnas = (columnas) => {
    const out = [];
    for (const c of columnas) {
      const ultimo = out[out.length - 1];
      if (c.grupo && ultimo && ultimo.grupo === c.grupo) ultimo.cols.push(c);
      else out.push({ grupo: c.grupo || null, cols: [c] });
    }
    return out;
  };

  M.nombreArchivo = (s) => M.normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  window.M = M;
})();
