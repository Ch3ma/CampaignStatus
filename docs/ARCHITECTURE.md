# Arquitectura

`src/App.tsx` comprueba primero la identidad de Firebase Auth y después una membresía en Firestore. React Router protege la navegación del portal y muestra el panel administrativo al Handler. Las reglas de Firestore vuelven a verificar el rol y la célula para cada operación. Cada usuario puede consultar su membresía y únicamente la administración con IAM puede crearla, cambiarla o retirarla.

`src/firebase.ts` centraliza las consultas y escrituras. El agente consulta por estado publicado y audiencia. Para comunicaciones directas agrega su UID como filtro. La vista del Handler consulta borradores mediante rutas que comprueban su rol. Las ediciones usan una transacción que comprueba la versión abierta en el formulario antes de guardar. Una publicación se conserva como texto plano y React lo renderiza como texto.

La sesión de Auth y la caché de Firestore residen en memoria. Recargar requiere iniciar sesión otra vez. Las vistas de archivo se vacían al recibir una instantánea de caché y muestran datos confirmados en línea. Retirar un registro impide lecturas futuras y lo retira del portal conectado. Copias que alguien haya guardado o impreso conservan su contenido.

El build estático contiene la aplicación, sus estilos y la configuración pública de Firebase. La semilla se ejecuta aparte y la opción de demostración solo está habilitada en el servidor de desarrollo con `VITE_USE_EMULATORS=true`. El archivo `firebase.json` fija las rutas de reglas, índices y Hosting. Las consultas de esta fase usan igualdades y los índices simples automáticos.

## Bootstrap del primer Handler

1. Confirma el ID del proyecto dedicado antes de operar en Firebase Console.
2. En **Authentication → Users**, crea la cuenta del Handler con correo y contraseña mediante el flujo administrativo. Usa una contraseña gestionada de forma segura y comparte el acceso por un canal autorizado. Copia su UID.
3. En **Firestore Database**, crea el documento `cells/cell-a` con el campo `name` (string) igual a `Cell A`.
4. Crea `cells/cell-a/members/<UID>` con `role` (string) igual a `handler` y `alias` (string) igual a `Asmodan` o el nombre elegido.
5. Para cada agente, crea su cuenta, copia su UID y agrega una membresía equivalente con `role: agent` y el alias asignado. Elimina el documento de membresía para revocar el acceso al archivo y deshabilita la cuenta si corresponde. El UID del agente se usa como destinatario de comunicaciones directas.
6. Comprueba que una cuenta sin membresía quede fuera y que el agente solo consulte material publicado. Usa datos ficticios durante la verificación.

La consola administrativa opera con IAM. Limita su acceso a cuentas de confianza y usa cuentas de prueba separadas para validar las reglas del cliente. El proyecto prescinde de claves JSON y roles autogestionados desde el portal. Si se automatiza el despliegue en otra fase, usa Workload Identity Federation con permisos mínimos.

## Obsidian

El vault seguirá siendo la fuente de trabajo del Handler. La Fase 1 usa Firestore para las publicaciones que leen los agentes. El flujo de importación y exportación se aplaza hasta que se aprueben los archivos y campos que se podrán transferir desde Obsidian.

## Handouts en el emulador

`src/handouts/` contiene el modelo, el adaptador Firestore, el visor y la extensión del panel del Handler. El visor pide los bytes al servidor y los conserva en memoria mientras está abierto. Las reglas mantienen independientes la ficha de publicación, las relaciones autorizadas, la procedencia reservada y los bytes. Las ediciones comprueban la versión de la ficha en una transacción antes de guardar.

La imagen y el PDF se generan en `scripts/demo-image.mjs` y `scripts/demo-pdf.mjs` y se preparan mediante el SDK administrativo del emulador. PDF.js se carga al abrir un PDF y renderiza la página seleccionada en un canvas. El visor expone el texto extraíble de la página y prescinde de acciones del documento y enlaces interactivos. [API de PDF.js](https://mozilla.github.io/pdf.js/api/) El build de producción conserva el visor y la interfaz, mientras que la lectura de bytes de la demo está habilitada exclusivamente en el servidor de desarrollo conectado a emuladores. [Flujo y alcance](HANDOUTS.md)

### Escrituras y persistencia local

La carga del Handler guarda la ficha, los bytes, la operación, los vínculos y la procedencia privada en un lote atómico de Firestore. Editar una publicación usa una transacción con comprobación de versión que la devuelve a revisión. Los binarios se almacenan una sola vez y las reglas del emulador exigen el mismo tamaño declarado en el borrador.

`scripts/emulators.mjs` genera una configuración de reglas exclusiva del proyecto ficticio `demo-black-archive`. `firebase.json` conserva `firestore.rules` como configuración de producción y mantiene desactivadas las escrituras de archivos y referencias. El selector de archivos requiere además `VITE_USE_EMULATORS=true` con el servidor de desarrollo. Docker monta un volumen para exportar e importar Auth y Firestore. [Instalación de Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure?hl=es)

## Storage y GitHub Pages

Las cargas nuevas reservan una revisión inmutable, una clave y su hash privado de origen en Firestore. El navegador cifra los bytes y transfiere el sobre del archivo con el SDK resumible. Confirma la revisión en una transacción después de la carga. Firestore y Storage aplican reglas coordinadas de membresía, publicación y revisión activa. Firestore no consulta Storage para verificar la existencia física del objeto. Si se interrumpe la confirmación, el Handler puede reintentar y verificar el objeto existente. Para descartar, primero se retira la revisión pendiente y se habilita únicamente la limpieza de esa revisión.

El visor descarga con credenciales de Firebase, descifra temporalmente en memoria y revoca la URL del objeto al cerrarse. Los tokens que el propio servicio pueda emitir para la revisión sirven solo el sobre cifrado. La semilla conserva ejemplos inline. El uso de Storage en producción queda condicionado a configurar el bucket y la política de fuentes.

La SPA de GitHub Pages usa el mismo backend de Auth y reglas y cambia al router hash para recargar rutas bajo el subdirectorio del proyecto. [Bucket privado](GCP_STORAGE_SETUP.md) · [GitHub Pages](GITHUB_PAGES.md)
