# Civilización de estudio

Web personal para estudiar: una checklist generada con IA a partir de tu calendario y tus apuntes, una civilización que crece con cada tarea completada, tus apuntes dentro de la web y un modo estudio que te mantiene dentro hasta que acaba el tiempo.

- Web estática (HTML + CSS + JavaScript, sin compilación ni backend). Se aloja gratis en GitHub Pages o Netlify.
- Todo se guarda en tu navegador: IndexedDB (apuntes y calendario) y localStorage (tareas, progreso, ajustes).
- Instalable como app (PWA) y funciona sin internet, salvo el paso de generar con IA.

## Estructura

```
index.html              pantallas y modo estudio
manifest.webmanifest    datos de la app instalable
sw.js                   service worker (funcionamiento sin conexión)
css/estilos.css         diseño (PC y móvil, modo claro y oscuro)
js/utiles.js            fechas, Markdown seguro, bloques de apuntes, modales
js/almacen.js           localStorage + IndexedDB + copia de seguridad
js/modelo.js            estado, tareas y piezas de la civilización
js/ejemplo.js           calendario y apuntes de ejemplo
js/asignaturas.js       pantalla Asignaturas
js/checklist.js         pantalla Checklist
js/apuntes.js           pantalla Apuntes (pestañas, buscador, editor)
js/importar.js          pantalla Importar (pdf.js, .md/.txt/.pdf)
js/ia.js                Gemini, instrucciones para Claude, validación, vista previa y lector sin IA
js/civilizacion.js      escena SVG
js/estudio.js           modo estudio
js/app.js               navegación, inicio y ajustes
vendor/                 marked y pdf.js (copiados en local para que funcione sin internet)
iconos/                 iconos de la app
```

## Abrirla en local

**Opción rápida:** doble clic en `index.html`. Funciona casi todo, pero así el navegador no permite instalarla ni usarla sin conexión.

**Opción recomendada:** un servidor local. En una terminal, dentro de la carpeta:

```bash
python -m http.server 8000
```

y abre <http://localhost:8000>. (Si tienes Node: `npx serve .`)

**Modo prueba:** añade `?prueba` a la dirección, por ejemplo <http://localhost:8000/?prueba>. El temporizador dura 10 segundos. En **Importar** tienes los botones «Cargar calendario de ejemplo», «Cargar apuntes de ejemplo» y «Probar sin IA» para probarlo todo sin gastar la IA.

## Cómo se usa

1. **Asignaturas:** ya vienen SI, ED, DWES, BD, PROG y LM con sus fechas de examen. Puedes editarlas.
2. **Importar → Calendario:** sube el PDF (se lee en tu navegador) o pega el texto. Revisa el texto extraído y corrige si hace falta.
3. **Importar → Apuntes:** por asignatura, pega texto o importa .md, .txt o .pdf. Los **PDF se guardan tal cual** y se ven con su formato original, página a página; se dividen en bloques según su índice (marcadores) o, si no tiene, según sus títulos. En el texto, cada título (`#`, `##`, `###`) empieza un bloque.
4. **Generar checklist:** con Gemini (A) o con tu chat de Claude (B). Revisa la vista previa, ajusta y guarda.
5. **Estudia:** en cada tarea de estudio pulsa «Empezar a estudiar». Las entregas y los exámenes se marcan con la casilla.

### La civilización

- N es el número total de tareas en cada momento. Cada tarea completada levanta una pieza en un sitio fijo del mapa, del centro hacia fuera.
- Eras: campamento → aldea de chozas → granjas y río → pueblo con mercado → ciudad amurallada → castillo → gran ciudad. Cada examen hecho levanta un edificio especial (torre, puerto, biblioteca, universidad, observatorio, teatro, catedral) y hace avanzar una era. El resto de tareas también suma.
- Si añades tareas, lo construido se queda donde está. Si desmarcas una tarea, su pieza desaparece.
- La última pieza es el monumento final de la plaza y sale la pantalla «Civilización completa».

### El modo estudio, con sinceridad

Una web no puede bloquear el ordenador. Esto es lo que hace:

- Pone la pantalla completa y activa Wake Lock (la pantalla no se apaga).
- La cuenta atrás **solo avanza mientras estás dentro**. Si cambias de pestaña, de ventana o quitas la pantalla completa, se pausa, sale «Vuelve a estudiar» y se apunta una distracción. Cerrar o recargar la pestaña también cuenta como una.
- Con 3 distracciones, la pieza sale dañada (gris, en ruinas). Se repara con una sesión limpia de esa asignatura (en la checklist sale «🔧 Repetir sesión»).
- Descanso de 10 min cada 50 min, dentro de la web.
- Al intentar cerrar o recargar sale el aviso del navegador.
- Salida de emergencia: mantener pulsado 10 segundos el botón de abajo a la izquierda. La tarea no cuenta y la sesión queda como «abandonada».
- Si se cierra la pestaña a mitad, al volver te ofrece seguir con el tiempo que quedaba.
- En iPhone, Safari no tiene pantalla completa para webs: instálala en la pantalla de inicio (ver abajo) y se verá sin barras. El resto (pausa al salir, distracciones) funciona igual.

## Clave gratis de Gemini

1. Entra en <https://aistudio.google.com/apikey> con tu cuenta de Google.
2. Pulsa **Create API key** («Crear clave de API»). Si te pide un proyecto, deja que cree uno por defecto.
3. Copia la clave (empieza por `AIza…`).
4. En la web: **Ajustes → Clave de Google AI Studio**, pégala y pulsa **Guardar**. Con «Ver modelos disponibles» compruebas que funciona.

No hace falta tarjeta. La capa gratuita tiene límites por minuto y por día: si se agotan, la web lo dice y te ofrece la opción B. La clave solo se guarda en tu navegador y solo se envía a Google al generar. Ten en cuenta que, en la capa gratuita, Google puede usar lo que envías para mejorar sus productos: se envían el calendario, los nombres de las asignaturas y los títulos y el comienzo de cada bloque de apuntes.

Si Google cambia los nombres de los modelos, elige otro «flash» en **Ajustes → Modelo**.

## Publicarla gratis en GitHub Pages (paso a paso)

1. Crea una cuenta en <https://github.com> si no tienes.
2. Arriba a la derecha, **+ → New repository**. Nombre: por ejemplo `civilizacion`. Márcalo **Public** (Pages gratis necesita repositorio público) y pulsa **Create repository**.
3. En la página del repositorio vacío, pulsa **uploading an existing file**.
4. Arrastra **el contenido** de esta carpeta (`index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll` y las carpetas `css`, `js`, `vendor` e `iconos`). No hace falta subir `.claude`. Pulsa **Commit changes**.
5. Ve a **Settings → Pages**. En «Build and deployment», **Source: Deploy from a branch**, rama **main** y carpeta **/ (root)**. Pulsa **Save**.
6. Espera uno o dos minutos y recarga esa página: aparecerá la dirección, del tipo `https://TU-USUARIO.github.io/civilizacion/`.

Para actualizarla, vuelve a subir los archivos cambiados (Add file → Upload files). Si cambias algo, sube también `sw.js` con la línea `VERSION` cambiada (por ejemplo `civ-v2`) para que los móviles descarguen la versión nueva.

### Alternativa: Netlify Drop

1. Entra en <https://app.netlify.com/drop>.
2. Arrastra la carpeta entera a la página.
3. Te da una dirección al momento. Para que no caduque, crea una cuenta gratis y reclama el sitio cuando te lo pida.

Es más rápido la primera vez, pero GitHub Pages es más cómodo para tenerla siempre en la misma dirección.

## Instalarla en el iPhone (Safari)

1. Abre la dirección de tu web en **Safari** (no en Chrome).
2. Pulsa el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Baja y elige **Añadir a pantalla de inicio**. Pulsa **Añadir**.
4. Ábrela desde el icono: se verá a pantalla completa y funcionará sin conexión.

Importante: en el iPhone, la app instalada y Safari guardan los datos por separado. Para pasar tus datos del PC al móvil: en el PC, **Ajustes → Exportar copia de seguridad**; envíate el archivo (AirDrop, correo, iCloud Drive…); en el iPhone, abre la app instalada → **Ajustes → Importar copia de seguridad** y elige el archivo.

En el PC (Chrome en Windows 11) también se puede instalar: icono de instalar a la derecha de la barra de direcciones, o menú ⋮ → **Transmitir, guardar y compartir → Instalar página como aplicación**.

## Copia de seguridad

**Ajustes → Exportar copia de seguridad** descarga un .json con todo (asignaturas, tareas, progreso, sesiones, apuntes y calendario). La clave de la IA solo se incluye si marcas la casilla. **Importar** sustituye todo lo del navegador por el contenido del archivo.

## Licencias de terceros

- [marked](https://github.com/markedjs/marked) (MIT) — `vendor/LICENSE-marked.md`
- [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0) — `vendor/LICENSE-pdfjs.txt`
