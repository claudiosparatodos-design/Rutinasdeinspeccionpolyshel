# Rutinas de Inspección · POLYSHEL

Página web para capturar en tableta las rutinas de inspección de máquinas (temperaturas, presiones, tiempos, verificaciones…) que antes se llenaban a mano en papel. Se entra con contraseña y los datos se guardan en la nube.

**Contraseña de acceso:** `poly2026` (se cambia en *Configuración → Seguridad*).

---

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Inicio** | Tablero del día: rutinas hechas por turno, equipos revisados, alertas, turno actual y rutinas pendientes de terminar. |
| **Capturar** | Llenado en tableta. Dos modos: **por máquina** (tarjetas grandes, ideal para ir caminando de equipo en equipo) y **formato completo** (la misma tabla de la hoja impresa). |
| **Registros** | Todo lo guardado en la nube, con buscador por fechas, formato, turno, inspector, equipo, estado o cualquier texto/dato. Pestaña **Buscar lecturas** para encontrar mediciones (p. ej. *temperatura de aceite mayor que 50* o *todo lo fuera de rango*). |
| **Exportar e imprimir** | Elegir formato, fechas (rango o **días específicos** en el calendario) y turno. Vista previa, impresión directa y Excel con **el mismo diseño del formato**. También imprime el **formato en blanco** por si falla la tableta. |
| **Tendencias** | Gráfica de cada medición en el tiempo con sus límites, comparación de hasta 3 equipos y conteo de alertas por equipo. |
| **Configuración** | Turnos, inspectores, equipos y rangos por formato (sin tocar código), firmas obligatorias, cambio de contraseña, respaldo y restauración. |

Detalles que hacen el llenado más práctico que el papel:

- La **fecha, turno, hora e inspector se llenan solos**.
- Teclado **numérico** en las mediciones y paso automático al siguiente campo con *Enter*.
- Cada medición muestra su **rango** y se pone en **rojo** si está fuera; las alertas aparecen en el tablero.
- Botones **Todo bien** (marca todas las verificaciones ✓), **No opera** (equipo parado) y **Foto** de evidencia con la cámara.
- **Hora de lectura** automática por equipo.
- **Firma** con el dedo en la tableta; sale en la impresión y en el Excel.
- **Guardado automático** mientras se captura: si la tableta se apaga o se cierra la página, no se pierde nada y se puede continuar desde *Inicio*.
- **Funciona sin internet**: lo capturado se guarda en la tableta y se sube solo a la nube al volver la señal (el indicador de arriba muestra el estado).
- Se puede **instalar como app** en la tableta (ícono en la pantalla de inicio).
- Tema claro y oscuro; se adapta a tableta vertical/horizontal, computadora y teléfono.
- Excel con una hoja por rutina, índice con enlaces, listo para imprimir en carta horizontal. Además, un **Excel de datos** (tabla plana) para análisis.

---

## 1. Probarla ya (modo local)

Mientras no se conecte la nube, la app funciona en **modo local**: guarda todo solo en el navegador de ese dispositivo. Sirve para probar.

Para abrirla en la computadora hay que servir la carpeta (no basta con doble clic en `index.html`):

```bash
python3 -m http.server 8000
# luego abrir http://localhost:8000
```

## 2. Publicarla en internet (GitHub Pages, gratis)

1. En GitHub, entra al repositorio → **Settings → Pages**.
2. En *Build and deployment* elige **Deploy from a branch**.
3. Elige la rama donde está la app (por ejemplo `main`, después de fusionar esta rama) y la carpeta **/ (root)**. Guarda.
4. En un par de minutos queda en:
   `https://claudiosparatodos-design.github.io/Rutinasdeinspeccionpolyshel/`

La página tiene `noindex`, así que no aparece en Google, y sin la contraseña no se ve ningún dato.

## 3. Conectar la nube (Firebase, plan gratuito)

Firebase (de Google) guarda los registros en la nube y valida la contraseña. El plan gratuito alcanza de sobra para una planta.

1. Entra a <https://console.firebase.google.com> con una cuenta de Google y crea un proyecto (por ejemplo `polyshel-inspeccion`). Google Analytics no es necesario.
2. **Authentication** → *Comenzar* → pestaña *Método de acceso* → habilita **Correo electrónico/contraseña**.
3. **Authentication → Usuarios → Agregar usuario**:
   - Correo: `inspeccion@polyshel.app` (no tiene que ser un correo real)
   - Contraseña: `poly2026`
4. Recomendado: **Authentication → Configuración → Acciones del usuario** → desactiva *Habilitar creación (registro)* para que nadie pueda crear otras cuentas.
5. **Firestore Database** → *Crear base de datos* → modo **producción** → elige una ubicación cercana (p. ej. `nam5` o `us-central1`).
6. **Firestore → Reglas** → borra lo que haya, pega el contenido del archivo [`firestore.rules`](firestore.rules) y presiona **Publicar**.
7. **Configuración del proyecto** (engrane) → *Tus apps* → ícono **Web `</>`** → registra la app (sin Hosting) → copia el objeto `firebaseConfig`.
8. Abre [`js/config.js`](js/config.js) y reemplaza `firebase: null,` por lo que copiaste, por ejemplo:

   ```js
   firebase: {
     apiKey: 'AIza...',
     authDomain: 'polyshel-inspeccion.firebaseapp.com',
     projectId: 'polyshel-inspeccion',
     storageBucket: 'polyshel-inspeccion.appspot.com',
     messagingSenderId: '1234567890',
     appId: '1:1234567890:web:abcdef'
   },
   ```

9. **Authentication → Configuración → Dominios autorizados** → agrega `claudiosparatodos-design.github.io`.
10. Sube el cambio de `config.js` al repositorio. Al entrar, el indicador superior dirá **En la nube**.

> Estos datos de `firebaseConfig` no son secretos: identifican el proyecto. La protección real son la contraseña y las reglas de `firestore.rules`, que solo permiten leer y escribir a la cuenta de la planta.

**Si ya capturaron en modo local** antes de conectar la nube: en *Configuración → Datos y respaldo* descarguen un respaldo y, ya conectada la nube, usen *Restaurar respaldo*.

**Límites del plan gratuito** (Spark): 1 GB de datos, 20,000 escrituras y 50,000 lecturas por día. Una rutina completa usa del orden de un centenar de escrituras (por el guardado automático) y cada foto ocupa ~200 KB.

---

## 4. Formatos

Los formatos se definen en [`js/formatos.js`](js/formatos.js). Con esa misma definición se dibujan la captura en tableta, la vista previa / impresión y el Excel, así que los tres salen iguales y en el mismo orden que la hoja de papel:

- `encabezado`: datos generales (fecha, turno, horas, inspector…)
- `tabla.filas`: equipos (con `limites` propios y celdas que `omitir`)
- `tabla.columnas`: mediciones (`numero` con `min`/`max`, `check` ✓/✗/N/A, `opciones`, `hora`, `texto`) y `grupo` para encabezados combinados
- `pie`, `notas` y `firmas`

Los dos formatos incluidos (**FO-MTO-001** y **FO-MTO-002**) son **de ejemplo** y se reemplazan por los formatos oficiales de la planta. Los equipos y rangos también se pueden ajustar desde *Configuración → Equipos y límites* sin tocar código.

Para poner un logo en la hoja impresa y el Excel, coloca el archivo en `img/` y escribe su ruta en `logo` dentro de `js/config.js`.

## Estructura

```
index.html            Página única (acceso + aplicación)
css/app.css           Diseño de la aplicación
css/hoja.css          Hoja del formato e impresión (carta)
js/config.js          Empresa, logo y conexión a la nube  ← lo único que se edita para la nube
js/formatos.js        Definición de los formatos
js/modelo.js          Rangos, alertas y avance
js/db.js              Nube (Firebase) / modo local
js/render.js          Hoja del formato (vista previa e impresión)
js/excel.js           Excel con el mismo diseño
js/vistas/*.js        Pantallas
vendor/               Firebase, ExcelJS y Chart.js (incluidos, sin depender de internet)
sw.js, manifest       Instalación como app y uso sin conexión
firestore.rules       Reglas de seguridad para la nube
```
