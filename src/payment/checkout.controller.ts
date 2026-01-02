// checkout.controller.ts
import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from 'src/auth/public.decorator';
import { PaymentService } from './payment.service';
import { PaymentTransaction } from './PaymentTransaction.entity';

@Controller('checkout')
export class CheckoutController {
    private readonly logger = new Logger(CheckoutController.name);

    constructor(private readonly paymentService: PaymentService) { }

    @Public()
    @Get('success')
    async handleSuccess(@Query('token') token: string, @Res() res: Response) {
        this.logger.log(`✅ PAGO EXITOSO - Generando comprobante para el token: ${token}`);

        let transaction: PaymentTransaction | null = null;
        if (token) {
            try {
                // Aseguramos la confirmación (idempotente)
                await this.paymentService.confirmPayment({ token });
                // Obtenemos todos los datos para el comprobante
                transaction = await this.paymentService.getTransactionByToken(token);
            } catch (error) {
                this.logger.error(`Error al procesar éxito para token ${token}:`, error.message);
            }
        }

        const order = transaction?.order;
        const itemsHtml = order?.items?.map(item => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                <div style="font-weight: 600; color: #1a1a1a;">${item.product.name}</div>
                <div style="font-size: 12px; color: #888;">Precio unitario: $${Number(item.price).toLocaleString('es-CL')}</div>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: center; color: #666;">${item.quantity}</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #1a1a1a;">$${(Number(item.price) * item.quantity).toLocaleString('es-CL')}</td>
        </tr>
        `).join('') || '';

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmación de Compra | Nextz</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
                body { 
                    font-family: 'Plus Jakarta Sans', sans-serif; 
                    background: #f8f9fa; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    min-height: 100vh; 
                    margin: 0; 
                    padding: 20px; 
                }
                .container { 
                    background: white; 
                    border-radius: 32px; 
                    box-shadow: 0 40px 100px rgba(0,0,0,0.08); 
                    width: 100%; 
                    max-width: 550px; 
                    overflow: hidden; 
                    animation: fadeIn 0.8s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                
                .header { 
                    background: #000; 
                    color: white; 
                    padding: 50px 40px; 
                    text-align: center; 
                    position: relative;
                }
                .success-badge {
                    background: #2ecc71;
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 30px;
                    box-shadow: 0 10px 20px rgba(46, 204, 113, 0.3);
                }
                
                .content { padding: 40px; }
                
                h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
                .subtitle { opacity: 0.7; font-size: 15px; margin-top: 10px; font-weight: 300; }
                
                .order-info {
                    display: flex;
                    justify-content: space-between;
                    padding: 20px;
                    background: #fcfcfc;
                    border: 1px solid #f0f0f0;
                    border-radius: 16px;
                    margin-bottom: 30px;
                    font-size: 13px;
                }
                
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .items-table th { 
                    text-align: left; 
                    font-size: 12px; 
                    text-transform: uppercase; 
                    color: #aaa; 
                    padding-bottom: 15px;
                    letter-spacing: 1px;
                }
                
                .total-section {
                    border-top: 2px solid #000;
                    padding-top: 20px;
                    margin-top: 10px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .total-label { font-size: 14px; font-weight: 600; color: #888; }
                .total-amount { font-size: 24px; font-weight: 700; color: #000; }
                
                .footer { text-align: center; margin-top: 40px; }
                .btn { 
                    background: #000; 
                    color: white; 
                    padding: 18px 40px; 
                    text-decoration: none; 
                    border-radius: 100px; 
                    font-weight: 600; 
                    font-size: 15px;
                    display: inline-block; 
                    transition: all 0.3s;
                }
                .btn:hover { background: #333; transform: scale(1.02); }
                
                .transaction-id {
                    margin-top: 30px;
                    font-size: 11px;
                    color: #ccc;
                    text-align: center;
                    font-family: monospace;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="success-badge">✓</div>
                    <h1>¡Pedido Confirmado!</h1>
                    <div class="subtitle">Hemos recibido tu pago correctamente.</div>
                </div>
                
                <div class="content">
                    <div class="order-info">
                        <div>
                            <span style="color: #aaa;">ORDEN</span><br/>
                            <strong style="font-size: 16px;">#${order?.id || '---'}</strong>
                        </div>
                        <div style="text-align: right;">
                            <span style="color: #aaa;">FECHA</span><br/>
                            <strong style="font-size: 16px;">${new Date().toLocaleDateString('es-CL')}</strong>
                        </div>
                    </div>
                    
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th style="text-align: center;">Cant.</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <div class="total-section">
                        <div class="total-row">
                            <div class="total-label">Importe Total Pagado</div>
                            <div class="total-amount">$${Number(order?.total || 0).toLocaleString('es-CL')}</div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <a href="https://nextz.nextz.cl" class="btn">Volver a la tienda</a>
                    </div>
                    
                    <div class="transaction-id">REF: ${token}</div>
                </div>
            </div>
        </body>
        </html>
        `;

        return res.status(200).send(htmlContent);
    }

    @Public()
    @Get('cancel')
    async handleCancel(@Res() res: Response) {
        return res.status(200).send(`
          <div style="text-align:center; padding:50px; font-family:sans-serif;">
              <h1 style="color: #e74c3c;">Pago Cancelado</h1>
              <p>Has cancelado el proceso de pago.</p>
              <a href="https://nextz.nextz.cl">Volver a intentar</a>
          </div>
      `);
    }
}
