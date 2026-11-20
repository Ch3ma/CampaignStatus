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
