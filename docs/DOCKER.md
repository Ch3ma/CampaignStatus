# BLACK ARCHIVE con Docker

## Demo local

Necesitas Docker Engine y Docker Compose v2. Desde la raíz del repositorio:

```sh
docker compose up --build -d
docker compose logs -f emulators
```

Cuando el registro indique que los emuladores están listos, presiona Ctrl+C para dejar de seguir el registro y ejecuta:

```sh
docker compose exec emulators npm run seed
```

Abre http://127.0.0.1:5173 y elige la cuenta ficticia de Agente o Handler. La interfaz de Emulator Suite está en http://127.0.0.1:4000. Los servicios publicados están vinculados a loopback. Los contenedores usan el proyecto `demo-black-archive`. Compose conserva descargas y datos en volúmenes distintos. `docker compose down` da tiempo al emulador para exportar las cuentas, las fichas, sus archivos y los objetos de Storage. El siguiente `docker compose up -d` con el mismo proyecto importa el estado. Un cierre abrupto puede perder cambios desde la última exportación. Conserva el volumen de datos para conservar los borradores.

## Pruebas

```sh
docker compose run --rm --no-deps web sh -c 'npm run lint && npm run typecheck && npm test && npm run build'
docker compose run --rm --no-deps emulators npm run test:rules
docker compose down
```

Para probar los visores de imagen y PDF en Chromium, conserva la demo en ejecución y ejecuta `npm ci`, `npx playwright-core install chromium` y `npm run test:browser` en el host. Para la suite completa, usa una instancia de pruebas recién sembrada y separada de tus datos de campaña.

Los contenedores de prueba usan sus propios puertos internos y pueden ejecutarse junto a la demo. Si cambias el código, ejecuta `docker compose build` para actualizar las imágenes de prueba.

## Imagen estática

El objetivo `runtime` produce una imagen Nginx sin privilegios que solo contiene la salida estática. Reutiliza las mismas reglas y el proyecto Firebase dedicado que use la campaña. Los argumentos de la imagen contienen la configuración web pública de Firebase.

```sh
docker build --target runtime -t black-archive:local \
  --build-arg PUBLIC_FIREBASE_WEB_KEY \
  --build-arg PUBLIC_FIREBASE_DOMAIN \
  --build-arg VITE_FIREBASE_PROJECT_ID \
  --build-arg VITE_FIREBASE_APP_ID .
docker run --rm -p 127.0.0.1:8180:8080 black-archive:local
```

Para una prueba de empaquetado, las variables pueden quedar vacías. La página informará que falta la configuración de Firebase. Antes de exponer la imagen a usuarios, comprueba la configuración del proyecto autorizado, las reglas y los dominios de autenticación. El despliegue queda sujeto a aprobación. El contexto de Docker tiene una lista de archivos permitidos y excluye el fascículo, las notas del Handler y los archivos de credenciales.
