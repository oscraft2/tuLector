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

/**
 * Envoltorio HTML compartido para correos transaccionales: tratamiento tipo
 * membrete/letterhead -- monocromo (negro/blanco/gris), marca "TL" cuadrada
 * (sin redondear) + wordmark en serif, filetes finos en vez de bloques de
 * color, cuerpo alineado a la izquierda, boton solido sin esquinas
 * redondeadas. Nada de badges tipo pildora, nada centrado, ningun color de
 * acento -- a proposito, para no leerse como plantilla generica.
 */
function emailShell(bodyHtml: string, footerText: string): string {
  return `
    <div style="background-color:#efefec; padding:56px 16px; font-family: Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px; margin:0 auto; background-color:#ffffff; border:1px solid #dcdcd6;">
        <tr>
          <td style="padding:36px 44px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#0a0a0a; color:#ffffff; font-weight:700; font-size:12px; width:26px; height:26px; text-align:center; vertical-align:middle; font-family: Helvetica, Arial, sans-serif; letter-spacing:0.02em;">TL</td>
                <td style="padding-left:11px; color:#0a0a0a; font-size:19px; font-weight:400; font-family: Georgia, 'Times New Roman', serif;">TuLector</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 44px;"><div style="height:1px; background-color:#dcdcd6; line-height:1px; font-size:1px;">&nbsp;</div></td>
        </tr>
        <tr>
          <td style="padding:40px 44px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 44px;"><div style="height:1px; background-color:#dcdcd6; line-height:1px; font-size:1px;">&nbsp;</div></td>
        </tr>
        <tr>
          <td style="padding:22px 44px 32px;">
            <p style="margin:0; font-size:11px; color:#8a8a83; letter-spacing:0.05em; text-transform:uppercase;">${footerText}</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// Static fallbacks if not found in database email_templates
const STATIC_TEMPLATES: Record<
  string,
  Record<string, { subject: string; html: string; text?: string }>
> = {
  invitation: {
    "es-CL": {
      subject: "Invitación a colaborar en TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Invitación de equipo</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{invited_by_email}}</strong> te invitó a colaborar en <strong>{{school_name}}</strong> dentro de TuLector.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Rol asignado — <strong>{{role}}</strong></p>
          <a href="{{invite_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Aceptar invitación</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">¿El botón no funciona? Copia este enlace:<br><a href="{{invite_link}}" style="color:#0a0a0a; word-break:break-all;">{{invite_link}}</a></p>
        `,
        "TuLector — Corrección de pruebas y ensayos"
      ),
      text: "Has sido invitado a colaborar en {{school_name}} en TuLector. Rol: {{role}}. Acepta la invitación en el siguiente enlace: {{invite_link}}",
    },
    en: {
      subject: "Invitation to collaborate on TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Team invitation</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{invited_by_email}}</strong> invited you to collaborate at <strong>{{school_name}}</strong> on TuLector.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Assigned role — <strong>{{role}}</strong></p>
          <a href="{{invite_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Accept invitation</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">If the button doesn't work, copy this link:<br><a href="{{invite_link}}" style="color:#0a0a0a; word-break:break-all;">{{invite_link}}</a></p>
        `,
        "TuLector — Exam and answer-sheet grading"
      ),
      text: "You have been invited to collaborate at {{school_name}} on TuLector. Role: {{role}}. Accept the invitation here: {{invite_link}}",
    },
    "pt-BR": {
      subject: "Convite para colaborar no TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Convite de equipe</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{invited_by_email}}</strong> te convidou para colaborar na escola <strong>{{school_name}}</strong> no TuLector.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Papel atribuído — <strong>{{role}}</strong></p>
          <a href="{{invite_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Aceitar convite</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">Se o botão não funcionar, copie este link:<br><a href="{{invite_link}}" style="color:#0a0a0a; word-break:break-all;">{{invite_link}}</a></p>
        `,
        "TuLector — Correção de provas e simulados"
      ),
      text: "Você foi convidado para colaborar na escola {{school_name}} no TuLector. Papel: {{role}}. Aceite o convite aqui: {{invite_link}}",
    },
  },
  // Un docente comparte un ensayo con otro del mismo colegio (quiz_shares).
  // Mismo formato que `invitation` a proposito: es la misma familia de correos
  // ("alguien del equipo te esta dando acceso a algo") y el destinatario ya
  // reconoce esa pieza.
  quiz_shared: {
    "es-CL": {
      subject: "Te compartieron un ensayo en TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Ensayo compartido</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{shared_by_email}}</strong> te compartió el ensayo <strong>{{quiz_title}}</strong> en <strong>{{school_name}}</strong>.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Al aceptar podrás ver el ensayo, imprimir su hoja y escanear: las hojas que leas quedan en el <strong>mismo ensayo</strong>, junto a las de tus colegas.</p>
          <a href="{{accept_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Ver y aceptar</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">¿El botón no funciona? Copia este enlace:<br><a href="{{accept_link}}" style="color:#0a0a0a; word-break:break-all;">{{accept_link}}</a></p>
        `,
        "TuLector — Corrección de pruebas y ensayos"
      ),
      text: "{{shared_by_email}} te compartió el ensayo {{quiz_title}} en {{school_name}}. Acepta para verlo y escanear sus hojas: {{accept_link}}",
    },
    en: {
      subject: "A quiz was shared with you on TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Shared quiz</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{shared_by_email}}</strong> shared the quiz <strong>{{quiz_title}}</strong> with you at <strong>{{school_name}}</strong>.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Once you accept, you can view it, print its answer sheet and scan: the sheets you read land in the <strong>same quiz</strong>, next to your colleagues'.</p>
          <a href="{{accept_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">View and accept</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">If the button doesn't work, copy this link:<br><a href="{{accept_link}}" style="color:#0a0a0a; word-break:break-all;">{{accept_link}}</a></p>
        `,
        "TuLector — Exam and answer-sheet grading"
      ),
      text: "{{shared_by_email}} shared the quiz {{quiz_title}} with you at {{school_name}}. Accept to view it and scan its sheets: {{accept_link}}",
    },
    "pt-BR": {
      subject: "Compartilharam um simulado com você no TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Simulado compartilhado</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{shared_by_email}}</strong> compartilhou o simulado <strong>{{quiz_title}}</strong> com você na escola <strong>{{school_name}}</strong>.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Ao aceitar, você poderá vê-lo, imprimir sua folha e escanear: as folhas que você ler ficam no <strong>mesmo simulado</strong>, junto com as dos colegas.</p>
          <a href="{{accept_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Ver e aceitar</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">Se o botão não funcionar, copie este link:<br><a href="{{accept_link}}" style="color:#0a0a0a; word-break:break-all;">{{accept_link}}</a></p>
        `,
        "TuLector — Correção de provas e simulados"
      ),
      text: "{{shared_by_email}} compartilhou o simulado {{quiz_title}} com você na escola {{school_name}}. Aceite para vê-lo e escanear suas folhas: {{accept_link}}",
    },
  },
  // Aviso de vuelta al dueño: sin esto, quien comparte no se entera de que ya
  // puede contar con ese colega para escanear.
  quiz_share_accepted: {
    "es-CL": {
      subject: "Aceptaron tu ensayo compartido en TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Ensayo compartido</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{accepted_by_email}}</strong> aceptó el ensayo <strong>{{quiz_title}}</strong>. Ya puede escanear hojas y sus resultados aparecerán junto a los tuyos.</p>
          <a href="{{quiz_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Ver el ensayo</a>
        `,
        "TuLector — Corrección de pruebas y ensayos"
      ),
      text: "{{accepted_by_email}} aceptó el ensayo {{quiz_title}}. Ya puede escanear sus hojas: {{quiz_link}}",
    },
    en: {
      subject: "Your shared quiz was accepted on TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Shared quiz</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{accepted_by_email}}</strong> accepted the quiz <strong>{{quiz_title}}</strong>. They can now scan sheets and their results will show up next to yours.</p>
          <a href="{{quiz_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Open the quiz</a>
        `,
        "TuLector — Exam and answer-sheet grading"
      ),
      text: "{{accepted_by_email}} accepted the quiz {{quiz_title}}. They can now scan its sheets: {{quiz_link}}",
    },
    "pt-BR": {
      subject: "Aceitaram seu simulado compartilhado no TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Simulado compartilhado</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;"><strong>{{accepted_by_email}}</strong> aceitou o simulado <strong>{{quiz_title}}</strong>. Já pode escanear folhas e os resultados aparecerão junto aos seus.</p>
          <a href="{{quiz_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Abrir o simulado</a>
        `,
        "TuLector — Correção de provas e simulados"
      ),
      text: "{{accepted_by_email}} aceitou o simulado {{quiz_title}}. Já pode escanear suas folhas: {{quiz_link}}",
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
  ticket_created: {
    "es-CL": {
      subject: "Hemos recibido tu solicitud - TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Ticket Creado</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;">Hola,</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;">Hemos recibido tu consulta: <strong>"{{ticket_subject}}"</strong>. Nuestro equipo la revisará y te contactará a la brevedad.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Puedes revisar el estado de tu solicitud o agregar más información desde el siguiente enlace seguro:</p>
          <a href="{{ticket_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Ver mi ticket</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">¿El botón no funciona? Copia este enlace:<br><a href="{{ticket_link}}" style="color:#0a0a0a; word-break:break-all;">{{ticket_link}}</a></p>
        `,
        "Soporte TuLector"
      ),
      text: "Hemos recibido tu solicitud. Nuestro equipo la revisará. Puedes ver tu ticket aquí: {{ticket_link}}",
    },
    "pt-BR": {
      subject: "Recebemos sua solicitação - TuLector",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Ticket Criado</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;">Olá,</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;">Recebemos sua consulta: <strong>"{{ticket_subject}}"</strong>. Nossa equipe vai analisá-la e entrar em contato em breve.</p>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Você pode verificar o status da sua solicitação no link seguro abaixo:</p>
          <a href="{{ticket_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Ver meu ticket</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">Se o botão não funcionar, copie este link:<br><a href="{{ticket_link}}" style="color:#0a0a0a; word-break:break-all;">{{ticket_link}}</a></p>
        `,
        "Suporte TuLector"
      ),
      text: "Recebemos sua solicitação. Você pode verificar seu ticket aqui: {{ticket_link}}",
    },
  },
  ticket_reply: {
    "es-CL": {
      subject: "Respuesta a tu ticket: {{ticket_subject}}",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Nueva Respuesta</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;">El equipo de TuLector ha respondido a tu consulta:</p>
          <div style="background-color:#f8fafc; padding:16px; border-left:4px solid #0a0a0a; margin-bottom:24px;">
            <p style="margin:0; font-style:italic; color:#4b5563;">"{{reply_preview}}"</p>
          </div>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Puedes ver el mensaje completo y responder desde el portal seguro:</p>
          <a href="{{ticket_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Responder ticket</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">¿El botón no funciona? Copia este enlace:<br><a href="{{ticket_link}}" style="color:#0a0a0a; word-break:break-all;">{{ticket_link}}</a></p>
        `,
        "Soporte TuLector"
      ),
      text: "El equipo de TuLector ha respondido a tu ticket. Puedes ver la respuesta completa aquí: {{ticket_link}}",
    },
    "pt-BR": {
      subject: "Resposta ao seu ticket: {{ticket_subject}}",
      html: emailShell(
        `
          <p style="margin:0 0 26px; font-size:11px; font-weight:700; color:#8a8a83; text-transform:uppercase; letter-spacing:0.08em;">Nova Resposta</p>
          <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#0a0a0a;">A equipe do TuLector respondeu à sua consulta:</p>
          <div style="background-color:#f8fafc; padding:16px; border-left:4px solid #0a0a0a; margin-bottom:24px;">
            <p style="margin:0; font-style:italic; color:#4b5563;">"{{reply_preview}}"</p>
          </div>
          <p style="margin:0 0 32px; font-size:16px; line-height:1.7; color:#0a0a0a;">Você pode ver a mensagem completa e responder pelo portal seguro:</p>
          <a href="{{ticket_link}}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:600; font-size:14px;">Responder ticket</a>
          <p style="margin:36px 0 0; font-size:12px; line-height:1.6; color:#8a8a83;">Se o botão não funcionar, copie este link:<br><a href="{{ticket_link}}" style="color:#0a0a0a; word-break:break-all;">{{ticket_link}}</a></p>
        `,
        "Suporte TuLector"
      ),
      text: "A equipe do TuLector respondeu ao seu ticket. Você pode ver a resposta aqui: {{ticket_link}}",
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Compila una plantilla reemplazando marcadores de tipo {{variable_name}}
 */
function compileTemplate(content: string, variables: Record<string, string | number>): string {
  let result = content;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, escapeHtml(String(val)));
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
