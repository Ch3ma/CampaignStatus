# Cuotas y costos

El desarrollo con Emulator Suite es local. Para un proyecto de campaña dedicado, el MVP está diseñado para operar en Spark, sujeto a las cuotas vigentes.

| Servicio | Uso | Referencia de Spark |
| --- | --- | --- |
| Firebase Authentication | Correo y contraseña | Proveedor básico, con límites de uso para operaciones como verificación y restablecimiento |
| Cloud Firestore Standard | Membresías, registros y retratos pequeños | 1 GiB almacenado, 50 000 lecturas al día, 20 000 escrituras al día, 20 000 borrados al día y 10 GiB de salida mensual |
| Firebase Hosting | SPA y estilos estáticos | 10 GB de almacenamiento y 360 MB diarios de transferencia, según la tabla de precios consultada |

Verifica las cuotas para el plan, la edición y la región antes de crear recursos. Los listeners vuelven a consumir lecturas al conectarse y cuando cambian sus documentos. Los retratos también consumen almacenamiento y transferencia. En Spark, agotar cuotas puede interrumpir el servicio. En Blaze, el uso sobre la cuota incluida puede generar cargos. [Precios de Firebase](https://firebase.google.com/pricing) · [Cuotas de Firestore](https://firebase.google.com/docs/firestore/quotas) · [Límites de Authentication](https://firebase.google.com/docs/auth/limits)

Si en otra fase se autoriza vincular una cuenta de facturación, abre **Cloud Billing → Budgets & alerts**, crea un presupuesto, limita su alcance al proyecto de campaña, define el importe mensual y configura umbrales de alerta como 50 %, 90 % y 100 %. Los presupuestos de solo alerta avisan del consumo y el gasto puede continuar después de superar el umbral. [Documentación de presupuestos de Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/budgets)

## Almacenamiento de handouts

La carga de imágenes y PDF utiliza Firestore Emulator Suite y un volumen local de Docker. Consume espacio en el equipo para guardar archivos y exportaciones. La demostración funciona sin facturación, con un límite de 100 KiB por documento de archivo, por debajo del máximo de Firestore. [Límites de Firestore](https://firebase.google.com/docs/firestore/quotas) Cada handout consultado puede generar lecturas adicionales de ficha, imagen y referencias si se lleva el modelo a un entorno real. Los archivos grandes requieren un almacén de binarios.

Cloud Storage for Firebase requiere **Blaze**, incluso para el bucket predeterminado. La capa sin costo depende de la ubicación, las operaciones, los bytes almacenados y las transferencias. Si se aprueba para un corte posterior, hace falta un bucket privado en el proyecto dedicado, reglas de Storage por membresía y publicación, acceso a Firestore desde esas reglas y CORS para los orígenes admitidos. La lectura debe usar el SDK autenticado. Las URL de descarga tokenizadas requieren un diseño adicional de revocación o cifrado para que no sirvan de acceso reutilizable. La [demostración](HANDOUTS.md) se puede probar localmente mientras se decide ese almacenamiento. [Requisitos de Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) · [Descarga autenticada y CORS](https://firebase.google.com/docs/storage/web/download-files) · [Precios de Cloud Storage](https://cloud.google.com/storage/pricing)
