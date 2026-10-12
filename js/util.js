/* Utilidades compartidas: DOM, fechas, íconos, avisos y diálogos. */
(function () {
  'use strict';

  const U = {};

  /* ---------- DOM ---------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /** Crea un elemento a partir de HTML (primer nodo). */
  U.html = (str) => {
    const t = document.createElement('template');
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  };

  U.debounce = (fn, ms) => {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    d.cancel = () => clearTimeout(t);
    return d;
  };

  U.uid = (prefijo) => {
    const r = Math.random().toString(36).slice(2, 8);
    const t = Date.now().toString(36);
    return (prefijo ? prefijo + '_' : '') + t + r;
  };

  U.clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- Fechas ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  U.pad = pad;
  U.hoyISO = (d) => {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  U.ahoraHM = (d) => { d = d || new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  U.sumarDias = (iso, n) => { const d = U.parseISO(iso); d.setDate(d.getDate() + n); return U.hoyISO(d); };

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  U.MESES = MESES;
  U.DIAS = DIAS;

  /** 2026-10-12 -> 12/10/2026 */
  U.fechaCorta = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  /** 2026-10-12 -> 12 oct 2026 */
  U.fechaMedia = (iso) => { if (!iso) return ''; const d = U.parseISO(iso); return d.getDate() + ' ' + MESES_C[d.getMonth()] + ' ' + d.getFullYear(); };
  /** 2026-10-12 -> lunes 12 de octubre de 2026 */
  U.fechaLarga = (iso) => { const d = U.parseISO(iso); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); };
  /** Solo acepta imágenes embebidas (firmas y fotos generadas por la app). */
  U.srcImagen = (s) => (typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : '');
  U.capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  U.fechaHora = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    return U.fechaCorta(U.hoyISO(d)) + ' ' + U.ahoraHM(d);
  };

  /** Rango rápido -> {desde, hasta} */
  U.rangoRapido = (clave) => {
    const hoy = U.hoyISO();
    const d = new Date();
    switch (clave) {
      case 'hoy': return { desde: hoy, hasta: hoy };
      case 'ayer': { const a = U.sumarDias(hoy, -1); return { desde: a, hasta: a }; }
      case 'semana': {
        const dow = (d.getDay() + 6) % 7; // lunes = 0
        return { desde: U.sumarDias(hoy, -dow), hasta: hoy };
      }
      case '7d': return { desde: U.sumarDias(hoy, -6), hasta: hoy };
      case '30d': return { desde: U.sumarDias(hoy, -29), hasta: hoy };
      case 'mes': return { desde: hoy.slice(0, 8) + '01', hasta: hoy };
      case 'mesPasado': {
        const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const u = new Date(d.getFullYear(), d.getMonth(), 0);
        return { desde: U.hoyISO(p), hasta: U.hoyISO(u) };
      }
      case 'anio': return { desde: hoy.slice(0, 4) + '-01-01', hasta: hoy };
      case 'todo': return { desde: '2000-01-01', hasta: '2999-12-31' };
      default: return { desde: hoy, hasta: hoy };
    }
  };

  /** Determina el turno según la hora y la tabla de turnos. */
  U.turnoActual = (turnos, d) => {
    d = d || new Date();
    const min = d.getHours() * 60 + d.getMinutes();
    const aMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
    for (const t of turnos || []) {
      const i = aMin(t.inicio), f = aMin(t.fin);
      if (i <= f ? (min >= i && min < f) : (min >= i || min < f)) return t.id;
    }
    return (turnos && turnos[0] && turnos[0].id) || '1';
  };

  /* ---------- Números ---------- */
  U.aNumero = (v) => {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const n = parseFloat(String(v).replace(',', '.').trim());
    return isFinite(n) ? n : null;
  };
  U.fmtNum = (n, dec) => {
    if (n == null || n === '') return '';
    const v = Number(n);
    if (!isFinite(v)) return String(n);
    if (dec == null) return String(Math.round(v * 100) / 100);
    return v.toFixed(dec);
  };

  /* ---------- SHA-256 (para el modo local y el bloqueo) ---------- */
  U.sha256 = async (texto) => {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return sha256Puro(texto);
  };
  // Implementación de respaldo cuando crypto.subtle no está disponible.
  function sha256Puro(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = Math.pow(2, 32);
    let result = '';
    const words = [];
    const bitLen = ascii.length * 8;
    const hash = [], k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii = unescape(encodeURIComponent(ascii)) + '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = (bitLen);
    let h = hash.slice(0, 8);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const oldHash = h;
      h = h.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = h[0], e = h[4];
        const temp1 = h[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & h[5]) ^ ((~e) & h[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
        h = [(temp1 + temp2) | 0].concat(h);
        h[4] = (h[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) h[i] = (h[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (h[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  /* ---------- Almacenamiento local seguro ---------- */
  U.lsGet = (k, def) => {
    try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  };
  U.lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio o bloqueado */ } };
  U.lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } };

  /* ---------- Íconos (trazos estilo Lucide, 24x24) ---------- */
  const P = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    captura: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    nube: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    nubeOff: '<path d="m2 2 20 20"/><path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2"/><path d="M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10 5.07"/>',
    nubeOk: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m9 13 2 2 4-4"/>',
    base: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    excel: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 12 4 6"/><path d="m13 12-4 6"/>',
    grafica: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
    ajustes: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    candado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    ojoOff: '<path d="m2 2 20 20"/><path d="M6.7 6.7C3.9 8.6 2 12 2 12s3.5 7 10 7c2 0 3.8-.6 5.3-1.5"/><path d="M10.6 5.1c.5-.1.9-.1 1.4-.1 6.5 0 10 7 10 7s-.8 1.6-2.3 3.3"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mas: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    izq: '<path d="m15 18-6-6 6-6"/>',
    der: '<path d="m9 18 6-6-6-6"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>',
    arriba: '<path d="m18 15-6-6-6 6"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    basura: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    editar: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    camara: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    usuario: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    tabla: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
    tarjeta: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/>',
    firma: '<path d="M3 17c3-4 5-11 8-11 2 0 0 9 2 9s3-4 4-4 1 3 3 3"/><path d="M3 21h18"/>',
    guardar: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    zoomMas: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
    zoomMenos: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
    filtro: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    apagar: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
    luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    termometro: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
    lista: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    historial: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    hoja: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/>',
    rayo: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    sync: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    tableta: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
    escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'
  };
  U.icon = (nombre, clase) =>
    '<svg class="ico ' + (clase || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[nombre] || '') + '</svg>';

  /* ---------- Avisos ---------- */
  U.toast = (msg, tipo, ms) => {
    let cont = U.$('#toasts');
    if (!cont) { cont = U.html('<div id="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(cont); }
    const ic = tipo === 'error' ? 'alerta' : tipo === 'aviso' ? 'info' : 'check';
    const t = U.html('<div class="toast toast-' + (tipo || 'ok') + '">' + U.icon(ic) + '<span>' + U.esc(msg) + '</span></div>');
    cont.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, ms || 3200);
  };

  /* ---------- Diálogos ---------- */
  /**
   * Abre un diálogo modal. contenido puede ser HTML o un elemento.
   * botones: [{texto, clase, valor, accion}] — devuelve una promesa con el valor.
   */
  U.modal = ({ titulo, contenido, botones, ancho, clase, alAbrir }) => new Promise((resolve) => {
    const fondo = U.html(
      '<div class="modal-fondo" role="dialog" aria-modal="true">' +
        '<div class="modal ' + (clase || '') + '" style="' + (ancho ? 'max-width:' + ancho + 'px' : '') + '">' +
          (titulo ? '<div class="modal-cab"><h2>' + U.esc(titulo) + '</h2><button class="btn-icono modal-cerrar" aria-label="Cerrar">' + U.icon('x') + '</button></div>' : '') +
          '<div class="modal-cuerpo"></div>' +
          '<div class="modal-pie"></div>' +
        '</div>' +
      '</div>');
    const cuerpo = U.$('.modal-cuerpo', fondo);
    if (typeof contenido === 'string') cuerpo.innerHTML = contenido; else if (contenido) cuerpo.appendChild(contenido);
    const pie = U.$('.modal-pie', fondo);
    let cerrado = false;
    const cerrar = (valor) => {
      if (cerrado) return;
      cerrado = true;
      fondo.classList.remove('visible');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => fondo.remove(), 180);
      resolve(valor);
    };
    (botones || [{ texto: 'Aceptar', clase: 'btn-primario', valor: true }]).forEach((b) => {
      const btn = U.html('<button class="btn ' + (b.clase || '') + '">' + (b.icono ? U.icon(b.icono) : '') + '<span>' + U.esc(b.texto) + '</span></button>');
      btn.addEventListener('click', async () => {
        if (b.accion) {
          const r = await b.accion(cuerpo);
          if (r === false) return;
          cerrar(r === undefined ? b.valor : r);
        } else cerrar(b.valor);
      });
      pie.appendChild(btn);
    });
    if (!pie.children.length) pie.remove();
    const onKey = (e) => { if (e.key === 'Escape') cerrar(undefined); };
    document.addEventListener('keydown', onKey);
    const x = U.$('.modal-cerrar', fondo);
    if (x) x.addEventListener('click', () => cerrar(undefined));
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(undefined); });
    document.body.appendChild(fondo);
    requestAnimationFrame(() => fondo.classList.add('visible'));
    if (alAbrir) alAbrir(cuerpo, cerrar);
  });

  U.confirmar = (titulo, mensaje, textoSi, peligro) => U.modal({
    titulo,
    contenido: '<p class="modal-texto">' + mensaje + '</p>',
    ancho: 460,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', valor: false },
      { texto: textoSi || 'Aceptar', clase: peligro ? 'btn-peligro' : 'btn-primario', valor: true }
    ]
  }).then((v) => v === true);

  /* ---------- Descarga de archivos ---------- */
  U.descargar = (blob, nombre) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  /** Comprime una imagen (File) a JPEG con lado máximo dado. Devuelve dataURL. */
  U.comprimirImagen = (file, lado, calidad) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const esc = Math.min(1, (lado || 1280) / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * esc);
      c.height = Math.round(img.height * esc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', calidad || 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });

  window.U = U;
})();
