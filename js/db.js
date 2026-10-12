/* ==========================================================================
   Capa de datos.
   - MODO NUBE: Firebase (Authentication + Firestore). Firestore guarda una
     copia en la tableta, así que se puede capturar sin internet y se
     sincroniza solo al recuperar la señal.
   - MODO LOCAL: si no hay configuración de Firebase, todo se guarda en el
     navegador (IndexedDB) de este dispositivo.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const DB = {
    modo: CFG.firebase && CFG.firebase.apiKey ? 'nube' : 'local',
    usuario: null
  };

  /* ---------------- Estado de sincronización ---------------- */
  const sync = { online: navigator.onLine, pendientes: 0, oyentes: new Set() };
  const avisarSync = () => sync.oyentes.forEach((fn) => fn({ online: sync.online, pendientes: sync.pendientes, modo: DB.modo }));
  window.addEventListener('online', () => { sync.online = true; avisarSync(); });
  window.addEventListener('offline', () => { sync.online = false; avisarSync(); });
  DB.alCambiarSync = (fn) => { sync.oyentes.add(fn); fn({ online: sync.online, pendientes: sync.pendientes, modo: DB.modo }); return () => sync.oyentes.delete(fn); };
  const seguir = (promesa) => {
    sync.pendientes++; avisarSync();
    return promesa.finally(() => { sync.pendientes = Math.max(0, sync.pendientes - 1); avisarSync(); });
  };

  const limpiar = (o) => JSON.parse(JSON.stringify(o)); // quita undefined / funciones

  /* ======================= MODO LOCAL (IndexedDB) ======================= */
  const IDB = {
    db: null,
    abrir() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('polyshel-inspeccion', 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('registros')) d.createObjectStore('registros', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }).createIndex('registroId', 'registroId');
          if (!d.objectStoreNames.contains('config')) d.createObjectStore('config', { keyPath: 'id' });
        };
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async op(store, modo, fn) {
      const d = await this.abrir();
      return new Promise((res, rej) => {
        const tx = d.transaction(store, modo);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = () => rej(tx.error);
      });
    },
    put(store, obj) { return this.op(store, 'readwrite', (s) => s.put(obj)); },
    get(store, id) { return this.op(store, 'readonly', (s) => s.get(id)); },
    del(store, id) { return this.op(store, 'readwrite', (s) => s.delete(id)); },
    all(store) { return this.op(store, 'readonly', (s) => s.getAll()); },
    porIndice(store, indice, valor) { return this.op(store, 'readonly', (s) => s.index(indice).getAll(valor)); }
  };
  const localOyentes = new Set();
  const avisarLocal = () => localOyentes.forEach((fn) => fn());

  /* ======================= MODO NUBE (Firebase) ======================= */
  let F, app, auth, fs;

  DB.init = async () => {
    if (DB.modo === 'nube') {
      F = window.FirebaseSDK;
      if (!F) throw new Error('No se cargó el SDK de Firebase');
      app = F.initializeApp(CFG.firebase);
      auth = F.getAuth(app);
      try { await F.setPersistence(auth, F.browserLocalPersistence); } catch (e) { /* sin persistencia */ }
      try {
        fs = F.initializeFirestore(app, {
          localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
          ignoreUndefinedProperties: true
        });
      } catch (e) {
        fs = F.initializeFirestore(app, { ignoreUndefinedProperties: true });
      }
    } else {
      await IDB.abrir();
    }
  };

  /* ---------------- Acceso ---------------- */
  DB.alCambiarSesion = (fn) => {
    if (DB.modo === 'nube') {
      return F.onAuthStateChanged(auth, (u) => { DB.usuario = u; fn(!!u); });
    }
    const ok = U.lsGet('ps_sesion_local', false);
    DB.usuario = ok ? { email: 'local' } : null;
    fn(!!ok);
    return () => {};
  };

  DB.entrar = async (password) => {
    if (DB.modo === 'nube') {
      try {
        await F.signInWithEmailAndPassword(auth, CFG.cuentaPlanta, password);
      } catch (e) {
        const c = e && e.code || '';
        if (c.includes('network')) throw new Error('Sin conexión. La primera vez se necesita internet para entrar.');
        if (c.includes('too-many-requests')) throw new Error('Demasiados intentos. Espera unos minutos.');
        if (c.includes('user-not-found') || c.includes('invalid-email')) throw new Error('La cuenta de la planta no existe en Firebase. Revisa README.md.');
        throw new Error('Contraseña incorrecta');
      }
    } else {
      const h = await U.sha256(password);
      const guardado = U.lsGet('ps_hash_local', CFG.hashLocal);
      if (h !== guardado) throw new Error('Contraseña incorrecta');
      U.lsSet('ps_sesion_local', true);
      DB.usuario = { email: 'local' };
    }
    // Huella para desbloquear la pantalla sin internet.
    U.lsSet('ps_hash_bloqueo', await U.sha256(password));
  };

  DB.salir = async () => {
    U.lsDel('ps_hash_bloqueo');
    if (DB.modo === 'nube') await F.signOut(auth);
    else { U.lsDel('ps_sesion_local'); DB.usuario = null; }
  };

  DB.cambiarPassword = async (actual, nueva) => {
    if (!nueva || nueva.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    if (DB.modo === 'nube') {
      const cred = F.EmailAuthProvider.credential(CFG.cuentaPlanta, actual);
      try { await F.reauthenticateWithCredential(auth.currentUser, cred); } catch (e) { throw new Error('La contraseña actual no es correcta'); }
      await F.updatePassword(auth.currentUser, nueva);
    } else {
      const h = await U.sha256(actual);
      if (h !== U.lsGet('ps_hash_local', CFG.hashLocal)) throw new Error('La contraseña actual no es correcta');
      U.lsSet('ps_hash_local', await U.sha256(nueva));
    }
    U.lsSet('ps_hash_bloqueo', await U.sha256(nueva));
  };

  DB.verificarBloqueo = async (password) => (await U.sha256(password)) === U.lsGet('ps_hash_bloqueo', null);

  /* ---------------- Registros ---------------- */
  /**
   * Guarda un registro. Devuelve { local, nube }:
   *  local -> se resuelve en cuanto el dato quedó guardado en el dispositivo
   *  nube  -> se resuelve cuando la nube confirmó (en modo local, igual que local)
   */
  DB.guardarRegistro = (reg) => {
    const datos = limpiar(reg);
    if (DB.modo === 'nube') {
      const p = seguir(F.setDoc(F.doc(fs, 'registros', datos.id), datos));
      return { local: Promise.resolve(), nube: p };
    }
    const p = IDB.put('registros', datos).then(() => avisarLocal());
    return { local: p, nube: p };
  };

  DB.obtenerRegistro = async (id) => {
    if (DB.modo === 'nube') {
      const s = await F.getDoc(F.doc(fs, 'registros', id));
      return s.exists() ? Object.assign({ _pendiente: s.metadata.hasPendingWrites }, s.data()) : null;
    }
    return (await IDB.get('registros', id)) || null;
  };

  DB.eliminarRegistro = async (id) => {
    const fotos = await DB.fotosDe(id);
    if (DB.modo === 'nube') {
      for (const f of fotos) seguir(F.deleteDoc(F.doc(fs, 'fotos', f.id)));
      seguir(F.deleteDoc(F.doc(fs, 'registros', id)));
      return;
    }
    for (const f of fotos) await IDB.del('fotos', f.id);
    await IDB.del('registros', id);
    avisarLocal();
  };

  const ordenar = (lista) => lista.sort((a, b) =>
    (b.fecha || '').localeCompare(a.fecha || '') || String(b.turno || '').localeCompare(String(a.turno || '')) || (b.creadoEn || 0) - (a.creadoEn || 0));

  /** Lista registros entre dos fechas (ISO, inclusivo). */
  DB.listarRegistros = async ({ desde, hasta }) => {
    desde = desde || '2000-01-01'; hasta = hasta || '2999-12-31';
    if (DB.modo === 'nube') {
      const q = F.query(F.collection(fs, 'registros'), F.where('fecha', '>=', desde), F.where('fecha', '<=', hasta), F.orderBy('fecha', 'desc'));
      const snap = await F.getDocs(q);
      return ordenar(snap.docs.map((d) => Object.assign({ _pendiente: d.metadata.hasPendingWrites }, d.data())));
    }
    const todos = await IDB.all('registros');
    return ordenar(todos.filter((r) => r.fecha >= desde && r.fecha <= hasta));
  };

  /** Suscripción en vivo a los registros de un rango. Devuelve función para cancelar. */
  DB.suscribirRegistros = ({ desde, hasta }, fn) => {
    desde = desde || '2000-01-01'; hasta = hasta || '2999-12-31';
    if (DB.modo === 'nube') {
      const q = F.query(F.collection(fs, 'registros'), F.where('fecha', '>=', desde), F.where('fecha', '<=', hasta), F.orderBy('fecha', 'desc'));
      return F.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        fn(ordenar(snap.docs.map((d) => Object.assign({ _pendiente: d.metadata.hasPendingWrites }, d.data()))));
      }, (err) => { console.error(err); U.toast('No se pudieron leer los registros de la nube', 'error'); });
    }
    let vivo = true;
    const cargar = () => DB.listarRegistros({ desde, hasta }).then((l) => { if (vivo) fn(l); });
    localOyentes.add(cargar);
    cargar();
    return () => { vivo = false; localOyentes.delete(cargar); };
  };

  DB.todosLosRegistros = () => DB.listarRegistros({});

  /* ---------------- Fotos ---------------- */
  DB.guardarFoto = (foto) => {
    if (DB.modo === 'nube') return seguir(F.setDoc(F.doc(fs, 'fotos', foto.id), limpiar(foto)));
    return IDB.put('fotos', foto);
  };
  DB.fotosDe = async (registroId) => {
    if (DB.modo === 'nube') {
      const snap = await F.getDocs(F.query(F.collection(fs, 'fotos'), F.where('registroId', '==', registroId)));
      return snap.docs.map((d) => d.data()).sort((a, b) => a.creadoEn - b.creadoEn);
    }
    return (await IDB.porIndice('fotos', 'registroId', registroId)).sort((a, b) => a.creadoEn - b.creadoEn);
  };
  DB.eliminarFoto = (id) => {
    if (DB.modo === 'nube') return seguir(F.deleteDoc(F.doc(fs, 'fotos', id)));
    return IDB.del('fotos', id);
  };
  DB.todasLasFotos = async () => {
    if (DB.modo === 'nube') return (await F.getDocs(F.collection(fs, 'fotos'))).docs.map((d) => d.data());
    return IDB.all('fotos');
  };

  /* ---------------- Configuración compartida ---------------- */
  DB.obtenerConfig = async () => {
    try {
      if (DB.modo === 'nube') {
        const s = await F.getDoc(F.doc(fs, 'config', 'app'));
        return s.exists() ? s.data() : null;
      }
      const c = await IDB.get('config', 'app');
      return c || null;
    } catch (e) {
      console.warn('Config no disponible', e);
      return null;
    }
  };
  DB.suscribirConfig = (fn) => {
    if (DB.modo === 'nube') return F.onSnapshot(F.doc(fs, 'config', 'app'), (s) => fn(s.exists() ? s.data() : null), () => {});
    return () => {};
  };
  DB.guardarConfig = (cfg) => {
    const datos = limpiar(Object.assign({}, cfg, { id: 'app' }));
    if (DB.modo === 'nube') return seguir(F.setDoc(F.doc(fs, 'config', 'app'), datos));
    return IDB.put('config', datos);
  };

  /** Importa un respaldo completo (registros + fotos). */
  DB.importar = async (datos) => {
    let n = 0;
    for (const r of datos.registros || []) { DB.guardarRegistro(r); n++; }
    for (const f of datos.fotos || []) DB.guardarFoto(f);
    if (datos.config) await DB.guardarConfig(datos.config);
    if (DB.modo === 'local') avisarLocal();
    return n;
  };

  window.DB = DB;
})();
