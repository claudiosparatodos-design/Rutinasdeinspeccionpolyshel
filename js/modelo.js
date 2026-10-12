/* Lógica de formatos y registros: campos, límites, evaluación, avance y alertas. */
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
    limites: {} // { formatoId: { campoId: [min, max] } } — editados en Configuración
  };

  M.config = U.clone(M.CONFIG_DEFECTO);
  M.plantillas = {}; // id -> plantilla JSON ya cargada

  M.formatos = () => window.FORMATOS || [];
  M.formato = (id) => M.formatos().find((f) => f.id === id);

  /** Carga todas las plantillas (se usan de forma síncrona después). */
  M.cargarPlantillas = async () => {
    const ids = Array.from(new Set(M.formatos().map((f) => f.plantilla)));
    await Promise.all(ids.map(async (id) => { M.plantillas[id] = await P.cargar(id); }));
  };
  M.plantilla = (f) => M.plantillas[f.plantilla];

  /** Secciones del formato (algunas dependen del registro, p. ej. arranque/paro). */
  M.secciones = (f, reg) => (typeof f.secciones === 'function' ? f.secciones(reg, M.plantilla(f)) : f.secciones);
  /** Todas las secciones posibles del formato (con todos sus tipos), sin repetir título. */
  M.seccionesTodas = (f) => {
    const regs = f.tipos ? f.tipos.map((t) => ({ tipo: t.id })) : [null];
    const out = [];
    for (const r of regs) for (const s of M.secciones(f, r)) if (!out.some((x) => x.titulo === s.titulo)) out.push(s);
    return out;
  };
  M.campos = (f, reg) => [].concat(...M.secciones(f, reg).map((s) => s.campos));
  M.campo = (f, reg, id) => M.campos(f, reg).find((c) => c.id === id);
  M.colsNumericas = (f, reg) => M.campos(f, reg).filter((c) => c.tipo === 'numero');

  /** Límite [min, max] de un campo numérico (Configuración tiene prioridad). */
  M.limite = (f, campo) => {
    if (campo.tipo !== 'numero') return null;
    const ov = M.config.limites && M.config.limites[f.id] && M.config.limites[f.id][campo.id];
    const min = ov && ov[0] != null && ov[0] !== '' ? ov[0] : campo.min;
    const max = ov && ov[1] != null && ov[1] !== '' ? ov[1] : campo.max;
    if ((min == null || min === '') && (max == null || max === '')) return null;
    return [min == null || min === '' ? null : Number(min), max == null || max === '' ? null : Number(max)];
  };

  M.textoLimite = (lim, unidad) => {
    if (!lim) return '';
    const u = unidad ? ' ' + unidad : '';
    if (lim[0] != null && lim[1] != null) return lim[0] + ' – ' + lim[1] + u;
    if (lim[0] != null) return '≥ ' + lim[0] + u;
    return '≤ ' + lim[1] + u;
  };

  /** Evalúa un valor: null (vacío), 'ok', 'bajo', 'alto', 'mal'. */
  M.evaluar = (f, campo, valor) => {
    if (valor == null || valor === '') return null;
    if (campo.tipo === 'check') return valor === 'mal' ? 'mal' : 'ok';
    if (campo.tipo === 'opciones') return campo.alerta && campo.alerta.includes(valor) ? 'mal' : 'ok';
    if (campo.tipo !== 'numero') return null;
    const n = U.aNumero(valor);
    if (n == null) return null;
    const lim = M.limite(f, campo);
    if (!lim) return 'ok';
    if (lim[0] != null && n < lim[0]) return 'bajo';
    if (lim[1] != null && n > lim[1]) return 'alto';
    return 'ok';
  };
  M.esAlerta = (ev) => ev === 'bajo' || ev === 'alto' || ev === 'mal';

  M.TEXTO_CHECK = { ok: '✓', mal: '✗', na: 'N/A' };
  M.textoValor = (campo, v) => {
    if (v == null || v === '') return '';
    if (campo.tipo === 'check') return M.TEXTO_CHECK[v] || String(v);
    if (campo.tipo === 'paloma') return v ? '✓' : '';
    if (campo.tipo === 'numero') { const n = U.aNumero(v); return n == null ? String(v) : U.fmtNum(n, campo.decimales); }
    return String(v);
  };

  const lleno = (v) => v != null && v !== '';
  /** Campos que cuentan para el avance (no texto ni opcionales). */
  M.requeridos = (campos) => campos.filter((c) => c.tipo !== 'texto' && !c.opcional);

  M.estadoSeccion = (f, reg, s) => {
    const vals = reg.valores || {};
    const req = M.requeridos(s.campos);
    let llenos = 0, alertas = 0;
    for (const c of s.campos) {
      if (c.tipo !== 'texto' && lleno(vals[c.id])) llenos++;
      if (M.esAlerta(M.evaluar(f, c, vals[c.id]))) alertas++;
    }
    const completa = req.length ? req.every((c) => lleno(vals[c.id])) : s.campos.some((c) => lleno(vals[c.id]));
    return { llenos, total: req.length || s.campos.filter((c) => c.tipo !== 'texto').length, alertas, completa, tocada: llenos > 0 };
  };

  /** Resumen del registro: avance y alertas. */
  M.resumen = (reg, f) => {
    f = f || M.formato(reg.formatoId);
    const out = { completas: 0, total: 0, llenos: 0, requeridos: 0, alertas: [], fuera: 0, anomalias: 0, pct: 0 };
    if (!f || !M.plantilla(f)) return out;
    const vals = reg.valores || {};
    for (const s of M.secciones(f, reg)) {
      const e = M.estadoSeccion(f, reg, s);
      out.total++;
      if (e.completa) out.completas++;
      for (const c of s.campos) {
        const ev = M.evaluar(f, c, vals[c.id]);
        if (M.esAlerta(ev)) out.alertas.push({ seccion: s, campo: c, valor: vals[c.id], tipo: ev, lim: M.limite(f, c) });
      }
    }
    const req = M.requeridos(M.campos(f, reg));
    out.requeridos = req.length;
    out.llenos = req.filter((c) => lleno(vals[c.id])).length;
    out.pct = req.length ? Math.round(out.llenos / req.length * 100) : (out.completas ? 100 : 0);
    out.fuera = out.alertas.filter((a) => a.tipo !== 'mal').length;
    out.anomalias = out.alertas.length - out.fuera;
    return out;
  };

  M.textoAlerta = (a) => {
    const u = a.campo.unidad ? ' ' + a.campo.unidad : '';
    if (a.tipo === 'mal') return a.campo.label + ': ' + (a.campo.tipo === 'opciones' ? a.valor : 'anomalía (✗)');
    return a.campo.label + ': ' + M.textoValor(a.campo, a.valor) + u + ' (' + (a.tipo === 'alto' ? 'arriba de ' + a.lim[1] : 'abajo de ' + a.lim[0]) + ')';
  };

  M.nombreTurno = (id) => {
    const t = (M.config.turnos || []).find((x) => x.id === String(id));
    return t ? t.nombre : (id ? 'Turno ' + id : '');
  };
  M.usaTurno = (f) => f.registroPor === 'turno' || !!f.conTurno;

  M.nombreTipo = (f, reg) => {
    if (!f.tipos) return '';
    const t = f.tipos.find((x) => x.id === reg.tipo) || f.tipos[0];
    return t.nombre;
  };
  M.tituloRegistro = (f, reg) => (f.tipos ? M.nombreTipo(f, reg) : M.tituloCorto(f));

  /** Crea un registro nuevo con los datos automáticos llenos. */
  M.nuevoRegistro = (f, inspector, extra) => {
    const ahora = new Date();
    const fecha = U.hoyISO(ahora);
    const turno = M.usaTurno(f) ? U.turnoActual(M.config.turnos, ahora) : '';
    const reg = Object.assign({
      id: fecha + '_' + f.id + '_' + U.uid(),
      formatoId: f.id,
      fecha,
      turno,
      encabezado: { inspector: inspector || '', hora: U.ahoraHM(ahora) },
      valores: {},
      firmas: {},
      estado: 'borrador',
      creadoPor: inspector || '',
      creadoEn: Date.now(),
      modificadoPor: inspector || '',
      modificadoEn: Date.now(),
      historial: [{ accion: 'Creado', por: inspector || '', en: Date.now() }]
    }, extra || {});
    if (f.tipos && !reg.tipo) reg.tipo = f.tipos[0].id;
    for (const fi of f.firmas || []) reg.firmas[fi.id] = { nombre: fi.auto === 'inspector' ? (inspector || '') : '', img: '' };
    return reg;
  };

  /** Texto plano con todo el contenido del registro, para el buscador. */
  M.textoBusqueda = (reg) => {
    const f = M.formato(reg.formatoId);
    const partes = [reg.fecha, U.fechaCorta(reg.fecha), M.nombreTurno(reg.turno), reg.estado === 'completo' ? 'finalizado' : 'en proceso'];
    if (reg.encabezado) partes.push(reg.encabezado.inspector);
    for (const k in (reg.firmas || {})) partes.push(reg.firmas[k] && reg.firmas[k].nombre);
    if (f) {
      partes.push(f.titulo, f.archivo, M.nombreTipo(f, reg));
      if (M.plantilla(f)) {
        for (const s of M.secciones(f, reg)) {
          let tiene = false;
          for (const c of s.campos) {
            const v = reg.valores && reg.valores[c.id];
            if (v == null || v === '') continue;
            tiene = true;
            partes.push(c.label, M.textoValor(c, v));
          }
          if (tiene) partes.push(s.titulo);
        }
      }
    }
    return M.normalizar(partes.filter(Boolean).join(' '));
  };

  /** Título del formato en tipo oración, para listas. */
  M.tituloCorto = (f) => (f ? f.nombreCorto || f.titulo : '');

  M.normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  M.nombreArchivo = (s) => M.normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ---------------- Páginas (vista previa, impresión y Excel) ---------------- */
  /** Agrupa registros por formato y devuelve las páginas en orden. */
  M.paginas = (registros) => {
    const porFormato = new Map();
    for (const r of registros) {
      const f = M.formato(r.formatoId);
      if (!f) continue;
      if (!porFormato.has(f)) porFormato.set(f, []);
      porFormato.get(f).push(r);
    }
    const out = [];
    for (const f of M.formatos()) {
      const regs = porFormato.get(f);
      if (!regs) continue;
      const pl = M.plantilla(f);
      for (const pg of f.paginar(regs, pl)) out.push(Object.assign({ formato: f, plantilla: pl }, pg));
    }
    return out;
  };

  /** Páginas del formato en blanco. */
  M.paginasBlanco = (f) => {
    const pl = M.plantilla(f);
    const hojas = f.blanco || (f.hojaPlantilla ? [f.hojaPlantilla] : f.tipos ? [] : Array.from(new Set(M.secciones(f).map((s) => s.hoja).filter(Boolean))));
    const lista = hojas.length ? hojas : pl.hojas.map((h) => h.nombre);
    return lista.map((n) => ({ formato: f, plantilla: pl, hoja: n, nombre: n, llenado: {} }));
  };

  window.M = M;
})();
