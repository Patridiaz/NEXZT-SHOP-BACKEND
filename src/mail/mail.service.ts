import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });

    // Verificar conexión al iniciar
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`Error de conexión SMTP: ${error.message}`);
        this.logger.debug(`Credenciales usadas - User: ${user}, Pass length: ${pass?.length || 0}`);
      } else {
        this.logger.log('Servidor de correo listo para enviar mensajes');
      }
    });
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: `"Nextz" <${this.configService.get<string>('MAIL_USER')}>`,
        to,
        subject,
        html,
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
            <h1>Nextz</h1>
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

  async sendOrderPaidEmail(userEmail: string, userName: string, orderId: number, total: number) {
    const localeTotal = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(total);
    const content = `
      <h2>¡Pago Confirmado!</h2>
      <p>Hola ${userName}, hemos recibido correctamente el pago de tu orden <span class="highlight">#${orderId}</span>.</p>
      <p>Total pagado: <span class="highlight">${localeTotal}</span></p>
      <p>Estamos preparando tu pedido. Te avisaremos cuando haya novedades en el despacho.</p>
      <a href="https://nextz.cl/orders/${orderId}" class="button">Ver mi pedido</a>
    `;
    await this.sendMail(userEmail, `Pago Recibido - Orden #${orderId}`, this.getBaseTemplate(content));
  }

  async sendOrderStatusUpdateEmail(userEmail: string, userName: string, orderId: number, status: string) {
    const content = `
      <h2>Actualización de tu pedido</h2>
      <p>Hola ${userName}, el estado de tu pedido <span class="highlight">#${orderId}</span> ha cambiado a: <span class="highlight">${status}</span>.</p>
      <p>Puedes seguir el detalle en tiempo real desde tu perfil.</p>
      <a href="https://nextz.cl/orders/${orderId}" class="button">Ver seguimiento</a>
    `;
    await this.sendMail(userEmail, `Actualización de Orden #${orderId}`, this.getBaseTemplate(content));
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
}
