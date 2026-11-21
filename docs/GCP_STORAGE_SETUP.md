# Bucket privado de handouts en GCP

## Plan

El código usa Cloud Storage for Firebase sobre un bucket de Google Cloud Storage. Los emuladores de Auth, Firestore y Storage permiten probarlo sin un proyecto real. El aprovisionamiento queda pendiente de confirmar los siguientes datos.

| Parámetro | Decisión pendiente |
| --- | --- |
| Proyecto | ID del proyecto Firebase dedicado a BLACK ARCHIVE |
| Ubicación | Región confirmada según residencia y costos |
| Facturación | Aprobación explícita de Blaze y aceptación de cargos |
| Presupuesto | Importe, umbrales y destinatarios de alertas |
| Bucket | Nombre efectivo, normalmente `PROJECT_ID.firebasestorage.app` |

El bucket predeterminado se crea desde Firebase Console para quedar asociado desde el inicio con Cloud Storage for Firebase. Google administra el cifrado del bucket. La aplicación cifra también cada revisión con AES-GCM y almacena su clave bajo reglas de Firestore. Para un bucket con nombre personalizado, importa el bucket en Firebase y verifica que el target de reglas de Storage apunte a ese bucket antes de continuar. [Requisitos de Firebase Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) · [Buckets personalizados](https://firebase.google.com/docs/storage/web/start)

## Aplicación tras la aprobación

1. Confirma el proyecto, presupuesto y región, e inicia sesión con una cuenta administradora humana. Tras la aprobación de Blaze, crea el bucket predeterminado desde **Firebase Console → Storage → Get started** en modo de producción. Mantén las reglas cerradas mientras configuras el acceso. Con la API de Cloud Storage for Firebase habilitada, el método oficial equivale a lo siguiente. Ejecuta una sola de las dos opciones de creación. [API de aprovisionamiento de Firebase](https://firebase.google.com/docs/reference/rest/storage/rest/v1alpha/projects.defaultBucket/create)

```sh
gcloud auth login
FIREBASE_PROJECT='ID_APROBADO'
HANDOUTS_REGION='REGION_APROBADA'
gcloud auth print-access-token | sed 's/^/Authorization: Bearer /' |
  curl --fail-with-body --silent --show-error --header @- \
    --header 'Content-Type: application/json' \
    --data "{\"location\":\"$HANDOUTS_REGION\"}" \
    "https://firebasestorage.googleapis.com/v1alpha/projects/$FIREBASE_PROJECT/defaultBucket"
```

2. Aplica clase Standard, acceso uniforme y prevención de acceso público. Configura CORS para las descargas directas del SDK desde el origen `https://ch3ma.github.io`. CORS trabaja por origen, sin la ruta `/CampaignStatus/`. La autenticación y las reglas controlan los permisos sobre los archivos. [Descarga autenticada y CORS de Firebase](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)

```sh
# Sustituye únicamente después de confirmar proyecto, región y nombre.
FIREBASE_PROJECT='ID_APROBADO'
HANDOUTS_BUCKET='BUCKET_CONFIRMADO'
cat > /tmp/black-archive-storage-cors.json <<'JSON'
[
  {
    "origin": ["https://ch3ma.github.io"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
JSON

gcloud storage buckets update "gs://$HANDOUTS_BUCKET" --project "$FIREBASE_PROJECT" \
  --default-storage-class=STANDARD --uniform-bucket-level-access --public-access-prevention \
  --cors-file=/tmp/black-archive-storage-cors.json
gcloud storage buckets describe "gs://$HANDOUTS_BUCKET" --project "$FIREBASE_PROJECT"
gcloud storage buckets get-iam-policy "gs://$HANDOUTS_BUCKET" --project "$FIREBASE_PROJECT"
```

Verifica también que la política de IAM, incluidas sus vinculaciones heredadas, tenga únicamente los principals autorizados y carezca de `allUsers` y `allAuthenticatedUsers`. El código usa Firebase Authentication y las reglas de Firebase, con el bucket privado para los accesos de GCS. [gcloud storage buckets update](https://docs.cloud.google.com/sdk/gcloud/reference/storage/buckets/update) · [Configuración CORS](https://docs.cloud.google.com/storage/docs/cors-configurations)

3. En un entorno de prueba aprobado, aplica las reglas del repositorio al bucket conectado a Firebase y a Firestore. La primera aplicación de reglas que usan `firestore.get` solicita habilitar la integración del agente de servicio administrado. Confirma esa solicitud con el propietario y evita claves JSON persistentes.

```sh
npx firebase login
npx firebase deploy --only firestore:rules,storage --project "$FIREBASE_PROJECT"
```

4. Activa el proveedor **Correo electrónico/contraseña** en Firebase Authentication y crea las cuentas de prueba de Handler y Agente. En Firestore, crea `cells/cell-a` con `name: "Cell A"` y `cells/cell-a/members/UID` para cada cuenta autorizada, con `alias` de tipo string y `role` igual a `handler` o `agent`. Una cuenta externa de prueba carece de membresía. Crea y publica una operación de prueba a través del Panel del Handler antes de publicar un handout.
5. Crea en Firestore `cells/cell-a/handoutPolicy/sources` con `blockedHashes` como lista de SHA-256 de las fuentes reservadas y `maxBytes` como entero entre 1 048 576 y 134 217 728. Calcula cada digest localmente con `sha256sum ARCHIVO` y registra solo el hash. El límite predeterminado del backend es 67 108 864 B (64 MiB). Cambiarlo afecta nuevas revisiones. Configura `VITE_FIREBASE_STORAGE_BUCKET` con el nombre confirmado y `VITE_HANDOUT_MAX_MIB` con el límite del navegador.
6. Comprueba con archivos inventados que el Handler finaliza la carga, un agente autorizado lee solo la revisión publicada y otro usuario carece de acceso. Archiva y confirma que se deniegan nuevas lecturas. Comprueba las reglas con las credenciales de usuario Firebase y revisa IAM con la cuenta administradora. [Integración entre Storage Rules y Firestore](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_firestore)
7. Antes de entregar material real, fija presupuesto y alertas, revisa la clasificación del material y documenta un procedimiento para reinstalar reglas y respaldar datos. [Costos](COSTS.md#almacenamiento-de-handouts)

## Migración y retención

Los datos inline de hasta 100 KiB siguen visibles en los emuladores. Para una ficha preexistente cuya copia esté autorizada, selecciona su archivo mediante **Seleccionar archivo de reemplazo**. El mismo ID de ficha conserva metadatos y vínculos. La revisión activa se mueve al bucket cuando termina la carga y su aprobación sigue a cargo del Handler. No hay migración automática.

Una carga interrumpida queda pendiente. El mismo archivo permite reintentar y el botón de descarte limpia solo su revisión incompleta. Se retienen revisiones finalizadas para restauración; el borrado administrativo de revisiones retenidas requiere aprobación y comprobación de que no estén activas, pendientes ni en limpieza. Deja que expiren las sesiones de carga abandonadas antes de inventariar objetos huérfanos. Evita políticas de caducidad generales que borren revisiones activas. Cada revisión genera una clave AES-256 aleatoria y un nonce de 96 bits por intento. AES-GCM autentica también célula, ficha, revisión y MIME. La clave se guarda separada en Firestore y las reglas solo entregan al agente la clave de la revisión activa publicada. El cliente verifica el objeto antes de publicar o restaurar. Firestore y Storage carecen de una transacción compartida: el Handler es el editor de confianza, y la comprobación SHA-256 de fuentes bloqueadas y el cifrado operan sobre los bytes en el cliente. Una URL con token emitido por Firebase puede seguir devolviendo el texto cifrado aunque la ficha se archive. Un usuario que ya recibió el archivo o su clave mientras tenía acceso puede conservarlo.
