# Cuotas y costos

El desarrollo con Emulator Suite es local. Para un proyecto de campaña dedicado, la SPA con Auth y Firestore puede operar en Spark, sujeto a las cuotas vigentes.

| Servicio | Uso | Referencia de Spark |
| --- | --- | --- |
| Firebase Authentication | Correo y contraseña | Proveedor básico, con límites de uso para operaciones como verificación y restablecimiento |
| Cloud Firestore Standard | Membresías, registros y retratos pequeños | 1 GiB almacenado, 50 000 lecturas al día, 20 000 escrituras al día, 20 000 borrados al día y 10 GiB de salida mensual |
| Firebase Hosting | SPA y estilos estáticos | 10 GB de almacenamiento y 360 MB diarios de transferencia, según la tabla de precios consultada |

Verifica las cuotas para el plan, la edición y la región antes de crear recursos. Los listeners vuelven a consumir lecturas al conectarse y cuando cambian sus documentos. Los retratos también consumen almacenamiento y transferencia. En Spark, agotar cuotas puede interrumpir el servicio. En Blaze, el uso sobre la cuota incluida puede generar cargos. [Precios de Firebase](https://firebase.google.com/pricing) · [Cuotas de Firestore](https://firebase.google.com/docs/firestore/quotas) · [Límites de Authentication](https://firebase.google.com/docs/auth/limits)

Si en otra fase se autoriza vincular una cuenta de facturación, abre **Cloud Billing → Budgets & alerts**, crea un presupuesto, limita su alcance al proyecto de campaña, define el importe mensual y configura umbrales de alerta como 50 %, 90 % y 100 %. Los presupuestos de solo alerta avisan del consumo y el gasto puede continuar después de superar el umbral. [Documentación de presupuestos de Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/budgets)

## Almacenamiento de handouts

Los emuladores de Auth, Firestore y Storage usan disco local, sin costos de Google Cloud. Los handouts nuevos usan Storage. El límite por archivo es de 64 MiB por defecto y puede configurarse entre 1 y 128 MiB. Firestore valida el límite administrativo por célula al abrir una revisión. Storage exige el tamaño exacto de esa revisión más 28 bytes de cifrado. El flujo inline heredado conserva 100 KiB en el emulador. Google Cloud Storage tiene límites por objeto y proyecto. [Cuotas de Storage](https://cloud.google.com/storage/quotas)

Cloud Storage for Firebase exige **Blaze**, incluso para el bucket predeterminado. Como referencia en USD, el ejemplo oficial de Standard en `us-east1` usa USD 0.020 por GB-mes, USD 0.005 por 1 000 operaciones de clase A y USD 0.0004 por 1 000 operaciones de clase B para espacio de nombres plano. El ejemplo de transferencia a internet usa USD 0.12 por GB en el primer tramo para su destino. La capa sin costo, el egreso, las operaciones y la región pueden cambiar el costo efectivo. Recalcula para los destinos y la región aprobada. [Requisitos de Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) · [Precios y capa sin costo](https://cloud.google.com/storage/pricing) · [Ejemplos de costos](https://cloud.google.com/storage/pricing-examples)

La capa Always Free elegible se agrega entre `us-west1`, `us-central1` y `us-east1`. Incluye mensualmente 5 GB-mes de Standard, 5 000 operaciones de clase A, 50 000 de clase B y 100 GB de transferencia desde Norteamérica a destinos elegibles. Verifica las exclusiones de destino y los requisitos de la cuenta. [Límites de Always Free](https://cloud.google.com/storage/pricing#cloud-storage-always-free-usage-limits)

La lectura del objeto consulta membresía y publicación en Firestore y descarga el archivo completo. El almacenamiento acumulado incluye revisiones retenidas, objetos pendientes y borrados recuperables. Revisa revisiones retenidas y pendientes antes de configurar políticas de ciclo de vida. Usa los límites de tamaño de la aplicación y las alertas del proyecto aprobadas. [Plan del bucket privado](GCP_STORAGE_SETUP.md)
