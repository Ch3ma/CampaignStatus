# Handouts · Corte A

La demo genera una imagen ficticia de telemetría y guarda sus bytes en el emulador de Firestore. La semilla incorpora una ficha en borrador relacionada con **Operación Umbral**, un expediente visible y una relación reservada con una ficha de personal. El proceso local se describe en el [README](../README.md) y en la [guía de Docker](DOCKER.md).

## Recorrido

1. Ejecuta la app y los emuladores y carga la semilla con `npm run seed`.
2. Entra como Handler. Abre **Panel del Handler → Handouts → Captura de telemetría**. Revisa el visor, la referencia al expediente y la procedencia reservada.
3. Usa **Vista previa como agente** para revisar la presentación. En una segunda sesión entra como agente y abre **Expedientes → Consultar archivo multimedia**. El borrador todavía no aparece.
4. Confirma y publica desde el panel. El agente ve la imagen, el vínculo al expediente publicado y la operación. El registro de la procedencia y la relación reservada quedan en el panel del Handler.
5. Para habilitar el botón de descarga, marca la opción en la ficha y guarda. Guardar una ficha publicada la devuelve a revisión. Publica de nuevo para liberar esa revisión. Archivar bloquea lecturas posteriores.

El modo de vista previa como agente usa la sesión del Handler para mostrar una simulación. La prueba en Chromium abre además una sesión real de agente y comprueba el comportamiento de las reglas.

## Alcance y protección

El Corte A soporta fichas y previsualización raster de imágenes de hasta 100 KiB en los emuladores. La semilla genera un PNG por código sin importar archivos. El código cliente incluye un visor para PNG, JPEG y WebP. Firestore entrega el binario solo al abrir una ficha en la sesión autorizada. El visor abre un objeto temporal en memoria y lo revoca al cerrar la vista o retirar la publicación. La opción de descarga controla el enlace en la aplicación. Quien ya recibió la vista previa puede conservar una copia por otros medios.

El contenido del fascículo permanece como fuente local del Handler en la raíz del workspace original, sin seguimiento de Git. El fascículo también queda excluido de Docker y del servidor de desarrollo. La semilla solo usa material ficticio y deja el estado editorial de la campaña a sus datos existentes.

Los PDF, la carga de binarios y la edición de relaciones desde el panel quedan para un corte posterior. Las relaciones, el fichero y la procedencia de esta demo se preparan en la semilla con acceso administrativo al emulador. Antes de usar material real, hay que aprobar su procedencia y decidir cómo se guardarán y servirán los binarios. [Costos y prerrequisitos](COSTS.md#almacenamiento-de-handouts)
