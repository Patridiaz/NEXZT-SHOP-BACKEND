import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = parseInt(this.configService.get<string>('MAIL_PORT') || '465', 10);
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    this.transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465, // true para 465 (SSL), false para 587 (TLS/STARTTLS)
      auth: {
        user: user,
        pass: pass,
      },
      tls: {
        rejectUnauthorized: false, // Necesario en algunos hostings con cert. autofirmado
      },
    });

    // Verificar conexión al iniciar
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(`Error de conexión SMTP: ${error.message}`);
      } else {
        this.logger.log(`Servidor de correo listo → ${host}:${port} (${user})`);
      }
    });
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      const logoPath = path.join(process.cwd(), 'uploads', 'logo Next Z.png');
      const attachments: any[] = [];

      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo' // Referenciado en el HTML como <img src="cid:logo">
        });
      }

      await this.transporter.sendMail({
        from: `"Nextz" <${this.configService.get<string>('MAIL_USER')}>`,
        to,
        subject,
        html,
        attachments
      });
      this.logger.log(`Email enviado a ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Error enviando email a ${to}`, error.stack);
    }
  }

  private getBaseTemplate(content: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #ffffff; color: #000000; }
          .container { width: 100%; max-width: 600px; margin: 0 auto; border: 1px solid #eeeeee; }
          .header { background-color: #c8102e; padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
          .content { padding: 40px; line-height: 1.6; }
          .footer { background-color: #f39c12; padding: 20px; text-align: center; font-size: 12px; color: #ffffff; }
          .button { display: inline-block; padding: 12px 24px; background-color: #c8102e; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
          .highlight { color: #c8102e; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="cid:logo" alt="Nextz Logo" style="height: 50px;">
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nextz. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendWelcomeEmail(userEmail: string, userName: string) {
    const content = `
      <h2>¡Bienvenido a Nextz, ${userName}!</h2>
      <p>Estamos muy felices de tenerte con nosotros. Tu cuenta ha sido creada exitosamente.</p>
      <p>Ya puedes empezar a explorar nuestra tienda y encontrar los mejores productos.</p>
      <a href="https://nextz.cl" class="button">Ir a la tienda</a>
    `;
    await this.sendMail(userEmail, '¡Bienvenido a Nextz!', this.getBaseTemplate(content));
  }

  async sendOrderPaidEmail(userEmail: string, userName: string, orderCode: string, total: number) {
    const localeTotal = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(total);
    const content = `
      <h2>¡Pago Confirmado!</h2>
      <p>Hola ${userName}, hemos recibido correctamente el pago de tu orden <span class="highlight">#${orderCode}</span>.</p>
      <p>Total pagado: <span class="highlight">${localeTotal}</span></p>
      <p>Estamos preparando tu pedido. Te avisaremos cuando haya novedades en el despacho.</p>
      <a href="https://nextz.cl/orders/${orderCode}" class="button">Ver mi pedido</a>
    `;
    await this.sendMail(userEmail, `Pago Recibido - Orden #${orderCode}`, this.getBaseTemplate(content));
  }

  async sendOrderStatusUpdateEmail(userEmail: string, userName: string, orderCode: string, status: string) {
    const content = `
      <h2>Actualización de tu pedido</h2>
      <p>Hola ${userName}, el estado de tu pedido <span class="highlight">#${orderCode}</span> ha cambiado a: <span class="highlight">${status}</span>.</p>
      <p>Puedes seguir el detalle en tiempo real desde tu perfil.</p>
      <a href="https://nextz.cl/orders/${orderCode}" class="button">Ver seguimiento</a>
    `;
    await this.sendMail(userEmail, `Actualización de Orden #${orderCode}`, this.getBaseTemplate(content));
  }

  async sendResetPasswordEmail(userEmail: string, userName: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://nextz.cl';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const content = `
      <h2>Recuperación de Contraseña</h2>
      <p>Hola ${userName}, has solicitado restablecer tu contraseña en Nextz.</p>
      <p>Haz clic en el siguiente botón para continuar con el proceso. Este enlace expirará en 1 hora.</p>
      <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
      <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
    `;
    await this.sendMail(userEmail, 'Recuperación de Contraseña - Nextz', this.getBaseTemplate(content));
  }

  async sendOrderCancelledEmail(
    userEmail: string,
    userName: string,
    orderCode: string,
    amount: number,
    reason: string,
  ) {
    const localeAmount = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const content = `
      <h2>Pedido Cancelado</h2>
      <p>Hola ${userName}, te informamos que tu pedido <span class="highlight">#${orderCode}</span> ha sido cancelado por el administrador.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">N° Pedido:</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">#${orderCode}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">Monto:</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${localeAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">Motivo:</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${reason}</td>
        </tr>
      </table>
      <p>Nextz se pondrá en contacto contigo vía telefónica o al correo electrónico ingresado al momento de tu compra para coordinar la devolución de tu dinero.</p>
      <p>Si tienes alguna consulta, no dudes en contactarnos.</p>
    `;
    await this.sendMail(userEmail, `Pedido #${orderCode} Cancelado - Nextz`, this.getBaseTemplate(content));
  }
}
