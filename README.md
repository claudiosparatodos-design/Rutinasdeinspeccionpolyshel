# Rutinas de Inspección · POLYSHEL

Página web para capturar en tableta las rutinas de inspección de máquinas (temperaturas, presiones, tiempos, verificaciones…) que antes se llenaban a mano en papel. Se entra con contraseña y los datos se guardan en la nube.

**Contraseña de acceso:** `poly2026` (se cambia en *Configuración → Seguridad*).

---

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Inicio** | Tablero del día: rutinas hechas por turno, equipos revisados, alertas, turno actual y rutinas pendientes de terminar. |
| **Capturar** | Llenado en tableta por secciones (equipo o área), con botones grandes, teclado numérico y casillas ✓. El botón **Ver formato** muestra en vivo la hoja de Excel con lo capturado. |
| **Registros** | Todo lo guardado en la nube, con buscador por fechas, formato, turno, inspector, equipo, estado o cualquier texto/dato. Pestaña **Buscar lecturas** para encontrar mediciones (p. ej. *temperatura de aceite mayor que 50* o *todo lo fuera de rango*). |
| **Exportar e imprimir** | Elegir formato, fechas (rango o **días específicos** en el calendario) y turno. Vista previa, impresión directa y Excel: **el mismo archivo original, ya lleno**. También imprime el **formato en blanco** por si falla la tableta. |
| **Tendencias** | Gráfica de cada medición en el tiempo con sus límites, comparación de hasta 3 equipos y conteo de alertas por equipo. |
| **Configuración** | Turnos, inspectores, rangos de alerta por lectura (sin tocar código), firmas obligatorias, cambio de contraseña, respaldo, restauración y descarga de los Excel originales. |

Detalles que hacen el llenado más práctico que el papel:

- La **fecha, turno, hora e inspector se llenan solos**.
- Teclado **numérico** en las mediciones y paso automático al siguiente campo con *Enter*.
- Cada medición muestra su **rango** y se pone en **rojo** si está fuera; las alertas aparecen en el tablero.
- Botones **Todo bien / Marcar todo** (marca las verificaciones ✓ de la sección) y **Foto** de evidencia con la cámara.
- Si ya hay una captura del mismo día (o turno), la página ofrece **continuarla** en lugar de duplicarla.
- **Firma** con el dedo en la tableta (rutina de arranque/paro); sale en la impresión y en el Excel con el nombre.
- **Guardado automático** mientras se captura: si la tableta se apaga o se cierra la página, no se pierde nada y se puede continuar desde *Inicio*.
- **Funciona sin internet**: lo capturado se guarda en la tableta y se sube solo a la nube al volver la señal (el indicador de arriba muestra el estado).
- Se puede **instalar como app** en la tableta (ícono en la pantalla de inicio).
- Tema claro y oscuro; se adapta a tableta vertical/horizontal, computadora y teléfono.
- El Excel exportado es **el archivo original del formato** con los datos escritos en sus celdas (una pestaña por hoja: por semana, por mes, etc.). Además, un **Excel de datos** (tabla plana) para análisis.

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

La página usa **los mismos archivos de Excel de la planta** (carpeta [`formatos/`](formatos)). Cada hoja se dibuja tal cual es en Excel (logo, bordes, colores, casillas) y, al exportar, se llena **el archivo original**: el Excel que se descarga es idéntico al formato, solo que con los datos escritos.

| Rutina en la página | Archivo original | Cómo se acomoda |
|---|---|---|
| Rutina de inspección de servicios extrusión | `RUTINA INSPECCION SERVICIOS PARA TURNOS.xlsx` (Hoja2) | Una captura por turno. 5 fechas × 3 turnos por hoja; los medidores de agua, una vez al día. |
| Registro de recipientes sujetos a presión | `REGISTRO DE PRESIONES Y TEMPERATURA.xlsx` (pulmones TRA-2 y TRA-1) | Una captura por turno. Una hoja por mes y pulmón: presión y temperatura por turno, purga diaria y purga quincenal de válvula. Los fines de semana se marcan en verde según el mes. |
| Revisión de alarmas y detectores de humo | `REGISTRO DE PRESIONES Y TEMPERATURA.xlsx` (Nave 1 y Nave 2) | Una captura por día de revisión. Una hoja por mes y nave. |
| Lecturas CFE medidor | `FORMATO DE RECOLECCION DE LECTURAS.xlsx` | Una captura por día. 10 fechas por hoja; hojas de Extrusión y Nave 6. |
| Consumos de agua | `FORMATO CONSUMO DE AGUA.xlsx` | Una captura por día. 9 fechas por hoja, tres medidores. |
| Rutina de arranque / paro de planta | `RUTINAS PARO-ARRANQUE PLANTA.xlsx` | Una captura por evento; cada casilla del formato se marca con ✓ y lleva firmas. |

Los rangos de alerta (por ejemplo, 15 °C de temperatura máxima del agua o 8 kg/cm² de presión de operación de los pulmones) se ajustan en *Configuración → Rangos de alerta*.

### Cambiar o agregar un formato

1. Guarda el Excel en `formatos/`.
2. Si es nuevo, agrégalo a la lista `PLANTILLAS` de [`tools/convertir_plantillas.py`](tools/convertir_plantillas.py).
3. Ejecuta `python3 tools/convertir_plantillas.py` (requiere `openpyxl` y `Pillow`). Esto genera `plantillas/<id>.json` y copia el Excel a `plantillas/<id>.xlsx`.
4. En [`js/formatos.js`](js/formatos.js) define qué se captura (`secciones`) y en qué celda va cada dato (`paginar`).

## Estructura

```
index.html               Página única (acceso + aplicación)
css/app.css              Diseño de la aplicación
css/hoja.css             Hojas de los formatos e impresión (carta)
formatos/                Excel originales de la planta
plantillas/              Formatos convertidos (JSON para dibujar + copia del Excel original)
tools/convertir_plantillas.py   Convierte formatos/ → plantillas/
js/config.js             Empresa y conexión a la nube  ← lo único que se edita para la nube
js/formatos.js           Qué se captura en cada formato y en qué celda va
js/plantilla.js          Dibuja las hojas igual que Excel (vista previa e impresión)
js/xlsx.js               Llena el Excel original para exportar
js/modelo.js             Rangos, alertas y avance
js/db.js                 Nube (Firebase) / modo local
js/excel.js              Excel de datos (tablas)
js/vistas/*.js           Pantallas
vendor/                  Firebase, ExcelJS, JSZip, Chart.js y fuentes (incluidos, sin depender de internet)
sw.js, manifest          Instalación como app y uso sin conexión
firestore.rules          Reglas de seguridad para la nube
```
