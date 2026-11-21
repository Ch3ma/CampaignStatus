# Handouts locales

Ejecuta la demo y la semilla siguiendo el [README](../README.md) o la [guía de Docker](DOCKER.md). La semilla añade un PNG ficticio y un PDF ficticio para probar el visor. Los archivos seleccionados por el Handler se guardan en Cloud Storage for Firebase, emulado localmente, y su ficha se guarda en Firestore.

## Cargar y publicar

1. Entra como Handler y abre **Panel del Handler → Handouts → Nuevo handout**.
2. Selecciona un PNG, JPEG, WebP o PDF autorizado de hasta **64 MiB** con la configuración predeterminada. El formulario muestra tipo, tamaño y nombre local. Puedes revisar una vista previa antes de guardar.
3. Completa la ficha y elige una operación. Añade vínculos con **Referencia visible** y **Referencia privada**. Guarda fuente, páginas, sección y notas en **Editar procedencia y referencias privadas**.
4. Pulsa **Guardar borrador**. Vuelve a abrir el registro en otra sesión para consultar la misma ficha y el mismo archivo. **Vista previa como agente** simula lo que vería una cuenta del jugador después de publicar.
5. Confirma la publicación en el panel. En una sesión de agente abre **Expedientes** o **Evidencias → Consultar archivo multimedia**. El agente ve los destinos previamente publicados y autorizados para la célula. Los vínculos privados y la procedencia permanecen en el panel del Handler.
6. Archiva el handout para bloquear nuevas lecturas. Guardar cambios de ficha o referencias en una publicación la retira a revisión. Publícala de nuevo para que se vea la revisión.

## Imagen, PDF y descargas

El visor permite zoom, ajuste al ancho y texto alternativo. El PDF también ofrece navegación por páginas y texto extraíble. **Permitir descargar desde el visor** habilita la descarga y el botón para imprimir la página actual de un PDF. Un lector autorizado que recibió los bytes puede conservar una copia por otros medios.

La vista previa usa una URL temporal en memoria, revocada al cerrar o cambiar de archivo. El nombre local que aparece al seleccionar el archivo se queda en el navegador. La descarga utiliza el ID del handout. El formato, la firma y la longitud se comprueban en el navegador. Las reglas exigen rol de Handler, revisión pendiente, longitud coincidente con Firestore y un objeto inmutable en Storage. El tamaño de nuevas revisiones se configura por célula con `maxBytes` y en el navegador con `VITE_HANDOUT_MAX_MIB`. El techo compatible es de 128 MiB porque Web Crypto y el visor PDF procesan el archivo completo en memoria. Usa un límite menor si los equipos de la célula tienen poca memoria.

El flujo conserva el archivo seleccionado. Revisa metadatos incrustados, adjuntos y páginas antes de publicar. Usa solo copias exactas autorizadas para la célula. El fascículo original queda en el workspace del Handler, excluido de Git, Docker y el servidor de desarrollo. Registra hashes de fuentes reservadas antes de habilitar un bucket real. El emulador inicializa la política con una fuente ficticia y permite ampliar la lista con `BLACK_ARCHIVE_RESERVED_SHA256` al correr la semilla.

## Persistencia

Con Docker, el emulador exporta Auth, Firestore y Storage al volumen local `emulator-data` al apagarse normalmente y los importa al arrancar con el mismo proyecto de Compose. Los cambios posteriores a la última exportación pueden perderse si se interrumpe Docker o el sistema. El volumen contiene material de campaña y debe mantenerse local. En una sesión con `npm run emulators` sin Docker, los datos permanecen hasta que se detiene el emulador. [Importación y exportación de Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure?hl=es)

La carga resumible muestra progreso y se puede cancelar. Reintenta una carga pendiente con el mismo archivo. Tras recargar la app, si el objeto completo ya quedó guardado se verifica y reutiliza. Si faltan bytes se inicia otra sesión de carga para esa revisión. Puedes descartar la revisión incompleta o restaurar una revisión finalizada. Al reemplazar o restaurar una ficha publicada, pasa a revisión y el Handler decide cuándo volver a publicarla. En producción, habilita el bucket únicamente después de completar el [plan de GCP](GCP_STORAGE_SETUP.md). [Costos y prerrequisitos](COSTS.md#almacenamiento-de-handouts)
