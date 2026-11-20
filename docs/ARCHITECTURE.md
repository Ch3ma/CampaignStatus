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
