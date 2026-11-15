# Pagos y admin: cambios y despliegue

## Estado

Rama codex/billing-admin-reliability. Los cambios no ejecutan cargos ni devoluciones y no migran producción automáticamente.

- Flow firma los parámetros con la concatenación canónica de su API, sin "=" ni "&".
- apply_paid_order valida monto, moneda, pasarela y referencia, y confirma orden/cuota/suscripción en una transacción. Los reintentos no reinician consumo.
- El webhook no reserva eventos pendientes o fallidos. Los eventos guardados por el código anterior no bloquean los nuevos reintentos.
- La compra es anual y manual. No se almacena una tarjeta ni se habilitan cargos recurrentes.
- La renovación del mismo plan conserva lecturas disponibles y extiende la fecha pagada un año calendario. El cambio a School empieza de inmediato. Una bajada de School a Pro se gestiona con soporte al finalizar el período.
- Los planes sin suscripción activa, coincidente y vigente tienen derechos de starter. El contador no se reinicia al vencer. El trigger de nuevas lecturas aplica el mismo límite.
- Un cambio manual de plan conserva el consumo, actualiza la suscripción y se audita. Guardar el mismo plan vigente no renueva ni recarga.
- dLocal tiene su propio estado de configuración y un formulario sin dirección/comuna chilenas. Habilitar credenciales no sustituye homologar cada país/método con dLocal.
- Los comprobantes se envían vía Resend y pueden reenviarse. En producción, la falta de Resend es un error de envío, nunca un envío simulado.
- Los webhooks pueden repetir el intento de comprobante aun si la orden ya estaba pagada. Resend recibe una clave de idempotencia por orden/destinatario. Un reenvío explícito usa una nueva clave.
- El admin muestra totales agregados en PostgreSQL, filtros/paginación y presencia real de credenciales, sin presentar esa presencia como un chequeo de conectividad.

## Devoluciones

La devolución del dinero se realiza en Flow/dLocal. El admin permite **registrar la devolución completa ya realizada**, con referencia de la pasarela, motivo y confirmación. Esta acción no mueve dinero.

El registro y el ajuste de acceso ocurren atómicamente y quedan auditados. No se cancela ni se reduce la cuota de un plan más nuevo por devolver una compra histórica. Esos casos quedan señalados para conciliar el acceso manualmente; no hay un historial por lectura que permita atribuir el consumo a cada compra. Las órdenes creadas antes de esta actualización no tienen snapshot de derechos: se registran con advertencia y requieren reconciliar el acceso manualmente desde la ficha del colegio. No se ofrecen devoluciones parciales en esta pantalla.

## Antes de desplegar

Aplicar primero supabase/migrations/20261114000000_billing_integrity.sql con el mecanismo habitual de Supabase. La migración agrega columnas e índices y funciones service-role; no elimina órdenes o suscripciones.

Revisar estas consultas en producción, sin copiar datos personales a logs:

~~~sql
-- Cada colegio debe tener una sola fila de suscripción.
SELECT school_id, count(*) FROM subscriptions GROUP BY school_id HAVING count(*) > 1;
-- No compartir la misma transacción entre órdenes.
SELECT gateway, gateway_payment_id, count(*) FROM orders
WHERE gateway_payment_id IS NOT NULL GROUP BY gateway, gateway_payment_id HAVING count(*) > 1;
-- Revisar fechas/planes heredados ANTES de activar la validación de vigencia.
SELECT s.id, s.plan, sub.status, sub.plan AS subscription_plan, sub.current_period_end
FROM schools s LEFT JOIN subscriptions sub ON sub.school_id = s.id
WHERE s.plan IN ('pro','school')
  AND (sub.id IS NULL OR sub.status <> 'active' OR sub.plan <> s.plan
    OR sub.current_period_end IS NULL OR sub.current_period_end <= now());
-- Candidatos a revisar por un fallo entre pago y activación con el código antiguo.
SELECT o.id, o.school_id, o.paid_at FROM orders o
LEFT JOIN subscriptions sub ON sub.school_id = o.school_id
WHERE o.status = 'paid' AND o.type = 'plan'
  AND (sub.id IS NULL OR sub.status <> 'active');
~~~

Si aparecen duplicados, detener el despliegue y conciliarlos contra la pasarela. Los índices únicos fallan explícitamente; no hay borrado automático. Revisar también órdenes pendientes antiguas que sí estén pagadas en la pasarela; pueden reprocesarse mediante su notificación verificada.

Los pagos históricos ya marcados paid no se reaplican automáticamente: podría duplicar cuota o reiniciar consumo. La reparación de derechos históricos debe basarse en evidencia de la pasarela.

Variables necesarias: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL (https://tulector.app), FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_SANDBOX=false. Para dLocal: DLOCAL_X_LOGIN, DLOCAL_X_TRANS_KEY, DLOCAL_SECRET_KEY, DLOCAL_SANDBOX=false. Para correo: RESEND_API_KEY y RESEND_FROM_EMAIL con dominio verificado.

Tras migrar, publicar el código y comprobar con las cuentas/entornos de prueba de las pasarelas: Pro y School, pago pendiente/aprobado/rechazado, callback repetido, comprobante y renovación. No probar simulaciones contra una base de producción; los mocks están restringidos a desarrollo y al colegio autenticado.

## Validación automática

El workflow Billing integrity ejecuta la suite unitaria, TypeScript de src y la migración en PostgreSQL 16 aislado. Las pruebas SQL comprueban rollback ante fallos, reintentos, concurrencia, renovación, caducidad, acceso pausado, devoluciones y permisos de RPC. No usa secretos de producción.

## Reversión

Revertir el código conserva los datos de órdenes. Las columnas agregadas pueden permanecer. No revertir la base borrando historial ni permitir que la versión anterior reactive una orden devuelta. Si se vuelve al webhook anterior, volverían sus problemas de firma/reintentos; es preferible deshabilitar temporalmente el checkout y mantener la confirmación corregida.
