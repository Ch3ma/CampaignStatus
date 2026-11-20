# GitHub Pages

El destino previsto es **https://ch3ma.github.io/CampaignStatus/**. La compilación de Pages usa la base `/CampaignStatus/` y rutas hash como `/CampaignStatus/#/expedientes/ID`. Al recargar, Pages sirve el mismo HTML y React restaura la ruta. Firebase Hosting y Docker conservan sus rutas actuales. [Configuración de Vite para Pages](https://vite.dev/guide/static-deploy.html#github-pages)

## Resultado de la auditoría

Gitleaks y las comprobaciones dirigidas cubrieron las nueve revisiones alcanzables al inicio, los refs de ramas y PR, código rastreado, issues, comentarios, revisiones y diffs disponibles. No se detectaron claves privadas, tokens ni credenciales administrativas en ese material. La API de Actions devolvió cero variables y cero entradas de secretos de repositorio. La revisión encontró una dirección personal en la autoría de tres commits de merge. El valor se omite. La configuración real de Firebase, restricciones de clave y dominios autorizados queda pendiente de confirmar el proyecto.

## Comprobaciones antes de publicar

1. Confirma la auditoría de credenciales e historial. Se identificó correo personal de autor en commits de merge históricos. Resuelve ese dato con el propietario antes del primer despliegue y configura el correo de GitHub `noreply` para futuros commits y merges. El historial existente requiere una decisión aparte.
2. En GitHub **Settings → Pages**, verifica que **Source** sea **GitHub Actions**. Configura las variables de Actions `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID` con la configuración web pública del proyecto confirmado. Usa `VITE_FIREBASE_STORAGE_BUCKET` solo tras habilitar un bucket autorizado. `VITE_HANDOUT_MAX_MIB` es opcional.
3. En Firebase Authentication confirma la autorización del dominio `ch3ma.github.io` y revisa las restricciones de la clave web para los servicios que usa la aplicación. Verifica reglas, membresías y CORS de Storage con cuentas de prueba. La cuenta de servicio, credenciales de GCP y los archivos privados quedan fuera de las variables públicas y del artefacto.
4. Cuando el propietario apruebe el despliegue, establece la variable de repositorio `PAGES_RELEASE_APPROVED` a `true`. Ejecuta **Actions → GitHub Pages → Run workflow** sobre `main`. El workflow se ejecuta manualmente. El trabajo que publica en el entorno `github-pages` recibe solo los permisos para Pages y emisión de identidad. Si se usa revisión del entorno, debe completarse antes de publicar.

GitHub Pages sirve únicamente el build público. Firestore y Storage autorizan los registros y binarios. La activación de Pages es independiente del aprovisionamiento del bucket privado.

## Prueba local

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build:pages
npm run test:pages
```

`test:pages` requiere Chromium de Playwright y los emuladores sembrados. Comprueba la compilación estática y repite la navegación autenticada con la configuración de rutas para el subdirectorio. `build:pages` inspecciona el artefacto para excluir binarios de campaña, mapas de código y marcadores de credenciales o emuladores.
