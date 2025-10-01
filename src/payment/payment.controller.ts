import { 
  Controller, 
  Post, 
  Param, 
  Body, 
  Get, 
  Res, 
  Logger, 
  HttpCode, 
  HttpStatus, 
  InternalServerErrorException,
  ParseIntPipe
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import type { Response } from 'express';
import { Public } from 'src/auth/public.decorator';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  // 🚀 Crear pago asociado a una orden
  @Public()
  @Post('create/:orderId')
  // ✅ Usamos HttpCode para que un POST exitoso devuelva 200 en lugar del 201 por defecto
  @HttpCode(HttpStatus.OK) 
  async createPayment(@Param('orderId', ParseIntPipe) orderId: number) { // ✅ Añadimos ParseIntPipe para validar que orderId sea un número
    try {
      // ✅ Simplemente retornamos los datos. NestJS se encarga del resto.
      return await this.paymentService.createPayment(orderId);
    } catch (error) {
      this.logger.error(`Error al crear pago para orden ${orderId}:`, error);
      // ✅ Lanzamos una excepción estándar. NestJS la convertirá en una respuesta HTTP 500.
      throw new InternalServerErrorException(error.message || 'Error al crear el pago');
    }
  }

  // Webhook Flow (confirm)
  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.OK) // ✅ Le decimos a NestJS que siempre responda 200 OK
  async confirmPayment(@Body() body: any) {
    this.logger.log('Webhook de confirmación de Flow recibido:', body);
    const { token } = body;

    if (!token) {
      this.logger.warn('Confirmación de Flow recibida sin token.');
      // ✅ Aunque falte token, respondemos OK para que Flow no siga reintentando.
      return { message: 'OK, no-token' };
    }

    try {
      // ✅ La lógica del servicio se encarga de todo.
      return await this.paymentService.confirmPayment({ token });
    } catch (err: any) {
      this.logger.error('Error al confirmar pago de Flow:', err.message);
      // ✅ Incluso si hay un error, respondemos OK. El error queda en nuestros logs.
      return { message: 'OK, error-interno' };
    }
  }
  
   // ✅ AÑADE O DESCOMENTA ESTE MÉTODO
@Public()
  @Post('return') // Esta ruta coincide con FLOW_RETURN_URL
  async paymentReturn(@Body() body: any, @Res() res: Response) {
    this.logger.log('Usuario regresando desde Flow (paso intermedio):', body);
    
    const flowToken = body.token;
    
    if (!flowToken) {
      // Si no hay token, redirige a una página de error en el frontend
      const frontendErrorUrl = `${process.env.FRONTEND_SUCCESS_URL}/error`; // O una ruta específica
      return res.redirect(frontendErrorUrl);
    }
    
    // Construye la URL de éxito final CON el token como query param
    const frontendSuccessUrl = `${process.env.FRONTEND_SUCCESS_URL}?token=${flowToken}`;
    
    // Redirige el navegador del usuario a la URL final del frontend
    return res.redirect(frontendSuccessUrl);
  }
  
  // 🔍 Consultar estado de un pago
  @Public()
  @Get('status/:token')
  async getPaymentStatus(@Param('token') token: string) {
    try {
      return await this.paymentService.getPaymentDetails(token);
    } catch (err) {
      this.logger.error(`Error al obtener estado del token ${token}:`, err);
      throw new InternalServerErrorException(err.message || 'Error al consultar el pago');
    }
  }

}