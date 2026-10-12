/* ==========================================================================
   CONFIGURACIÓN DE LA APLICACIÓN
   --------------------------------------------------------------------------
   Este es el único archivo que hay que editar para conectar la nube.
   Las instrucciones paso a paso están en README.md (sección "Conectar la nube").
   ========================================================================== */
window.APP_CONFIG = {
  // Nombre que aparece en la pantalla de acceso, la barra superior y los formatos.
  empresa: 'POLYSHEL',
  planta: 'Planta',
  nombreApp: 'Rutinas de Inspección',

  // Logo opcional (PNG o JPG dentro de la carpeta img/). Déjalo vacío para usar
  // el logotipo de texto. Ejemplo: 'img/logo.png'
  logo: '',

  // ------------------------------------------------------------------------
  // NUBE (Firebase). Mientras "firebase" esté vacío, la app funciona en
  // MODO LOCAL: guarda todo solo en el navegador de este dispositivo.
  // Pega aquí el objeto firebaseConfig que te da la consola de Firebase.
  // ------------------------------------------------------------------------
  firebase: null,
  /* Ejemplo:
  firebase: {
    apiKey: 'AIza...',
    authDomain: 'polyshel-inspeccion.firebaseapp.com',
    projectId: 'polyshel-inspeccion',
    storageBucket: 'polyshel-inspeccion.appspot.com',
    messagingSenderId: '1234567890',
    appId: '1:1234567890:web:abcdef'
  },
  */

  // Cuenta compartida de la planta en Firebase Authentication.
  // La contraseña NO va aquí: se crea en la consola de Firebase (poly2026).
  cuentaPlanta: 'inspeccion@polyshel.app',

  // Solo para MODO LOCAL: huella SHA-256 de la contraseña "poly2026".
  // (En modo nube la contraseña la valida Firebase, no este archivo.)
  hashLocal: '49cb47978a5b18f170dc3d179b4b4d0f45e456b6d5cc66aed17a569a9e0a9b65'
};
