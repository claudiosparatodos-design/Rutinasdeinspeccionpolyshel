/* ==========================================================================
   FORMATOS DE LA PLANTA
   --------------------------------------------------------------------------
   Cada formato usa el Excel original (carpeta formatos/, convertido a
   plantillas/ con tools/convertir_plantillas.py). Aquí se define:
     - secciones/campos: lo que se captura en la tableta (en el orden del papel)
     - registroPor: 'dia' | 'turno' | 'evento'  (cuántas capturas se hacen)
     - paginar(registros, pl): cómo se acomodan los registros en las hojas del
       Excel (qué celda recibe cada dato). La vista previa, la impresión y el
       Excel exportado usan exactamente este acomodo.

   Tipos de campo: 'numero' · 'check' (✓ / ✗ / N/A) · 'paloma' (casilla ✓)
                   'opciones' · 'texto'
   ========================================================================== */
(function () {
  'use strict';

  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const TXT_CHECK = { ok: '✓', mal: '✗', na: 'N/A' };

  /* ---------------- Ayudantes para acomodar datos en las hojas ---------------- */
  const H = {};
  H.col = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  H.ref = (c, r) => H.col(c) + r;
  /** dd/mm/aa */
  H.fecha = (iso) => { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y.slice(2); };
  H.fechaLarga = (iso) => { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  /** Valor tal como se escribe en el papel. */
  H.valor = (campo, v) => {
    if (v == null || v === '') return null;
    if (campo.tipo === 'numero') { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : String(v); }
    if (campo.tipo === 'check') return TXT_CHECK[v] || String(v);
    if (campo.tipo === 'paloma') return v ? '✓' : null;
    return String(v);
  };
  H.nuevo = () => ({ celdas: {}, estilos: {}, formas: {}, imagenes: [] });
  /** Escribe un valor centrado en la celda. */
  H.poner = (ll, ref, valor, opciones) => {
    if (valor == null || valor === '') return;
    ll.celdas[ref] = valor;
    if (opciones !== false) ll.estilos[ref] = Object.assign({}, ll.estilos[ref], { centrar: true }, opciones || {});
  };
  H.ordenar = (regs) => regs.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.turno || '').localeCompare(String(b.turno || '')) || (a.creadoEn || 0) - (b.creadoEn || 0));
  H.fechasDistintas = (regs) => Array.from(new Set(H.ordenar(regs).map((r) => r.fecha)));
  H.trozos = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
  /** Último valor no vacío de un campo entre varios registros. */
  H.ultimo = (regs, id) => { let v = null; for (const r of H.ordenar(regs)) { const x = r.valores && r.valores[id]; if (x != null && x !== '') v = x; } return v; };
  H.tieneDatos = (r, ids) => ids.some((id) => r.valores && r.valores[id] != null && r.valores[id] !== '');
  H.diasMes = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  H.titulo = (fechas) => (fechas.length === 1 ? H.fechaLarga(fechas[0]) : H.fecha(fechas[0]) + ' al ' + H.fecha(fechas[fechas.length - 1]));
  H.MESES = MESES;
  window.HF = H;

  /** Campos con su fila en la hoja (para formatos de una columna por fecha/turno). */
  const c = (id, label, tipo, fila, extra) => Object.assign({ id, label, tipo, fila }, extra || {});

  /* ======================================================================
     1) RUTINA DE INSPECCIÓN DE SERVICIOS EXTRUSIÓN (por turno)
     Hoja2: 5 fechas por hoja × 3 turnos (1ro, 2do, 3er).
     ====================================================================== */
  const SERV = {
    id: 'servicios-turnos',
    titulo: 'Rutina de inspección de servicios extrusión',
    archivo: 'RUTINA INSPECCION SERVICIOS PARA TURNOS.xlsx',
    plantilla: 'servicios-turnos',
    hojaPlantilla: 'Hoja2',
    blanco: ['Hoja2', 'Hoja1'],
    registroPor: 'turno',
    descripcion: 'Lecturas de agua, bombas, chillers, compresores y mezcladoras en cada turno. 5 días por hoja.',
    secciones: [
      { id: 'agua', titulo: 'Agua', campos: [
        c('t_fria', 'Temperatura de agua fría', 'numero', 5, { unidad: '°C', max: 15, ayuda: 'Temperatura general máxima del agua: 15 °C' }),
        c('t_caliente', 'Temperatura de agua caliente', 'numero', 6, { unidad: '°C' })
      ] },
      { id: 'bombas', titulo: 'Bombas y variadores', campos: [
        c('p_proceso', 'Presión bomba de agua de proceso', 'numero', 7, { unidad: 'kg/cm²' }),
        c('var_50', 'Revisión variador (50 Hz)', 'numero', 8, { unidad: 'Hz' }),
        c('p_chiller1', 'Presión bomba de agua chiller #1', 'numero', 9, { unidad: 'kg/cm²' }),
        c('var_46', 'Revisión variador (46 Hz)', 'numero', 10, { unidad: 'Hz' }),
        c('p_chiller23', 'Presión bomba de agua chiller #2 y 3', 'numero', 11, { unidad: 'PSI' }),
        c('var_47', 'Revisión variador (47 Hz)', 'numero', 12, { unidad: 'Hz' }),
        c('p_mezclado', 'Presión bomba de agua mezclado', 'numero', 13, { unidad: 'PSI' }),
        c('p_auxiliar', 'Presión bomba de agua auxiliar', 'numero', 14, { unidad: 'PSI' }),
        c('nivel_agua', 'Revisión nivel de agua', 'check', 15)
      ] },
      { id: 'chillers', titulo: 'Chillers', campos: [
        c('t_ch1', 'Temperatura chiller #1', 'numero', 16, { unidad: '°C' }),
        c('t_ch2', 'Temperatura chiller #2', 'numero', 17, { unidad: '°C' }),
        c('t_ch3', 'Temperatura chiller #3', 'numero', 18, { unidad: '°C' })
      ] },
      { id: 'asd40', titulo: 'Compresor ASD-40', campos: [
        c('alarma_asd', 'Alarma en compresor ASD-40', 'opciones', 19, { opciones: ['SI', 'NO'], alerta: ['SI'] }),
        c('p_pulmon_asd', 'Presión pulmón de aire comprimido', 'numero', 20, { unidad: 'kg/cm²' })
      ] },
      { id: 'mezcladoras', titulo: 'Mezcladoras y pulverizador', campos: [
        c('mez1_p', 'Presión manómetro MEZ-01', 'numero', 21),
        c('mez1_t', 'Temperatura MEZ-01', 'numero', 22, { unidad: '°C' }),
        c('mez1_filtro', 'Limpieza filtro tablero MEZ-01', 'check', 23),
        c('mez2_p', 'Presión manómetro MEZ-02', 'numero', 24),
        c('mez2_t', 'Temperatura MEZ-02', 'numero', 25, { unidad: '°C' }),
        c('mez2_filtro', 'Limpieza filtro tablero MEZ-02', 'check', 26),
        c('pulver_p', 'Presión manómetro pulverizador', 'numero', 27),
        c('pulver_filtro', 'Limpieza filtro tablero pulverizador', 'check', 28),
        c('filtro_yee', 'Limpieza filtro Yee', 'check', 29)
      ] },
      { id: 'sk15', titulo: 'Compresor SK-15', campos: [
        c('alarma_sk', 'Alarma en compresor SK-15', 'opciones', 30, { opciones: ['SI', 'NO'], alerta: ['SI'] }),
        c('p_pulmon_sk', 'Presión pulmón de aire comprimido', 'numero', 31, { unidad: 'kg/cm²' })
      ] },
      { id: 'medidores', titulo: 'Medidores de agua (una vez al día)', porDia: true, campos: [
        c('med_cisternas', 'Medidor agua cisternas', 'numero', 32, { opcional: true }),
        c('med_banos_ext', 'Medidor agua baños extrusión', 'numero', 33, { opcional: true }),
        c('med_banos_n6', 'Medidor agua baños nave 6', 'numero', 34, { opcional: true })
      ] }
    ],
    paginar(regs) {
      const fechas = H.fechasDistintas(regs);
      return H.trozos(fechas, 5).map((grupo) => {
        const ll = H.nuevo();
        grupo.forEach((fecha, i) => {
          const c0 = 2 + i * 3; // B, E, H, K, N
          // La 4a fecha no tiene celda combinada en el formato (choca con "Rev:"): va al centro y se reduce
          if (i === 3) H.poner(ll, H.ref(c0 + 1, 3), H.fecha(fecha), { reducir: true });
          else H.poner(ll, H.ref(c0, 3), H.fecha(fecha));
          const delDia = regs.filter((r) => r.fecha === fecha);
          for (const r of delDia) {
            const t = Math.min(3, Math.max(1, parseInt(r.turno, 10) || 1));
            for (const s of SERV.secciones) {
              if (s.porDia) continue;
              for (const campo of s.campos) H.poner(ll, H.ref(c0 + t - 1, campo.fila), H.valor(campo, r.valores[campo.id]));
            }
          }
          for (const campo of SERV.secciones.find((s) => s.porDia).campos) H.poner(ll, H.ref(c0, campo.fila), H.valor(campo, H.ultimo(delDia, campo.id)));
        });
        return { hoja: SERV.hojaPlantilla, nombre: H.titulo(grupo), fechas: grupo, llenado: ll };
      });
    }
  };

  /* ======================================================================
     2) CONSUMOS DE AGUA (por día) — 9 fechas por hoja, 3 medidores.
     ====================================================================== */
  const medidorAgua = (id, titulo, filaFecha) => ({
    id, titulo, filaFecha,
    campos: [1, 2, 3, 4, 5, 6].map((n) => c(id + '_' + n, 'Lectura ' + n, 'numero', filaFecha + 1 + n, { opcional: n > 1 }))
  });
  const AGUA = {
    id: 'consumo-agua',
    titulo: 'Consumos de agua',
    archivo: 'FORMATO CONSUMO DE AGUA.xlsx',
    plantilla: 'consumo-agua',
    hojaPlantilla: 'Hoja1',
    registroPor: 'dia',
    descripcion: 'Lecturas de los medidores de cisternas, baños de extrusión y baños de nave 6. 9 días por hoja.',
    secciones: [
      medidorAgua('cisternas', 'Cisternas', 3),
      medidorAgua('banos_ext', 'Baños extrusión', 14),
      medidorAgua('banos_n6', 'Baños nave 6', 25)
    ],
    paginar(regs) {
      return H.trozos(H.fechasDistintas(regs), 9).map((grupo) => {
        const ll = H.nuevo();
        grupo.forEach((fecha, i) => {
          const col = 2 + i; // B..J
          const delDia = regs.filter((r) => r.fecha === fecha);
          for (const s of AGUA.secciones) {
            H.poner(ll, H.ref(col, s.filaFecha), H.fecha(fecha));
            for (const campo of s.campos) H.poner(ll, H.ref(col, campo.fila), H.valor(campo, H.ultimo(delDia, campo.id)));
          }
        });
        return { hoja: AGUA.hojaPlantilla, nombre: H.titulo(grupo), fechas: grupo, llenado: ll };
      });
    }
  };

  /* ======================================================================
     3) LECTURAS CFE MEDIDOR (por día) — 10 fechas por hoja; Extrusión y Nave 6.
     ====================================================================== */
  const CODIGOS = ['70', '80', '11', '41', '71', '81', '12', '42', '72', '82', '13', '43', '73', '83', '1', '5', '90', '18', '19', '20', '21'];
  const camposCFE = (pre) => CODIGOS.map((cod, i) => c(pre + '_' + cod, 'Código ' + cod, 'numero', 8 + i))
    .concat([c(pre + '_fp', 'F.P. (factor de potencia)', 'numero', 29), c(pre + '_demanda', 'Demanda', 'numero', 30)]);
  const CFE = {
    id: 'lecturas-cfe',
    titulo: 'Lecturas CFE medidor',
    archivo: 'FORMATO DE RECOLECCION DE LECTURAS.xlsx',
    plantilla: 'lecturas-cfe',
    registroPor: 'dia',
    descripcion: 'Lecturas de los medidores de CFE de Extrusión y Nave 6. 10 días por hoja.',
    secciones: [
      { id: 'ext', titulo: 'Medidor Extrusión', hoja: 'EXTRUSION', campos: camposCFE('ext').map((x) => Object.assign(x, { opcional: true })) },
      { id: 'n6', titulo: 'Medidor Nave 6', hoja: 'NAVE 6', campos: camposCFE('n6').concat([
        c('n6_horas', 'Horas', 'numero', 32), c('n6_kwh', 'kW/h', 'numero', 33), c('n6_kvarh', 'kVArh', 'numero', 34)
      ]).map((x) => Object.assign(x, { opcional: true })) }
    ],
    paginar(regs) {
      const paginas = [];
      for (const s of CFE.secciones) {
        const ids = s.campos.map((x) => x.id);
        const conDatos = regs.filter((r) => H.tieneDatos(r, ids));
        for (const grupo of H.trozos(H.fechasDistintas(conDatos), 10)) {
          const ll = H.nuevo();
          grupo.forEach((fecha, i) => {
            const col = 2 + i; // B..K
            const delDia = conDatos.filter((r) => r.fecha === fecha);
            H.poner(ll, H.ref(col, 6), H.fecha(fecha));
            for (const campo of s.campos) H.poner(ll, H.ref(col, campo.fila), H.valor(campo, H.ultimo(delDia, campo.id)));
          });
          paginas.push({ hoja: s.hoja, nombre: (s.id === 'ext' ? 'Extrusión ' : 'Nave 6 ') + H.titulo(grupo), fechas: grupo, llenado: ll });
        }
      }
      return paginas;
    }
  };

  /* ======================================================================
     4) RECIPIENTES SUJETOS A PRESIÓN (por turno) — una hoja por mes y pulmón.
     ====================================================================== */
  const pulmon = (id, titulo, hoja) => ({
    id, titulo, hoja,
    campos: [
      c(id + '_p', 'Presión', 'numero', null, { unidad: 'kg/cm²', max: 8, ayuda: 'Presión de operación (PO): 8 kg/cm²' }),
      c(id + '_t', 'Temperatura', 'numero', null, { unidad: '°C' }),
      c(id + '_purga', 'Purga del pulmón (diaria)', 'check', 19, { opcional: true }),
      c(id + '_valv', 'Purga de válvula de seguridad (quincenal)', 'check', 22, { opcional: true })
    ]
  });
  const PRES = {
    id: 'recipientes-presion',
    titulo: 'Registro de recipientes sujetos a presión',
    archivo: 'REGISTRO DE PRESIONES Y TEMPERATURA.xlsx',
    plantilla: 'presiones',
    registroPor: 'turno',
    descripcion: 'Presión y temperatura de los pulmones por turno, purga diaria y purga quincenal de válvula. Una hoja por mes.',
    secciones: [
      pulmon('ext', 'Pulmón Extrusión (TRA-2)', 'Registro de Variables Extrusion'),
      pulmon('n6', 'Pulmón Nave 6 (TRA-1)', 'Registro de Variables Nave 6'),
      { id: 'obs', titulo: 'Observaciones', campos: [c('obs', 'Observaciones', 'texto', null, { opcional: true })] }
    ],
    blanco: ['Registro de Variables Extrusion', 'Registro de Variables Nave 6', 'Hoja1'],
    paginar(regs) {
      const paginas = [];
      const meses = Array.from(new Set(H.ordenar(regs).map((r) => r.fecha.slice(0, 7))));
      for (const ym of meses) {
        const delMes = regs.filter((r) => r.fecha.startsWith(ym));
        const [y, m] = ym.split('-').map(Number);
        const dias = H.diasMes(ym);
        for (const s of PRES.secciones.filter((x) => x.hoja)) {
          const ids = s.campos.map((x) => x.id);
          const conDatos = delMes.filter((r) => H.tieneDatos(r, ids));
          if (!conDatos.length) continue;
          const ll = H.nuevo();
          ll.celdas.S9 = MESES[m - 1];
          ll.celdas.AB9 = y;
          for (let d = 1; d <= 31; d++) {
            const col = 1 + d; // B = día 1
            const finde = d <= dias && [0, 6].includes(new Date(y, m - 1, d).getDay());
            // Fines de semana en verde, como en el formato
            for (let fila = 11; fila <= 16; fila++) ll.estilos[H.ref(col, fila)] = Object.assign({}, ll.estilos[H.ref(col, fila)], { rellenoDe: finde ? 'B11' : 'D11' });
            ll.celdas[H.ref(col, 10)] = d <= dias ? d : '';
            if (d > 28) { ll.celdas[H.ref(col, 18)] = d <= dias ? d : ''; ll.celdas[H.ref(col, 21)] = d <= dias ? d : ''; }
          }
          const obs = [];
          for (const r of H.ordenar(conDatos)) {
            const d = +r.fecha.slice(8, 10), col = 1 + d;
            const t = Math.min(3, Math.max(1, parseInt(r.turno, 10) || 1));
            const filaP = 9 + 2 * t, filaT = 10 + 2 * t; // T1: 11/12 · T2: 13/14 · T3: 15/16
            H.poner(ll, H.ref(col, filaP), H.valor(s.campos[0], r.valores[s.id + '_p']), { reducir: true });
            H.poner(ll, H.ref(col, filaT), H.valor(s.campos[1], r.valores[s.id + '_t']), { reducir: true });
            if (r.valores.obs) obs.push(H.fecha(r.fecha) + ' T' + t + ': ' + r.valores.obs);
          }
          for (let d = 1; d <= dias; d++) {
            const delDia = conDatos.filter((r) => +r.fecha.slice(8, 10) === d);
            H.poner(ll, H.ref(1 + d, 19), H.valor(s.campos[2], H.ultimo(delDia, s.id + '_purga')));
            H.poner(ll, H.ref(1 + d, 22), H.valor(s.campos[3], H.ultimo(delDia, s.id + '_valv')));
          }
          if (obs.length) { ll.celdas.A24 = obs.join('   ·   '); ll.estilos.A24 = { ajustar: true }; }
          paginas.push({ hoja: s.hoja, nombre: (s.id === 'ext' ? 'TRA-2 ' : 'TRA-1 ') + MESES[m - 1].slice(0, 3) + ' ' + y, mes: ym, llenado: ll });
        }
      }
      return paginas;
    }
  };

  /* ======================================================================
     5) ALARMAS Y DETECTORES DE HUMO (por día de revisión) — hoja por mes y nave.
     ====================================================================== */
  const ALARMAS_ITEMS = [
    ['semanal', 'Semanal', [['boton', 'Revisión de daños en botón pulsador', 9], ['sirena', 'Revisión de daños en sirena', 10], ['torreta', 'Revisión de daños en torreta indicadora', 11], ['letrero', 'Revisión de letrero de alarma', 12]]],
    ['mensual', 'Mensual', [['operativa', 'Revisión operativa de alarma', 15], ['detector', 'Revisión de daños en detector de humos', 16], ['bateria', 'Revisión de batería (test)', 17]]],
    ['anual', 'Anual', [['humo', 'Prueba operativa con humo de los detectores', 20]]]
  ];
  const nave = (id, titulo, hoja) => ({
    id, titulo, hoja,
    campos: [].concat(...ALARMAS_ITEMS.map(([gid, gtit, items]) => items.map(([iid, label, fila]) => c(id + '_' + iid, label, 'check', fila, { grupo: gtit, opcional: true }))))
  });
  const ALARMAS = {
    id: 'alarmas-humo',
    titulo: 'Revisión de alarmas y detectores de humo',
    archivo: 'REGISTRO DE PRESIONES Y TEMPERATURA.xlsx',
    plantilla: 'presiones',
    registroPor: 'dia',
    descripcion: 'Revisiones semanales, mensuales y anuales de alarmas y detectores de humo en Nave 1 y Nave 2 de extrusión. Una hoja por mes.',
    secciones: [
      nave('n1', 'Nave 1 Extrusión', 'Alarmas y detectores de humo'),
      nave('n2', 'Nave 2 Extrusión', 'Alarmas y detectores de hum 2'),
      { id: 'obs', titulo: 'Observaciones', campos: [c('obs', 'Observaciones', 'texto', null, { opcional: true })] }
    ],
    blanco: ['Alarmas y detectores de humo', 'Alarmas y detectores de hum 2'],
    paginar(regs) {
      const paginas = [];
      const meses = Array.from(new Set(H.ordenar(regs).map((r) => r.fecha.slice(0, 7))));
      for (const ym of meses) {
        const delMes = regs.filter((r) => r.fecha.startsWith(ym));
        const [y, m] = ym.split('-').map(Number);
        const dias = H.diasMes(ym);
        for (const s of ALARMAS.secciones.filter((x) => x.hoja)) {
          const conDatos = delMes.filter((r) => H.tieneDatos(r, s.campos.map((x) => x.id)));
          if (!conDatos.length) continue;
          const ll = H.nuevo();
          ll.celdas.V7 = MESES[m - 1];
          ll.celdas.AB7 = y;
          for (let d = 29; d <= 31; d++) for (const fila of [8, 14, 19]) ll.celdas[H.ref(1 + d, fila)] = d <= dias ? d : '';
          const obs = [];
          for (let d = 1; d <= dias; d++) {
            const delDia = conDatos.filter((r) => +r.fecha.slice(8, 10) === d);
            for (const campo of s.campos) H.poner(ll, H.ref(1 + d, campo.fila), H.valor(campo, H.ultimo(delDia, campo.id)));
          }
          for (const r of H.ordenar(conDatos)) if (r.valores.obs) obs.push(H.fecha(r.fecha) + ': ' + r.valores.obs);
          if (obs.length) { ll.celdas.A22 = obs.join('   ·   '); ll.estilos.A22 = { ajustar: true }; }
          paginas.push({ hoja: s.hoja, nombre: (s.id === 'n1' ? 'Nave 1 ' : 'Nave 2 ') + MESES[m - 1].slice(0, 3) + ' ' + y, mes: ym, llenado: ll });
        }
      }
      return paginas;
    }
  };

  /* ======================================================================
     6) RUTINA DE ARRANQUE / PARO DE PLANTA (por evento)
     Las actividades y casillas se leen de la propia plantilla: cada casilla
     dibujada en el Excel es un campo "paloma".
     ====================================================================== */
  const HOJAS_PA = { arranque: 'RUTINA ARRANQUE NUEVA', paro: 'RUTINA PARO NUEVA' };
  const limpiar = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /** "COMPRESOR ASD 40, EXTRUSION" -> "Compresor ASD 40, Extrusión" (respeta siglas). */
  const MENORES = ['de', 'del', 'la', 'el', 'y', 'en'];
  const ACENTOS = { extrusion: 'extrusión', subestacion: 'subestación', area: 'área' };
  const tituloArea = (s) => limpiar(s).split(' ').map((w, i) => {
    if (/\d/.test(w) || (w.length <= 3 && !MENORES.includes(w.toLowerCase()))) return w;
    const base = w.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
    const l = w.toLowerCase().replace(base, ACENTOS[base] || base);
    return i && MENORES.includes(l) ? l : l.charAt(0).toUpperCase() + l.slice(1);
  }).join(' ');
  /** Lee áreas, actividades y casillas de la hoja. Se guarda en caché por hoja. */
  function estructuraPA(pl, tipo) {
    const h = P.hoja(pl, HOJAS_PA[tipo] || HOJAS_PA.arranque);
    if (h._pa) return h._pa;
    const angostas = new Set(); // columnas angostas donde van las casillas (C, E, G, I)
    h.cols.forEach((w, i) => { if (w < 100) angostas.add(i + 1); });
    const casillas = {}; // campoId -> [ids de forma]
    const info = {};
    for (const d of h.dibujos) {
      if (d.tipo !== 'forma' || d.geom !== 'rect' || !d.desde || d.w > 60 || d.h > 45) continue;
      let col = d.desde[0] + 1;
      const fila = d.desde[1] + 1;
      if (angostas.has(col)) col -= 1;
      // Si la casilla cae en una celda combinada, usar la esquina superior izquierda
      const g = h.mapa[H.ref(col, fila)];
      const ref = g ? H.ref(g.c1, g.r1) : H.ref(col, fila);
      const id = 'chk_' + ref;
      (casillas[id] = casillas[id] || []).push(d.id);
      info[id] = { ref, col: g ? g.c1 : col, fila: g ? g.r1 : fila };
    }
    // Áreas (columna A, combinadas)
    const areas = [];
    for (let r = 6; r <= h.filas.length; r++) {
      const g = h.mapa['A' + r];
      if (g && g.r1 !== r) continue;
      const nombre = limpiar(P.texto(h, 'A' + r));
      if (!nombre || /NOMBRE|COORDINADOR|____/.test(nombre)) continue;
      areas.push({ nombre, r1: r, r2: g ? g.r2 : r });
    }
    const secciones = areas.map((a, n) => {
      const campos = [];
      const ids = Object.keys(info).filter((id) => info[id].fila >= a.r1 && info[id].fila <= a.r2)
        .sort((x, y) => info[x].fila - info[y].fila || info[x].col - info[y].col);
      let matriz = null;
      for (const id of ids) {
        const { ref, col, fila } = info[id];
        let texto = limpiar(P.texto(h, ref));
        let grupo = null;
        if (!texto) {
          // Fila de equipo (p. ej. Extrusora 01): actividad = encabezado de la columna
          let rr = fila - 1;
          while (rr >= a.r1 && !limpiar(P.texto(h, H.ref(col, rr)))) rr--;
          const act = limpiar(P.texto(h, H.ref(col, rr)));
          const equipo = limpiar(P.texto(h, 'B' + fila));
          texto = equipo;
          grupo = act;
          matriz = matriz || { filas: [], columnas: [] };
          if (!matriz.filas.includes(equipo)) matriz.filas.push(equipo);
          if (!matriz.columnas.includes(act)) matriz.columnas.push(act);
        }
        campos.push({ id, label: texto, tipo: 'paloma', grupo, opcional: false, formas: casillas[id], equipo: grupo ? texto : null });
      }
      campos.push({ id: 'obs_' + a.r1, label: 'Observaciones y comentarios', tipo: 'texto', opcional: true, celda: 'J' + a.r1 });
      return { id: 'area' + n, titulo: tituloArea(a.nombre), campos, matriz };
    });
    h._pa = { hoja: h.nombre, secciones };
    return h._pa;
  }

  const PA = {
    id: 'paro-arranque',
    titulo: 'Rutina de arranque / paro de planta',
    archivo: 'RUTINAS PARO-ARRANQUE PLANTA.xlsx',
    plantilla: 'paro-arranque',
    registroPor: 'evento',
    conTurno: true,
    tipos: [{ id: 'arranque', nombre: 'Arranque de planta' }, { id: 'paro', nombre: 'Paro de planta' }],
    descripcion: 'Lista de verificación para arrancar o parar la planta: compresores, servicios, extrusoras, molinos, subestaciones.',
    firmas: [
      { id: 'coordinador', label: 'Coordinador de mantto.', linea: 'A31' },
      { id: 'tecnico', label: 'Técnico de mantenimiento', linea: 'F31', auto: 'inspector' }
    ],
    secciones(reg, pl) { return estructuraPA(pl, (reg && reg.tipo) || 'arranque').secciones; },
    paginar(regs, pl) {
      return H.ordenar(regs).map((r) => {
        const est = estructuraPA(pl, r.tipo || 'arranque');
        const h = P.hoja(pl, est.hoja);
        const ll = H.nuevo();
        ll.celdas.B3 = r.encabezado && r.encabezado.inspector || '';
        ll.celdas.B4 = M.nombreTurno(r.turno);
        ll.celdas.G4 = H.fechaLarga(r.fecha);
        for (const s of est.secciones) {
          for (const campo of s.campos) {
            const v = r.valores[campo.id];
            if (campo.tipo === 'paloma' && v) campo.formas.forEach((idForma) => { ll.formas[idForma] = '✓'; });
            if (campo.tipo === 'texto' && v) { ll.celdas[campo.celda] = v; ll.estilos[campo.celda] = { ajustar: true }; }
          }
        }
        // Firmas (imagen con firma y nombre) sobre las líneas
        for (const f of PA.firmas) {
          const d = r.firmas && r.firmas[f.id];
          if (!d || !d.img) continue;
          const rc = P.rect(h, f.linea);
          const w = Math.min(rc.w * 0.8, 300), alto = w * 0.42;
          ll.imagenes.push({ src: d.img, x: rc.x + (rc.w - w) / 2, y: rc.y + rc.h - alto - 2, w, h: alto });
        }
        const tipo = PA.tipos.find((t) => t.id === r.tipo) || PA.tipos[0];
        return { hoja: est.hoja, nombre: tipo.nombre.split(' ')[0] + ' ' + H.fecha(r.fecha).replace(/\//g, '-'), fechas: [r.fecha], llenado: ll };
      });
    }
  };

  window.FORMATOS = [SERV, PRES, ALARMAS, CFE, AGUA, PA];
})();
