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

  async sendLowStockAlertEmail(targetEmail: string, products: StockAlertProductItem[]) {
    if (!products || products.length === 0) return;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://nextz.cl';
    const inventoryUrl = `${frontendUrl}/admin/inventory`;

    const rowsHtml = products
      .map((p) => {
        const priceFormatted =
          p.price !== undefined
            ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(p.price)
            : '-';
        return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a;">${p.code}</td>
          <td style="padding: 10px 8px; font-size: 13px; color: #1e293b;">
            <strong>${p.name}</strong>
            ${p.brandName ? `<br><span style="font-size: 11px; color: #64748b;">Marca: ${p.brandName}</span>` : ''}
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="display: inline-block; padding: 4px 10px; background-color: #fee2e2; color: #dc2626; border-radius: 6px; font-weight: bold; font-size: 13px;">
              ${p.stock} un.
            </span>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 13px; color: #475569;">
            ${p.minStock ?? 5} un.
          </td>
          <td style="padding: 10px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">
            ${priceFormatted}
          </td>
        </tr>
      `;
      })
      .join('');

    const count = products.length;
    const subject = `⚠️ Alerta de Inventario: ${count} producto${count > 1 ? 's en' : ' en'} Stock Mínimo - Nextz`;

    const content = `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
          Alerta de Inventario
        </span>
        <h2 style="color: #0f172a; margin: 12px 0 6px 0; font-size: 20px;">Productos en Límite de Stock Mínimo</h2>
        <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.5;">
          Se ha detectado que los siguientes productos han alcanzado o están por debajo de su umbral de stock mínimo. Se recomienda reponer stock para evitar quiebres de inventario:
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569;">SKU</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569;">Producto</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: center;">Stock Actual</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: center;">Mínimo</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right;">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${inventoryUrl}" class="button" style="background-color: #c8102e; border-radius: 8px; padding: 12px 24px; text-decoration: none;">
          Gestionar Inventario en Admin
        </a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px;">
        Notificación automática generada por Nextz Shop.
      </p>
    `;

    await this.sendMail(targetEmail, subject, this.getBaseTemplate(content));
  }

  async sendPurchaseLimitStockMatchEmail(targetEmail: string, products: StockAlertProductItem[]) {
    if (!products || products.length === 0) return;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://nextz.cl';
    const productsUrl = `${frontendUrl}/admin/products`;

    const rowsHtml = products
      .map((p) => {
        const priceFormatted =
          p.price !== undefined
            ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(p.price)
            : '-';
        return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a;">${p.code}</td>
          <td style="padding: 10px 8px; font-size: 13px; color: #1e293b;">
            <strong>${p.name}</strong>
            ${p.brandName ? `<br><span style="font-size: 11px; color: #64748b;">Marca: ${p.brandName}</span>` : ''}
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="display: inline-block; padding: 4px 10px; background-color: #fef3c7; color: #b45309; border-radius: 6px; font-weight: bold; font-size: 13px;">
              ${p.stock} un.
            </span>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 13px; font-weight: bold; color: #b45309;">
            ${p.purchaseLimit} un./compra
          </td>
          <td style="padding: 10px 8px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">
            ${priceFormatted}
          </td>
        </tr>
      `;
      })
      .join('');

    const count = products.length;
    const subject = `⚡ Alerta: ${count} producto${count > 1 ? 's tienen' : ' tiene'} Límite de Compra Web igual a Stock - Nextz`;

    const content = `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
          Alerta de Venta Web
        </span>
        <h2 style="color: #0f172a; margin: 12px 0 6px 0; font-size: 20px;">Límite de Compra Web igual a Stock Disponible</h2>
        <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.5;">
          El stock disponible de los siguientes productos es exactamente igual a su límite máximo de compra web.
          <strong>Un único comprador podría adquirir la totalidad del inventario restante en una sola transacción:</strong>
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569;">SKU</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569;">Producto</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: center;">Stock Disponible</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: center;">Límite Web</th>
            <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right;">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${productsUrl}" class="button" style="background-color: #f59e0b; border-radius: 8px; padding: 12px 24px; text-decoration: none;">
          Revisar Productos en Admin
        </a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px;">
        Notificación automática generada por Nextz Shop.
      </p>
    `;

    await this.sendMail(targetEmail, subject, this.getBaseTemplate(content));
  }
}

export interface StockAlertProductItem {
  id: number;
  code: string;
  name: string;
  stock: number;
  minStock?: number;
  purchaseLimit?: number | null;
  price?: number;
  brandName?: string;
}
