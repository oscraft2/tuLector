import { createSupabaseAdminClient } from "./supabaseAdmin";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface TemplatedEmailOptions {
  to: string | string[];
  templateKey: string;
  locale: string;
  variables: Record<string, string | number>;
}

// Static fallbacks if not found in database email_templates
const STATIC_TEMPLATES: Record<
  string,
  Record<string, { subject: string; html: string; text?: string }>
> = {
  invitation: {
    "es-CL": {
      subject: "Invitación a colaborar en TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">¡Hola!</h2>
          <p>Has sido invitado por <strong>{{invited_by_email}}</strong> a colaborar en el colegio <strong>{{school_name}}</strong> en la plataforma TuLector.</p>
          <p>Tu rol asignado será: <strong>{{role}}</strong>.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{invite_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Aceptar Invitación</a>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="{{invite_link}}" style="color: #2563eb;">{{invite_link}}</a></p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "Has sido invitado a colaborar en {{school_name}} en TuLector. Rol: {{role}}. Acepta la invitación en el siguiente enlace: {{invite_link}}",
    },
    en: {
      subject: "Invitation to collaborate on TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">Hello!</h2>
          <p>You have been invited by <strong>{{invited_by_email}}</strong> to collaborate at <strong>{{school_name}}</strong> on the TuLector platform.</p>
          <p>Your assigned role: <strong>{{role}}</strong>.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{invite_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">If the button doesn't work, copy and paste this link in your browser:<br><a href="{{invite_link}}" style="color: #2563eb;">{{invite_link}}</a></p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform</p>
        </div>
      `,
      text: "You have been invited to collaborate at {{school_name}} on TuLector. Role: {{role}}. Accept the invitation here: {{invite_link}}",
    },
    "pt-BR": {
      subject: "Convite para colaborar no TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">Olá!</h2>
          <p>Você foi convidado por <strong>{{invited_by_email}}</strong> para colaborar na escola <strong>{{school_name}}</strong> na plataforma TuLector.</p>
          <p>Seu papel atribuído: <strong>{{role}}</strong>.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{invite_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Aceitar Convite</a>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">Se o botão não funcionar, copie e cole este link no seu navegador:<br><a href="{{invite_link}}" style="color: #2563eb;">{{invite_link}}</a></p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform</p>
        </div>
      `,
      text: "Você foi convidado para colaborar na escola {{school_name}} no TuLector. Papel: {{role}}. Aceite o convite aqui: {{invite_link}}",
    },
  },
  quota_alert_90: {
    "es-CL": {
      subject: "Alerta de Cuota OMR: 90% consumido - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #d97706; font-size: 20px;">⚠️ Límite de Escaneos Cercano</h2>
          <p>Estimado Administrador,</p>
          <p>El colegio <strong>{{school_name}}</strong> ha consumido el <strong>90%</strong> de su cuota contratada de escaneos OMR.</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">Uso Actual: {{scans_used}} / {{scans_limit}} escaneos.</p>
          </div>
          <p>Para evitar interrupciones en la lectura de hojas de respuestas desde la aplicación móvil, te sugerimos subir al plan anual que corresponda a tu volumen.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{billing_link}}" style="background-color: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver Planes e Ingresos</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "El colegio {{school_name}} ha consumido el 90% de su cuota de escaneos OMR ({{scans_used}}/{{scans_limit}}). Amplía tu plan en: {{billing_link}}",
    },
  },
  quota_alert_100: {
    "es-CL": {
      subject: "Alerta Crítica: Cuota OMR Agotada - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #dc2626; font-size: 20px;">🚨 Límite de Escaneos Bloqueado</h2>
          <p>Estimado Administrador,</p>
          <p>El colegio <strong>{{school_name}}</strong> ha consumido el <strong>100%</strong> de su cuota contratada de escaneos OMR.</p>
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #991b1b;">Uso Actual: {{scans_used}} / {{scans_limit}} escaneos (Agotado).</p>
          </div>
          <p style="font-weight: bold; color: #dc2626;">IMPORTANTE: Los nuevos escaneos intentados por los profesores desde la app móvil serán rechazados con el mensaje "scan quota exceeded" hasta que se amplíe la cuota.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{billing_link}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Cambiar de Plan</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "El colegio {{school_name}} ha agotado su cuota de escaneos OMR ({{scans_used}}/{{scans_limit}}). Nuevos escaneos serán bloqueados. Amplía tu plan de inmediato en: {{billing_link}}",
    },
  },
  payment_success: {
    "es-CL": {
      subject: "Confirmación de Compra - TuLector OMR",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #059669; font-size: 20px;">¡Gracias por tu pago!</h2>
          <p>Hemos registrado correctamente tu pago por la adquisición en TuLector.</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <h3 style="margin-top: 0; font-size: 16px; color: #166534;">Detalle del Pedido</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #4b5563;">Colegio:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{school_name}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Ítem / Plan:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{plan_or_pack}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Monto:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{amount}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Transacción:</td><td style="padding: 6px 0; font-size: 12px; color: #4b5563; text-align: right;">{{transaction_id}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Método de Pago:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; text-transform: uppercase;">{{payment_method}}</td></tr>
            </table>
          </div>
          <p>Los límites de escaneos OMR han sido actualizados automáticamente en la consola del colegio.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{dashboard_link}}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ir al Dashboard</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "Gracias por tu pago para {{school_name}}. Ítem: {{plan_or_pack}}, Monto: {{amount}}, Pasarela: {{payment_method}}. Los límites fueron actualizados. Ve al dashboard en: {{dashboard_link}}",
    },
  },
  account_welcome: {
    "es-CL": {
      subject: "Bienvenido a TuLector - Cuenta creada",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">¡Bienvenido a TuLector!</h2>
          <p>Confirmamos la creación de tu cuenta e institución en la plataforma.</p>
          <div style="background-color: #eef4ff; border: 1px solid #c7dbff; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <h3 style="margin-top: 0; font-size: 16px; color: #07305f;">Resumen de tu cuenta</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #4b5563;">Institución:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{school_name}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Correo de la cuenta:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{user_email}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Plan inicial:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; text-transform: capitalize;">{{plan_name}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Cuota de escaneos:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{scans_limit}} lecturas</td></tr>
            </table>
          </div>
          <p>Puedes contratar o cambiar entre Pro y School desde la sección de facturación.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{dashboard_link}}" style="background-color: #07305f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ir al Dashboard</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "Bienvenido a TuLector. Institucion: {{school_name}}. Cuenta: {{user_email}}. Plan inicial: {{plan_name}} ({{scans_limit}} lecturas). Ingresa al dashboard: {{dashboard_link}}",
    },
  },
  order_receipt: {
    "es-CL": {
      subject: "Comprobante de compra N° {{receipt_number}} - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #07305f; padding-bottom: 14px; margin-bottom: 18px;">
            <div>
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #07305f;">TuLector SpA</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Plataforma de corrección OMR</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">Comprobante N°</p>
              <p style="margin: 2px 0 0; font-size: 16px; font-weight: bold; color: #111827;">{{receipt_number}}</p>
            </div>
          </div>

          <h2 style="color: #059669; font-size: 20px; margin-top: 0;">Compra confirmada</h2>
          <p>Hemos registrado tu pago correctamente. Este comprobante acredita la compra del servicio contratado en TuLector.</p>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #166534;">Detalle de la compra</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #4b5563;">Fecha:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{order_date}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Servicio:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{item_description}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Periodo cubierto:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{billing_period}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Monto total:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{amount}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Medio de pago:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; text-transform: uppercase;">{{payment_method}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">N° de transacción:</td><td style="padding: 6px 0; font-size: 12px; color: #4b5563; text-align: right;">{{transaction_id}}</td></tr>
            </table>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">Datos de facturación</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #4b5563;">Institución:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{school_name}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Razón social:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{legal_name}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">RUT:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{tax_id}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Giro:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{business_activity}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Dirección:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{address_line}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Región / Comuna:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{region_name}} / {{commune}}</td></tr>
            </table>
          </div>

          <p>Los límites de escaneos OMR han sido actualizados automáticamente en la consola del colegio.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{dashboard_link}}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ir al Dashboard</a>
          </div>

          <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">Este comprobante acredita la compra del servicio digital contratado con TuLector SpA y no reemplaza la boleta o factura tributaria electrónica cuando corresponda, la cual se emite de forma independiente según la normativa vigente.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica · soporte@tulector.com</p>
        </div>
      `,
      text: "Comprobante N° {{receipt_number}} - TuLector SpA. Fecha: {{order_date}}. Servicio: {{item_description}}. Periodo: {{billing_period}}. Monto: {{amount}}. Medio de pago: {{payment_method}}. Transaccion: {{transaction_id}}. Facturado a: {{legal_name}} (RUT {{tax_id}}), {{business_activity}}, {{address_line}}, {{region_name}}/{{commune}}. Institucion: {{school_name}}. Este comprobante no reemplaza boleta o factura tributaria. Dashboard: {{dashboard_link}}",
    },
  },
  newsletter_confirm: {
    "es-CL": {
      subject: "Recibimos tu solicitud - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">¡Gracias por tu interés!</h2>
          <p>Recibimos tu solicitud de información sobre TuLector{{name_greeting}}. Nuestro equipo la va a revisar y te vamos a contactar a la brevedad.</p>
          <p>Mientras tanto, puedes conocer más sobre la plataforma:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{info_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver más</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "Recibimos tu solicitud de informacion sobre TuLector{{name_greeting}}. Te contactaremos a la brevedad. Conoce mas en: {{info_link}}",
    },
    en: {
      subject: "We received your request - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">Thanks for your interest!</h2>
          <p>We received your request for information about TuLector{{name_greeting}}. Our team will review it and reach out shortly.</p>
          <p>In the meantime, learn more about the platform:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{info_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Learn more</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform</p>
        </div>
      `,
      text: "We received your request for information about TuLector{{name_greeting}}. We'll reach out shortly. Learn more at: {{info_link}}",
    },
    "pt-BR": {
      subject: "Recebemos sua solicitação - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #07305f; font-size: 20px;">Obrigado pelo seu interesse!</h2>
          <p>Recebemos sua solicitação de informações sobre o TuLector{{name_greeting}}. Nossa equipe vai analisá-la e entrar em contato em breve.</p>
          <p>Enquanto isso, conheça mais sobre a plataforma:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{info_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Saiba mais</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform</p>
        </div>
      `,
      text: "Recebemos sua solicitacao de informacoes sobre o TuLector{{name_greeting}}. Entraremos em contato em breve. Saiba mais em: {{info_link}}",
    },
  },
  payment_failed: {
    "es-CL": {
      subject: "Pago no completado - TuLector",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #dc2626; font-size: 20px;">Tu pago no pudo completarse</h2>
          <p>Intentamos procesar tu compra en TuLector, pero la pasarela de pago no aprobó la transacción.</p>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #4b5563;">Colegio:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{school_name}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Servicio:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{item_description}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Monto:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{{amount}}</td></tr>
              <tr><td style="padding: 6px 0; color: #4b5563;">Estado:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; text-transform: uppercase;">{{status_label}}</td></tr>
            </table>
          </div>
          <p>No se realizó ningún cargo ni cambio de plan. Puedes intentar nuevamente desde el dashboard.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{billing_link}}" style="background-color: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Intentar de nuevo</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">TuLector OMR Engine & Platform · Chile / Latinoamérica</p>
        </div>
      `,
      text: "Tu pago para {{school_name}} no pudo completarse. Servicio: {{item_description}}, Monto: {{amount}}, Estado: {{status_label}}. No se realizo ningun cargo. Intenta nuevamente en: {{billing_link}}",
    },
  },
};

/**
 * Envia un correo utilizando la API REST de Resend.
 * Si no está configurada la API KEY de Resend, cae a loguear por consola en desarrollo.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const toAddresses = Array.isArray(to) ? to : [to];

  if (!apiKey || apiKey === "re_...") {
    console.log("==================================================");
    console.log(`[EMAIL DEV LOG] Para: ${toAddresses.join(", ")}`);
    console.log(`[EMAIL DEV LOG] Asunto: ${subject}`);
    console.log(`[EMAIL DEV LOG] Texto alternativo: ${text || "N/A"}`);
    console.log("--------------------------------------------------");
    console.log(html);
    console.log("==================================================");
    return { success: true, id: `dev_mock_${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toAddresses,
        subject,
        html,
        text,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.warn("[email] error al enviar vía Resend:", json);
      return { success: false, error: json.message || "Error desconocido" };
    }

    return { success: true, id: json.id };
  } catch (error: unknown) {
    console.error("[email] excepcion en llamada Resend:", error);
    const message = error instanceof Error ? error.message : "Excepción de red";
    return { success: false, error: message };
  }
}

/**
 * Compila una plantilla reemplazando marcadores de tipo {{variable_name}}
 */
function compileTemplate(content: string, variables: Record<string, string | number>): string {
  let result = content;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, String(val));
  }
  return result;
}

/**
 * Envía un correo estructurado buscando plantillas dinámicas en Supabase (email_templates)
 * y cayendo a plantillas estáticas locales como respaldo.
 */
export async function sendTemplatedEmail({
  to,
  templateKey,
  locale = "es-CL",
  variables,
}: TemplatedEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  let subject = "";
  let html = "";
  let text = "";

  // 1. Intentar cargar desde la base de datos (con service role admin client)
  try {
    const admin = createSupabaseAdminClient();
    // Probamos primero con el sufijo de idioma, ej: "invitation:es-CL" o "invitation_es-CL"
    const lookupKey = `${templateKey}:${locale}`;
    const { data: dbTemplate, error } = await admin
      .from("email_templates")
      .select("subject, html, text")
      .or(`key.eq.${lookupKey},key.eq.${templateKey}`)
      .order("key", { ascending: false }) // Prioriza la llave compuesta si ambas coinciden
      .limit(1)
      .maybeSingle();

    if (!error && dbTemplate) {
      subject = dbTemplate.subject;
      html = dbTemplate.html;
      text = dbTemplate.text || "";
    }
  } catch (e) {
    // Si falla Supabase (por ejemplo localmente), cae a estáticos silenciosamente
    console.warn("[email] falló lectura de base de datos, usando fallback estático:", e);
  }

  // 2. Si no se cargó de base de datos, usar plantillas estáticas de fallback
  if (!html) {
    const templateGroup = STATIC_TEMPLATES[templateKey];
    if (templateGroup) {
      // Intenta idioma específico, luego cae a es-CL o el primero disponible
      const localized = templateGroup[locale] || templateGroup["es-CL"] || Object.values(templateGroup)[0];
      if (localized) {
        subject = localized.subject;
        html = localized.html;
        text = localized.text || "";
      }
    }
  }

  // 3. Validar que tengamos contenido
  if (!html) {
    return { success: false, error: `Plantilla no encontrada: ${templateKey}` };
  }

  // 4. Compilar marcadores de posición
  const compiledSubject = compileTemplate(subject, variables);
  const compiledHtml = compileTemplate(html, variables);
  const compiledText = compileTemplate(text, variables);

  // 5. Enviar correo real o mock
  return sendEmail({
    to,
    subject: compiledSubject,
    html: compiledHtml,
    text: compiledText,
  });
}
