# BLACK ARCHIVE

Portal privado de campaña para Cell A. Esta versión local de la Fase 1 usa una operación de demostración ficticia. El contenido de campaña se administra en Firestore y se publica desde el panel del Handler.

## Demostración local

Necesitas Node.js 22.13 o posterior, npm y Java 21 o posterior para el emulador de Firestore. La primera ejecución puede descargar el emulador.

```sh
npm ci
cp .env.example .env.local
npm run emulators
```

Cuando estén listos los emuladores, abre otra terminal en el mismo directorio.

```sh
npm run seed
npm run dev
```

Abre la URL que muestra Vite (normalmente http://localhost:5173) y elige **Entrar como agente** o **Entrar como Handler**. El formulario también acepta las cuentas locales que crea la semilla.

| Rol | Correo de prueba | Contraseña de prueba |
| --- | --- | --- |
| Agente | `agent@example.test` | `archive-demo-agent` |
| Handler | `handler@example.test` | `archive-demo-handler` |

**Recorrido sugerido.** Entra como agente y verifica que el expediente «Informe en preparación» esté ausente. Cierra sesión, entra como Handler y cambia la visibilidad del expediente a **Publicado**. Vuelve como agente para consultar el expediente y sus controles de impresión. Cambia la visibilidad a **Archivado** para retirarlo. Puedes usar dos ventanas privadas independientes para observar los cambios en vivo.

El programa de semilla apunta a Auth y Firestore en loopback con el ID `demo-black-archive`. Repetir el comando conserva los registros existentes. Con Docker, un apagado normal conserva los cambios en el volumen de datos. Con `npm run emulators` fuera de Docker, los cambios se mantienen durante la sesión local. Su interfaz de administración es http://localhost:4000.

## Verificar

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:rules
```

Detén primero el emulador manual antes de ejecutar `test:rules`. Ese comando inicia y detiene una instancia de prueba propia con los mismos puertos. El build con las variables vacías compila y muestra un estado de configuración pendiente al abrirlo.

## Configuración real cuando se apruebe el proyecto

1. Usa un proyecto Firebase dedicado a BLACK ARCHIVE y registra una aplicación web. Activa el proveedor de correo y contraseña y prepara Firestore en modo de producción. Conserva el modo Spark mientras se evalúe el uso.
2. Copia la configuración web de Firebase a `.env.local` a partir de [.env.example](.env.example). Desactiva `VITE_USE_EMULATORS`. Las variables `VITE_FIREBASE_*` son públicas y se empaquetan al compilar.
3. Autentica la CLI con `npx firebase login`. Selecciona y confirma el proyecto independiente con `npx firebase use --add`. Usa un alias como `black-archive`. El archivo local `.firebaserc` guarda la relación de alias e ID. Para una operación manual, indica además el ID confirmado mediante `--project`.
4. Aplica el [bootstrap de cuentas](docs/ARCHITECTURE.md#bootstrap-del-primer-handler) desde las consolas autorizadas. Verifica el acceso con datos ficticios antes de incorporar material de campaña.
5. Las reglas y el alojamiento se configuran en `firebase.json`. Tras aprobación explícita, usa primero un proyecto de prueba, compila contra su configuración y aplica las reglas con `npx firebase deploy --only firestore:rules,firestore:indexes --project ID_DE_PRUEBA`. Previsualiza la interfaz con `npx firebase hosting:channel:deploy prueba --project ID_DE_PRUEBA`. Para el proyecto definitivo, repite la validación de identidad, configuración y permisos. Con aprobación de producción, compila contra el ID definitivo y usa `npx firebase deploy --only firestore:rules,firestore:indexes,hosting --project ID_DE_CAMPAÑA`.

Las credenciales de Git y GCP se gestionan con sus mecanismos de inicio de sesión existentes. Mantén tokens y claves fuera de los archivos del proyecto. Las rutas de esta fase usan `cell-a`; las membresías y nombres visibles son datos de Firestore.

- [Handouts multimedia · carga local de imagen y PDF](docs/HANDOUTS.md)
- [Pruebas locales e imagen estática con Docker](docs/DOCKER.md)
- [Arquitectura y bootstrap](docs/ARCHITECTURE.md)
- [Modelo de contenido y publicación](docs/CONTENT_MODEL.md)
- [Costos y cuotas](docs/COSTS.md)
