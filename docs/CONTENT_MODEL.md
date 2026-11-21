# Modelo de contenido

| Ruta relativa a `cells/{cellId}` | Contenido | Lectura |
| --- | --- | --- |
| `members/{uid}` | `role` y `alias` | Titular de la membresía |
| `operations/{id}` | Informe y estado operativo (`stage`) | Handler o miembro con publicación |
| `dossiers/{id}` | Índice, etiquetas y documento de texto | Handler o miembro con publicación |
| `personnel/{id}` | Ficha, retrato y conexiones liberadas | Handler o miembro con publicación |
| `clues/{id}` | Evidencia liberada en texto | Handler o miembro con publicación |
| `messages/{id}` | Comunicación de célula o directa | Handler, célula o destinatario, según publicación |
| `handlerNotes/{id}` | Notas reservadas en documentos separados | Handler |

Los registros editables tienen un título, categoría, resumen, cuerpo y etiquetas separadas por comas. El estado inicial es `draft`. `review` reserva un registro para revisión. Solo `published` autoriza la lectura de agentes y `archived` retira la publicación. Al guardar una versión publicada, las reglas exigen UID del Handler y marcas de tiempo del servidor en `publishedBy`, `publishedAt` y `updatedAt`. Ocultar conserva los datos de la última publicación. El panel muestra como operación actual la última operación publicada. Mantén una sola operación publicada si quieres presentar una única operación activa.

La audiencia `cell` entrega el registro a miembros de la célula. Para `messages`, `direct` requiere un `recipientUid` y solo autoriza al agente con ese UID y una membresía vigente. Toda ficha publicada, incluidas sus conexiones y su retrato, se libera como unidad. Guarda las conexiones pendientes y las anotaciones reservadas en `handlerNotes`. Esa colección se administra por consola en esta fase y el portal carece de una pantalla para consultarla.

Los retratos autorizados se guardan en Firestore junto a la ficha, como JPEG, PNG o WebP de hasta 134 kB antes de codificar. El MVP admite documentos de texto e impresión. Los PDF y archivos privados grandes quedan pendientes de un flujo de entrega autorizado. Incorpora únicamente material que el Handler haya autorizado para esa audiencia.

Las operaciones futuras y el contenido real de campaña deben comenzar como borradores privados. La semilla incluye una operación ficticia e independiente y vive en `scripts/`.

## Handouts de demostración

Las rutas son relativas a `cells/{cellId}`.

| Ruta | Datos | Acceso |
| --- | --- | --- |
| `handouts/{id}` | Título, categoría, resumen, texto alternativo, fecha narrativa, etiquetas, clasificación, MIME, longitud, descarga habilitada, estado y auditoría | Handler o agente tras publicación |
| `handouts/{id}/files/preview` | Bytes inmutables de PNG, JPEG, WebP o PDF, hasta 100 KiB en emulador | Handler o agente mientras esté publicado |
| `handouts/{id}/relations/{slot}` | Tipo e ID del destino, incluida la operación | Handler o agente con origen y destino publicados |
| `handouts/{id}/private/provenance` | Documento, página, sección, notas, páginas de apoyo y referencias privadas | Handler |

El índice accesible al agente no guarda IDs de relación, conteos ni nombres internos. Para cada ficha, el cliente consulta posiciones fijas de relación, incluida `operation`. Las reglas deniegan posiciones vacías y destinos no autorizados. Sólo se admiten vínculos visibles a operaciones, handouts, expedientes, personal y evidencias. Las relaciones reservadas se guardan en el documento privado, ajenas a dichas posiciones. Los registros enlazados se identifican por tipo e ID. El campo privado de procedencia acepta hasta seis referencias internas y la ficha admite hasta seis vínculos visibles más la operación.

El panel guarda la ficha, el archivo, los vínculos y la procedencia en una sola escritura atómica en el emulador. Crear una ficha exige estado `draft`, autor y fecha del servidor. Para publicar, las reglas verifican la operación publicada y el archivo registrado y conservan una marca de tiempo junto al UID del Handler. La operación vinculada deja de aparecer en la ficha si se retira dicha operación. Cada handout mantiene su propio estado de publicación.

### Binarios en Storage

La ficha incorpora `cloud.active`, `cloud.pending` y `cloud.cleanup` con IDs opacos. `cloud.pendingBytes` liga el tamaño del objeto al tamaño aprobado para la revisión pendiente. Las revisiones se conservan en `versions/{id}`, de lectura exclusiva del Handler. Las claves separadas en `keys/{id}` se liberan solo para la revisión activa de una ficha publicada. El objeto cifrado vive bajo `cell-handouts/{cellId}/{handoutId}/{versionId}/content`. La política `handoutPolicy/sources` reserva hashes de fuentes privadas y define el límite de tamaño de nuevas revisiones de la célula.

La ficha solo se publica con una revisión finalizada, sin cambios pendientes, y con la operación autorizada. El Handler puede restaurar una revisión anterior y liberar la nueva ficha con una acción explícita. Los archivos inline del emulador se leen con el flujo heredado hasta que una revisión de Storage pasa a activa.
