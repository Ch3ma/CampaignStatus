# Cuotas y costos

El desarrollo con Emulator Suite es local. Para un proyecto de campaña dedicado, el MVP está diseñado para operar en Spark, sujeto a las cuotas vigentes.

| Servicio | Uso | Referencia de Spark |
| --- | --- | --- |
| Firebase Authentication | Correo y contraseña | Proveedor básico, con límites de uso para operaciones como verificación y restablecimiento |
| Cloud Firestore Standard | Membresías, registros y retratos pequeños | 1 GiB almacenado, 50 000 lecturas al día, 20 000 escrituras al día, 20 000 borrados al día y 10 GiB de salida mensual |
| Firebase Hosting | SPA y estilos estáticos | 10 GB de almacenamiento y 360 MB diarios de transferencia, según la tabla de precios consultada |

Verifica las cuotas para el plan, la edición y la región antes de crear recursos. Los listeners vuelven a consumir lecturas al conectarse y cuando cambian sus documentos. Los retratos también consumen almacenamiento y transferencia. En Spark, agotar cuotas puede interrumpir el servicio. En Blaze, el uso sobre la cuota incluida puede generar cargos. [Precios de Firebase](https://firebase.google.com/pricing) · [Cuotas de Firestore](https://firebase.google.com/docs/firestore/quotas) · [Límites de Authentication](https://firebase.google.com/docs/auth/limits)

Si en otra fase se autoriza vincular una cuenta de facturación, abre **Cloud Billing → Budgets & alerts**, crea un presupuesto, limita su alcance al proyecto de campaña, define el importe mensual y configura umbrales de alerta como 50 %, 90 % y 100 %. Los presupuestos de solo alerta avisan del consumo y el gasto puede continuar después de superar el umbral. [Documentación de presupuestos de Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/budgets)
