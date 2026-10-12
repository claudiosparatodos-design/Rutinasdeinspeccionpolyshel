/* ==========================================================================
   DEFINICIÓN DE LOS FORMATOS
   --------------------------------------------------------------------------
   Cada formato describe, en el mismo orden que la hoja impresa:
     - encabezado: datos generales (fecha, turno, inspector...)
     - tabla:      filas (máquinas) x columnas (mediciones / verificaciones)
     - pie:        observaciones generales
     - firmas:     bloques de firma al final de la hoja
   Con esta misma definición se dibuja la captura en tableta, la vista
   previa / impresión y el archivo de Excel, así que los tres salen iguales.

   Tipos de columna:
     'numero'   valor numérico (teclado numérico en la tableta). Admite min/max
                para marcar en rojo lo que esté fuera de rango.
     'check'    verificación: ✓ correcto · ✗ anomalía · N/A no aplica
     'opciones' lista corta de opciones (botones grandes en la tableta)
     'hora'     hora (se llena sola al capturar la máquina)
     'texto'    texto libre (observaciones)

   En cada fila se puede usar:
     limites: { columna: [min, max] }  límites propios de esa máquina
     omitir:  ['columna', ...]         celdas que no aplican (salen sombreadas)

   NOTA: los dos formatos de abajo son DE EJEMPLO mientras se digitalizan los
   formatos oficiales de la planta.
   ========================================================================== */
window.FORMATOS = [
  {
    id: 'maquinas-proceso',
    codigo: 'FO-MTO-001',
    revision: '00',
    vigencia: '01/10/2026',
    titulo: 'RUTINA DE INSPECCIÓN DE MÁQUINAS DE PROCESO',
    subtitulo: 'Inyectoras y extrusoras',
    area: 'Mantenimiento',
    ejemplo: true,
    hoja: { orientacion: 'horizontal' },
    encabezado: [
      { id: 'fecha', label: 'Fecha', tipo: 'fecha', auto: 'hoy' },
      { id: 'turno', label: 'Turno', tipo: 'turno', auto: 'turno' },
      { id: 'hora_inicio', label: 'Hora de inicio', tipo: 'hora', auto: 'ahora' },
      { id: 'hora_fin', label: 'Hora de término', tipo: 'hora', auto: 'alFinalizar' },
      { id: 'inspector', label: 'Inspector', tipo: 'texto', auto: 'inspector', ancho: 2 }
    ],
    tabla: {
      titulo: 'Máquina',
      anchoFila: 20,
      filas: [
        { id: 'iny-01', nombre: 'Inyectora 01', codigo: 'INY-01' },
        { id: 'iny-02', nombre: 'Inyectora 02', codigo: 'INY-02' },
        { id: 'iny-03', nombre: 'Inyectora 03', codigo: 'INY-03' },
        { id: 'iny-04', nombre: 'Inyectora 04', codigo: 'INY-04' },
        { id: 'ext-01', nombre: 'Extrusora 01', codigo: 'EXT-01', omitir: ['ciclo'], limites: { presion: [150, 220] } },
        { id: 'ext-02', nombre: 'Extrusora 02', codigo: 'EXT-02', omitir: ['ciclo'], limites: { presion: [150, 220] } },
        { id: 'ext-03', nombre: 'Extrusora 03', codigo: 'EXT-03', omitir: ['ciclo'], limites: { presion: [150, 220] } }
      ],
      columnas: [
        { id: 'hora', label: 'Hora', tipo: 'hora', auto: 'ahora', ancho: 6 },
        { id: 'estado', label: 'Estado', tipo: 'opciones', opciones: ['Opera', 'Paro', 'Mtto'], ancho: 6.5 },
        { id: 'z1', label: 'Z1', grupo: 'Temperatura de barril (°C)', unidad: '°C', tipo: 'numero', min: 180, max: 240, ancho: 5.5 },
        { id: 'z2', label: 'Z2', grupo: 'Temperatura de barril (°C)', unidad: '°C', tipo: 'numero', min: 180, max: 240, ancho: 5.5 },
        { id: 'z3', label: 'Z3', grupo: 'Temperatura de barril (°C)', unidad: '°C', tipo: 'numero', min: 180, max: 240, ancho: 5.5 },
        { id: 'z4', label: 'Z4', grupo: 'Temperatura de barril (°C)', unidad: '°C', tipo: 'numero', min: 180, max: 240, ancho: 5.5 },
        { id: 't_aceite', label: 'Temp. aceite', unidad: '°C', tipo: 'numero', min: 35, max: 55, ancho: 7 },
        { id: 'presion', label: 'Presión hidráulica', unidad: 'bar', tipo: 'numero', min: 80, max: 140, ancho: 8 },
        { id: 'ciclo', label: 'Tiempo de ciclo', unidad: 's', tipo: 'numero', min: 10, max: 45, decimales: 1, ancho: 7 },
        { id: 'agua', label: 'Agua enfriam.', unidad: '°C', tipo: 'numero', min: 10, max: 20, ancho: 7 },
        { id: 'ruido', label: 'Ruido / vibración', grupo: 'Condición', tipo: 'check', ancho: 7 },
        { id: 'fugas', label: 'Fugas', grupo: 'Condición', tipo: 'check', ancho: 6 },
        { id: 'limpieza', label: 'Limpieza', grupo: 'Condición', tipo: 'check', ancho: 6.5 },
        { id: 'obs', label: 'Observaciones', tipo: 'texto', ancho: 22 }
      ]
    },
    pie: [
      { id: 'observaciones', label: 'Observaciones generales / acciones tomadas', tipo: 'textarea', lineas: 3 }
    ],
    notas: 'Criterio: ✓ Correcto · ✗ Anomalía (describir en observaciones) · N/A No aplica. Los valores fuera de rango se marcan en rojo.',
    firmas: [
      { id: 'realizo', label: 'Realizó', sub: 'Inspector de mantenimiento', auto: 'inspector' },
      { id: 'reviso', label: 'Revisó', sub: 'Supervisor de mantenimiento' }
    ]
  },
  {
    id: 'servicios-auxiliares',
    codigo: 'FO-MTO-002',
    revision: '00',
    vigencia: '01/10/2026',
    titulo: 'RUTINA DE INSPECCIÓN DE SERVICIOS AUXILIARES',
    subtitulo: 'Compresores, chillers y sistema de enfriamiento',
    area: 'Mantenimiento',
    ejemplo: true,
    hoja: { orientacion: 'horizontal' },
    encabezado: [
      { id: 'fecha', label: 'Fecha', tipo: 'fecha', auto: 'hoy' },
      { id: 'turno', label: 'Turno', tipo: 'turno', auto: 'turno' },
      { id: 'hora_inicio', label: 'Hora de inicio', tipo: 'hora', auto: 'ahora' },
      { id: 'hora_fin', label: 'Hora de término', tipo: 'hora', auto: 'alFinalizar' },
      { id: 'inspector', label: 'Inspector', tipo: 'texto', auto: 'inspector', ancho: 2 }
    ],
    tabla: {
      titulo: 'Equipo',
      anchoFila: 22,
      filas: [
        { id: 'comp-01', nombre: 'Compresor 01', codigo: 'CMP-01', limites: { temperatura: [70, 95] } },
        { id: 'comp-02', nombre: 'Compresor 02', codigo: 'CMP-02', limites: { temperatura: [70, 95] } },
        { id: 'secador', nombre: 'Secador de aire', codigo: 'SEC-01', limites: { temperatura: [2, 10] }, omitir: ['nivel_aceite'] },
        { id: 'chiller-01', nombre: 'Chiller 01', codigo: 'CHL-01', limites: { temperatura: [7, 12], presion: [40, 70] }, omitir: ['drenado'] },
        { id: 'chiller-02', nombre: 'Chiller 02', codigo: 'CHL-02', limites: { temperatura: [7, 12], presion: [40, 70] }, omitir: ['drenado'] },
        { id: 'torre', nombre: 'Torre de enfriamiento', codigo: 'TE-01', limites: { temperatura: [25, 32] }, omitir: ['presion', 'nivel_aceite', 'drenado'] },
        { id: 'bomba-ah', nombre: 'Bomba de agua helada', codigo: 'BAH-01', limites: { presion: [30, 50] }, omitir: ['temperatura', 'drenado'] }
      ],
      columnas: [
        { id: 'hora', label: 'Hora', tipo: 'hora', auto: 'ahora', ancho: 6 },
        { id: 'estado', label: 'Estado', tipo: 'opciones', opciones: ['Opera', 'Paro', 'Mtto'], ancho: 6.5 },
        { id: 'presion', label: 'Presión', unidad: 'psi', tipo: 'numero', min: 100, max: 125, ancho: 7 },
        { id: 'temperatura', label: 'Temperatura', unidad: '°C', tipo: 'numero', ancho: 8 },
        { id: 'horometro', label: 'Horómetro', unidad: 'h', tipo: 'numero', decimales: 0, ancho: 8 },
        { id: 'nivel_aceite', label: 'Nivel de aceite', grupo: 'Verificación', tipo: 'check', ancho: 7 },
        { id: 'drenado', label: 'Drenado de condensados', grupo: 'Verificación', tipo: 'check', ancho: 8.5 },
        { id: 'fugas', label: 'Fugas', grupo: 'Verificación', tipo: 'check', ancho: 6 },
        { id: 'ruido', label: 'Ruido / vibración', grupo: 'Verificación', tipo: 'check', ancho: 7 },
        { id: 'obs', label: 'Observaciones', tipo: 'texto', ancho: 30 }
      ]
    },
    pie: [
      { id: 'observaciones', label: 'Observaciones generales / acciones tomadas', tipo: 'textarea', lineas: 3 }
    ],
    notas: 'Criterio: ✓ Correcto · ✗ Anomalía (describir en observaciones) · N/A No aplica. Los valores fuera de rango se marcan en rojo.',
    firmas: [
      { id: 'realizo', label: 'Realizó', sub: 'Inspector de mantenimiento', auto: 'inspector' },
      { id: 'reviso', label: 'Revisó', sub: 'Supervisor de mantenimiento' }
    ]
  }
];
