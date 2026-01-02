import { NestFactory, Reflector } from '@nestjs/core'; // 👈 1. Importar Reflector
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard'; // 👈 2. Importar tu guardia
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configuración de CORS, archivos estáticos, etc.
  app.enableCors({
    origin: '*', // Permite cualquier origen (para desarrollo)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    // ... tus otras opciones
  }));

  app.use(cookieParser());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();