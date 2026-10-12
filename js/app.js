/* Arranque, acceso con contraseña, estructura y navegación. */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const App = window.App = { inspector: U.lsGet('ps_inspector', ''), limpiarVista: null };

  /* ---------------- Marca ---------------- */
  function pintarMarca() {
    document.title = (CFG.nombreApp || 'Rutinas de Inspección') + ' · ' + (CFG.empresa || '');
    const logo = CFG.logo ? '<img src="' + U.esc(CFG.logo) + '" alt="">' : U.icon('captura');
    U.$('#acceso-logo').innerHTML = logo;
    U.$('#marca-logo').innerHTML = CFG.logo ? logo : U.icon('captura', 'sm');
    U.$('#acceso-empresa').textContent = CFG.empresa || '';
    U.$('#marca-empresa').textContent = CFG.empresa || '';
    U.$('#acceso-titulo').textContent = CFG.nombreApp || 'Rutinas de Inspección';
    U.$('#marca-app').textContent = CFG.nombreApp || 'Rutinas de Inspección';
    U.$('#acceso-ver').innerHTML = U.icon('ojo');
    U.$('#acceso-pie').innerHTML = DB.modo === 'nube'
      ? U.icon('escudo', 'sm') + '<span>Acceso protegido · datos en la nube</span>'
      : U.icon('tableta', 'sm') + '<span>Modo local · los datos se guardan en este dispositivo</span>';

    const nav = {
      inicio: ['inicio', 'Inicio'], capturar: ['captura', 'Capturar'], registros: ['base', 'Registros'],
      exportar: ['imprimir', 'Exportar e imprimir', 'Imprimir'], graficas: ['grafica', 'Tendencias'], config: ['ajustes', 'Configuración', 'Ajustes']
    };
    U.$$('#navegacion [data-ruta]').forEach((a) => {
      const [ic, txt, corto] = nav[a.dataset.ruta];
      a.innerHTML = U.icon(ic) + (corto ? '<span class="largo">' + txt + '</span><span class="corto">' + corto + '</span>' : '<span>' + txt + '</span>');
      a.title = txt;
    });
    U.$('#nav-salir').innerHTML = U.icon('salir') + '<span>Cerrar sesión</span>';
    U.$('#nav-pie').innerHTML = U.esc(CFG.empresa || '') + ' · ' + (DB.modo === 'nube' ? 'Nube conectada' : 'Modo local') + '<br>v1.0';
  }

  /* ---------------- Tema ---------------- */
  function pintarTema() {
    const t = U.lsGet('ps_tema', '');
    const oscuro = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    U.$('#btn-tema').innerHTML = U.icon(oscuro ? 'sol' : 'luna');
    U.$('#btn-tema').setAttribute('aria-label', oscuro ? 'Usar tema claro' : 'Usar tema oscuro');
  }
  function alternarTema() {
    const t = U.lsGet('ps_tema', '');
    const oscuro = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const nuevo = oscuro ? 'light' : 'dark';
    U.lsSet('ps_tema', nuevo);
    document.documentElement.setAttribute('data-theme', nuevo);
    pintarTema();
    document.dispatchEvent(new CustomEvent('tema'));
  }

  /* ---------------- Sincronización ---------------- */
  function pintarSync(s) {
    const el = U.$('#estado-sync');
    let cls, ic, txt, tip;
    if (s.modo === 'local') { cls = 'local'; ic = 'tableta'; txt = 'Modo local'; tip = 'Los datos se guardan solo en este dispositivo. Configura la nube en js/config.js (ver README).'; }
    else if (!s.online) { cls = 'off'; ic = 'nubeOff'; txt = 'Sin conexión'; tip = 'Sin internet. Lo que captures se guarda en la tableta y se sube solo al regresar la señal.'; }
    else if (s.pendientes > 0) { cls = 'pend'; ic = 'sync'; txt = 'Sincronizando…'; tip = 'Subiendo cambios a la nube'; }
    else { cls = 'ok'; ic = 'nubeOk'; txt = 'En la nube'; tip = 'Todo está guardado en la nube'; }
    el.className = 'estado-sync ' + cls;
    el.title = tip;
    el.innerHTML = U.icon(ic, 'sm') + '<span class="txt">' + txt + '</span>';
  }

  /* ---------------- Inspector ---------------- */
  App.iniciales = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  function pintarInspector() {
    const n = App.inspector;
    U.$('#btn-inspector').innerHTML = '<span class="avatar">' + U.esc(App.iniciales(n)) + '</span><span class="n">' + U.esc(n || 'Elegir inspector') + '</span>';
  }

  App.elegirInspector = async (obligatorio) => {
    const lista = (M.config.inspectores || []).slice().sort((a, b) => a.localeCompare(b));
    const cuerpo = U.html(
      '<div>' +
        '<p class="modal-texto" style="margin-bottom:14px">Tu nombre se anota automáticamente en cada rutina que captures.</p>' +
        (lista.length ? '<div class="chips" style="margin-bottom:16px">' + lista.map((n) => '<button class="chip" data-n="' + U.esc(n) + '" aria-pressed="' + (n === App.inspector) + '">' + U.icon('usuario', 'sm') + U.esc(n) + '</button>').join('') + '</div>' : '') +
        '<div class="campo"><label for="nuevo-insp">' + (lista.length ? 'Otro nombre' : 'Nombre completo') + '</label>' +
        '<input class="input" id="nuevo-insp" autocomplete="name" placeholder="Ej. Juan Pérez" value=""></div>' +
      '</div>');
    let elegido = App.inspector;
    cuerpo.addEventListener('click', (e) => {
      const c = e.target.closest('[data-n]');
      if (!c) return;
      elegido = c.dataset.n;
      U.$$('[data-n]', cuerpo).forEach((x) => x.setAttribute('aria-pressed', x === c));
      U.$('#nuevo-insp', cuerpo).value = '';
    });
    const r = await U.modal({
      titulo: '¿Quién realiza la inspección?',
      contenido: cuerpo,
      ancho: 520,
      botones: [
        ...(obligatorio ? [] : [{ texto: 'Cancelar', clase: 'btn-secundario', valor: null }]),
        {
          texto: 'Continuar', clase: 'btn-primario', accion: (c) => {
            const otro = U.$('#nuevo-insp', c).value.trim().replace(/\s+/g, ' ');
            const n = otro || elegido;
            if (!n) { U.$('#nuevo-insp', c).focus(); U.toast('Escribe o elige un nombre', 'aviso'); return false; }
            return n;
          }
        }
      ]
    });
    if (!r) return App.inspector;
    App.inspector = r;
    U.lsSet('ps_inspector', r);
    pintarInspector();
    if (!(M.config.inspectores || []).includes(r)) {
      M.config.inspectores = (M.config.inspectores || []).concat(r);
      DB.guardarConfig(M.config);
    }
    return r;
  };

  App.requerirInspector = async () => App.inspector || App.elegirInspector(true);

  /* ---------------- Configuración compartida ---------------- */
  App.aplicarConfig = (datos) => {
    M.config = Object.assign(U.clone(M.CONFIG_DEFECTO), datos || {});
    if (!Array.isArray(M.config.turnos) || !M.config.turnos.length) M.config.turnos = U.clone(M.CONFIG_DEFECTO.turnos);
  };

  /* ---------------- Rutas ---------------- */
  const rutas = [
    { re: /^\/?$/, vista: 'inicio', nav: 'inicio' },
    { re: /^\/inicio$/, vista: 'inicio', nav: 'inicio' },
    { re: /^\/capturar$/, vista: 'elegirFormato', nav: 'capturar' },
    { re: /^\/nuevo\/([^/]+)$/, vista: 'captura', nav: 'capturar', p: (m) => ({ nuevo: m[1] }) },
    { re: /^\/editar\/([^/]+)$/, vista: 'captura', nav: 'capturar', p: (m) => ({ id: decodeURIComponent(m[1]) }) },
    { re: /^\/registros$/, vista: 'registros', nav: 'registros' },
    { re: /^\/ver\/([^/]+)$/, vista: 'visor', nav: 'registros', p: (m) => ({ id: decodeURIComponent(m[1]) }) },
    { re: /^\/exportar$/, vista: 'exportar', nav: 'exportar' },
    { re: /^\/graficas$/, vista: 'graficas', nav: 'graficas' },
    { re: /^\/config$/, vista: 'config', nav: 'config' }
  ];

  App.ir = (ruta, reemplazar) => {
    if (reemplazar) { history.replaceState(null, '', '#' + ruta); enrutar(); }
    else location.hash = '#' + ruta;
  };

  async function enrutar() {
    const h = decodeURI(location.hash.replace(/^#/, '')).split('?')[0];
    const consulta = new URLSearchParams(location.hash.split('?')[1] || '');
    let r = rutas.find((x) => x.re.test(h));
    if (!r) { r = rutas[0]; }
    const m = h.match(r.re);
    const params = Object.assign({}, r.p ? r.p(m) : {}, { consulta });
    if (App.limpiarVista) { try { App.limpiarVista(); } catch (e) { console.warn(e); } App.limpiarVista = null; }
    U.$$('#navegacion [data-ruta]').forEach((a) => {
      if (a.dataset.ruta === r.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    // Cada vista recibe un contenedor nuevo, así sus eventos se van con ella.
    const main = document.createElement('div');
    main.innerHTML = '<div class="vacio"><div class="spinner" style="margin:40px auto"></div></div>';
    U.$('#vista').replaceChildren(main);
    window.scrollTo(0, 0);
    try {
      const limpiar = await Vistas[r.vista](main, params);
      if (typeof limpiar === 'function') App.limpiarVista = limpiar;
    } catch (e) {
      console.error(e);
      main.innerHTML = '<div class="tarjeta vacio">' + U.icon('alerta') + '<p><b>Ocurrió un error al abrir esta sección.</b></p><p class="t-sm">' + U.esc(e.message || e) + '</p></div>';
    }
  }

  /* ---------------- Acceso ---------------- */
  function mostrarAcceso() {
    if (App.limpiarVista) { try { App.limpiarVista(); } catch (e) { /* nada */ } App.limpiarVista = null; }
    if (quitarConfig) { quitarConfig(); quitarConfig = null; }
    U.$('#vista').replaceChildren();
    U.$('#app').hidden = true;
    U.$('#pantalla-acceso').hidden = false;
    U.$('#acceso-pass').value = '';
    setTimeout(() => U.$('#acceso-pass').focus(), 50);
  }

  let appMontada = false;
  let quitarConfig = null;
  async function mostrarApp() {
    U.$('#pantalla-acceso').hidden = true;
    U.$('#app').hidden = false;
    App.aplicarConfig(await DB.obtenerConfig());
    if (quitarConfig) quitarConfig();
    quitarConfig = DB.suscribirConfig((d) => { if (d) App.aplicarConfig(d); });
    pintarInspector();
    if (!appMontada) {
      appMontada = true;
      window.addEventListener('hashchange', enrutar);
    }
    await enrutar();
    if (!App.inspector) App.elegirInspector(true);
  }

  function prepararAcceso() {
    const form = U.$('#form-acceso');
    const pass = U.$('#acceso-pass');
    const err = U.$('#acceso-error');
    const btn = U.$('#acceso-btn');
    U.$('#acceso-ver').addEventListener('click', () => {
      const ver = pass.type === 'password';
      pass.type = ver ? 'text' : 'password';
      U.$('#acceso-ver').innerHTML = U.icon(ver ? 'ojoOff' : 'ojo');
      U.$('#acceso-ver').setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
      pass.focus();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.innerHTML = '';
      btn.disabled = true;
      btn.textContent = 'Verificando…';
      try {
        await DB.entrar(pass.value);
        if (DB.modo === 'local') await mostrarApp();
      } catch (ex) {
        err.innerHTML = U.icon('alerta', 'sm') + U.esc(ex.message);
        pass.select();
      }
      btn.disabled = false;
      btn.textContent = 'Entrar';
    });
  }

  App.salir = async () => {
    const ok = await U.confirmar('Cerrar sesión', 'Se pedirá la contraseña para volver a entrar en este dispositivo.', 'Cerrar sesión');
    if (!ok) return;
    await DB.salir();
    if (DB.modo === 'local') mostrarAcceso();
  };

  /* ---------------- PWA ---------------- */
  App.instalar = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); App.instalar = e; });
  function registrarSW() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
    }
  }

  /* ---------------- Arranque ---------------- */
  async function iniciar() {
    try {
      await DB.init();
    } catch (e) {
      console.error(e);
      U.$('#arranque').innerHTML = '<div class="tarjeta vacio" style="max-width:420px">' + U.icon('alerta') + '<p><b>No se pudo iniciar la aplicación.</b></p><p class="t-sm">' + U.esc(e.message) + '</p></div>';
      return;
    }
    pintarMarca();
    pintarTema();
    prepararAcceso();
    DB.alCambiarSync(pintarSync);
    U.$('#btn-tema').addEventListener('click', alternarTema);
    U.$('#btn-inspector').addEventListener('click', () => App.elegirInspector(false));
    U.$('#nav-salir').addEventListener('click', (e) => { e.preventDefault(); App.salir(); });
    DB.alCambiarSesion((dentro) => {
      U.$('#arranque').hidden = true;
      if (dentro) mostrarApp(); else mostrarAcceso();
    });
    registrarSW();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
