# AGENTS.md — DELTA GREEN / BLACK ARCHIVE

> Instrucciones persistentes para Codex. Este repositorio desarrolla un sitio de ficción interactiva para una campaña privada de tabletop RPG Delta Green. El propietario es el Handler. El objetivo es un producto real, pequeño, seguro, económico y sencillo de mantener.

## 1. Misión y producto

Construir **BLACK ARCHIVE**, el portal privado de la célula de agentes. Debe sentirse como una red de inteligencia clandestina, no como una wiki convencional. El contenido de juego está en **español**; los identificadores de código, nombres técnicos y mensajes de commit están en inglés.

La campaña es **La Gramática de la Carne**, con estas operaciones, en orden:
1. **A Victim of the Art** (primera operación, en curso).
2. **Viscid** (posterior; contenido oculto).
3. **The Observer Effect** (final; contenido oculto).

El Handler es el **Agente Asmodan**. Los jugadores son miembros de **Cell A**, cuyos aliases pueden incluir Atarax, Arcturus, Abner y Aslan; estos nombres son datos configurables, no roles de software.

**Estado conocido de la campaña, para semilla de desarrollo (editable por el Handler):** los agentes investigaron los asesinatos de Carl Maretti, Vanessa Hatvan y Lauren Harrogate; entrevistaron a la detective Gregson y al forense Santorini; obtuvieron registros telefónicos; Thomas Dengler escapó y conserva el amuleto; la célula sospecha una conexión sobrenatural pero no ha recuperado el objeto. X-Phenomenon publicó fotos de los agentes con #FedsOnCampus y #GlenridgeRipperCoverup. **Este estado no es estático: el Handler debe poder actualizarlo sin modificar código.** No presentar estas notas internas automáticamente a jugadores si no han sido reveladas.

## 2. Experiencia visual

- Estilo principal **BLACK ARCHIVE**: inteligencia federal analógica / thriller noir; oscuro, tinta, papel envejecido, fotografías, sellos RESTRICTED, bordes sutiles y tipografía monoespaciada solamente para datos y terminal.
- **GREENBOX**: consola CRT verde sobre negro para búsquedas, códigos y mensajes; debe ser usable y ofrecer alternativa normal accesible.
- **OBSERVER**: anomalías narrativas desbloqueadas exclusivamente por el Handler (nunca activadas arbitrariamente, nunca alteran los datos originales); reservar efectos fuertes para la tercera operación.
- Inspiración: expedientes burocráticos, investigaciones de conspiración, tablero de detective, grabaciones recuperadas; **no copiar interfaces, logos, fotografías o assets protegidos sin licencia**.
- Diseñar primero para móvil, pero con buen escritorio. Navegación rápida, legibilidad excelente y accesibilidad WCAG AA como objetivo.
- Reducir movimiento si `prefers-reduced-motion`; no usar jumpscares automáticos ni audio sin interacción explícita.
- El look cinematográfico no debe impedir el funcionamiento: documentos y controles siempre legibles; incluir modo de impresión.

## 3. Arquitectura y restricción de costo

Preferir, salvo que el repositorio existente indique otra cosa:
- **Vite + React + TypeScript** (SPA estática) y CSS sencillo o Tailwind si simplifica mantenimiento.
- **Firebase Hosting** para despliegue estático.
- **Firebase Authentication** para cuentas reales; usar correo y contraseña o proveedor de inicio de sesión compatible, configurado por el dueño.
- **Cloud Firestore** para documentos, desbloqueos, mensajes y progreso.
- **Firebase Emulator Suite** para desarrollo y pruebas de reglas.
- **Git** para versionado y CI opcional. No asumir GitHub si el remoto es otro proveedor.

Priorizar cuotas gratuitas y no requerir servicios con facturación para el MVP. No agregar Cloud Run, Cloud Functions, Vertex AI, almacenamiento privado de pago, bases de datos adicionales, servicios SaaS ni modelos de IA sin justificar su necesidad, estimar costo y obtener autorización del propietario. Para archivos del MVP, usar recursos públicos *solo si son realmente públicos*; contenido privado necesita una estrategia de almacenamiento y autorización comprobable. **No confundir una URL oculta o un nombre de archivo impredecible con seguridad.** Si no hay almacenamiento privado autorizado, mostrar metadatos protegidos y entregar documentos privados mediante el flujo seguro que se acuerde, sin incluir bytes confidenciales en el build público.

Registrar en `docs/COSTS.md` servicios usados, cuotas, posibles cargos y cómo activar alertas de presupuesto en GCP. Nunca afirmar que un servicio será siempre gratis.

## 4. Roles y permisos: prioridad absoluta

- `handler`: puede crear/editar operaciones, escenas, expedientes, NPC, conexiones, mensajes, permisos y desbloqueos; ve spoilers.
- `agent`: solo ve material publicado para su célula, contenido público y contenido dirigido específicamente a su usuario; puede registrar notas/evidencias *del jugador* si la función está habilitada.
- `guest`: sin expedientes privados; solo pantalla de acceso o una portada pública expresamente aprobada.

Aplicar autorización **en Firestore Security Rules**, no solo ocultando botones. Datos secretos de Handler, otras células y mensajes privados **no deben enviarse al cliente**. No guardar spoilers en `public/`, bundles estáticos, HTML, archivos JSON públicos, source maps publicados ni precargas. Los campos de visibilidad deben tener una política *deny by default*. Probar con Emulator Suite que un agente no puede leer ni modificar documentos inéditos, mensajes ajenos ni datos del Handler.

Modelo recomendado, ajustable al implementar:
- `users/{uid}`: perfil, alias, membresías.
- `cells/{cellId}`: nombre y configuración.
- `cells/{cellId}/members/{uid}`: rol/membresía.
- `cells/{cellId}/operations/{operationId}`: estado, datos visibles.
- `cells/{cellId}/dossiers/{dossierId}`: metadata y contenido publicado.
- `cells/{cellId}/messages/{messageId}`: remitente, audiencia, publicado.
- `cells/{cellId}/clues/{clueId}`: pistas liberadas.
- `cells/{cellId}/playerNotes/{noteId}`: aportes de jugadores.
- Mantener secretos del Handler en colecciones/rutas separadas con reglas estrictas, **nunca confiando en una propiedad `hidden=true` dentro de documentos legibles**.

Si se requieren tareas administrativas con privilegios, no hacerlas desde el SDK público mediante flags editables. Diseñar previamente una solución de roles verificados (por ejemplo, custom claims establecidos por flujo administrativo confiable) y reglas seguras. Documentar bootstrap del primer Handler sin publicar credenciales.

## 5. MVP — entregar en este orden

### Fase 0: inspección y plan
1. Inspeccionar estructura y tooling existentes antes de crear archivos; si ya existe app, respetar convenciones y no reinicializar sin motivo.
2. Redactar plan corto y descomponer en tareas pequeñas verificables.
3. Añadir `README.md`, `.env.example` sin secretos, `docs/ARCHITECTURE.md`, `docs/COSTS.md`, `docs/CONTENT_MODEL.md`.

### Fase 1: portal visual navegable
1. Login real con Firebase Auth y ruta protegida.
2. Dashboard Cell A: operación activa, últimos mensajes, contador de evidencias, estado, navegación.
3. Sección expedientes: listado, detalle, etiquetas, filtros, búsqueda, documentos publicados.
4. Sección personal / NPC: fichas, fotografías y conexiones **solo ya desbloqueadas**.
5. Panel del Handler para publicar u ocultar contenido sin redeploy.
6. Estados de carga, vacío, error; responsive y accesible.

### Fase 2: mecánicas investigativas
1. Mensajes individuales y para toda la célula con control de destinatario.
2. Códigos de acceso de ficción que desbloqueen expedientes. Validación de permisos en datos/reglas/servidor confiable; no poner códigos secretos reales como comparación en JS público.
3. Visor de evidencia (zoom, metadatos narrativos, comparación de imágenes) respetando los permisos.
4. Tablero visual de pistas y conexiones descubiertas por los agentes, sin exposición del grafo secreto del Handler.
5. Opcional: publicación de notas por jugadores y revisión por Handler.

### Fase 3: narrativa avanzada (solo después de aprobar)
1. Terminal GREENBOX.
2. Anomalías OBSERVER activables por Handler, con log y reversibilidad.
3. Notificaciones opcionales (no intrusivas y con permiso).
4. Integración Obsidian basada en exportación/importación aprobada, no en acceso implícito al vault local.

**No implementar toda la Fase 3 en el primer PR.** Acabar cada fase con flujo funcional y pruebas antes de ampliar alcance.

## 6. Contenido y spoilers

- Tratar los handouts, retratos y el texto de los escenarios como material privado con licencia; no subir automáticamente PDFs de los módulos ni distribuir contenido del libro.
- Los handouts originales del usuario y las adaptaciones creadas para su mesa pueden incorporarse solamente cuando el Handler autorice sus archivos exactos.
- En semillas de desarrollo, usar datos ficticios explícitos que puedan reemplazarse; no inventar hechos canónicos del módulo ni presentar conjeturas como canon.
- **Operaciones 2 y 3 comienzan invisibles para jugadores**, incluso en nombres de documentos, búsquedas, rutas o metadatos expuestos.
- Soportar estados `draft`, `review`, `published`, `archived` y, si aplica, `unlockedAt` con protección efectiva en reglas de acceso.
- Separar `handlerNotes` de `playerVisibleContent` en almacenamiento protegido. Un mensaje privado a un Agente no debe ser visible a otro.
- Registrar quién publicó y cuándo sin almacenar datos personales innecesarios.

## 7. Calidad de ingeniería

- TypeScript estricto; evitar `any`, datos simulados en rutas de producción y componentes gigantes.
- Dependencias mínimas; justificar bibliotecas grandes. Nunca exponer credenciales, service-account JSON ni tokens en el repo.
- Variables de entorno client-side contienen únicamente configuración pública de Firebase; no son secretos. Secretos, si los hay, deben vivir fuera del frontend.
- Validar entradas, sanitizar texto enriquecido y prevenir XSS; si hay Markdown, renderizar de forma segura.
- Separar UI, acceso a Firebase, tipos/esquemas, lógica de autorización y datos de contenido.
- Añadir pruebas para reglas Firestore (permitido/denegado), rutas protegidas, desbloqueos y el recorrido básico.
- Antes de terminar una tarea ejecutar los comandos existentes del repositorio (por ejemplo `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`). Si faltan, crearlos de forma razonable y documentarlos.
- No borrar datos remotos, cambiar reglas de producción, desplegar ni activar facturación sin pedir aprobación explícita.
- No usar `--force`, `git reset --hard` ni operaciones destructivas sin permiso.
- Los seeds deben ser idempotentes y, por defecto, usar emuladores.
- Diseñar experiencia offline solo para materiales autorizados; **no cachear spoilers ni mensajes privados sin análisis de riesgo**.

## 8. CI/CD y GCP

- Mantener `firebase.json`, `.firebaserc` documentado (sin asumir un project ID), Firestore Rules y archivos de índices bajo control de versiones.
- Incluir instrucciones para `firebase login`, seleccionar proyecto, lanzar emuladores y desplegar manualmente.
- Preferir identidad federada / Workload Identity Federation para CI cuando corresponda, evitando claves JSON de cuentas de servicio de larga vida.
- No crear recursos en GCP ni modificar IAM/billing sin autorización explícita.
- Despliegues: primero preview/test, después producción tras aprobación.
- Configurar políticas de acceso y pruebas de rules antes de poner datos reales.

## 9. Organización sugerida

```text
src/
  app/              # rutas, providers, guards
  components/       # UI reutilizable
  features/
    auth/
    dashboard/
    dossiers/
    messages/
    evidence/
    investigation-board/
    handler/
  lib/firebase/      # inicialización y adaptadores
  styles/
  types/
public/              # SOLO assets realmente públicos
firestore.rules
firestore.indexes.json
docs/
tests/
```

La estructura es una referencia, no una orden de destruir la existente.

## 10. Definición de terminado

Una función está terminada únicamente cuando:
1. Cumple el flujo de usuario previsto y funciona en móvil/escritorio.
2. No filtra material de Handler a agentes mediante rutas, Firestore, HTML o assets.
3. Tiene pruebas proporcionales al riesgo, especialmente permisos.
4. Pasa lint, typecheck, tests y build, o reporta precisamente qué no pudo ejecutarse.
5. Documenta configuración, datos requeridos, decisiones técnicas y posibles costos.
6. Incluye un resumen breve de archivos modificados, cómo probar y preguntas pendientes.

## 11. Primera tarea para Codex

Si el repositorio está vacío: crea el esqueleto de la **Fase 1** con Vite + React + TypeScript, identidad visual BLACK ARCHIVE, navegación mock de demostración claramente etiquetada, configuración Firebase mediante `.env.example`, y prepara Auth/Firestore/rules/emuladores; no publiques contenido privado ni despliegues aún. Presenta un plan conciso antes de editar y pregunta únicamente por valores externos imprescindibles, como el ID del proyecto Firebase, cuando haga falta conectar o desplegar.

Si ya hay código: inspecciónalo, identifica diferencias con este documento y propón el menor conjunto de cambios útil antes de implementarlos.

**Prioridad transversal: inmersión de los jugadores + confidencialidad de spoilers + costo mínimo.**
