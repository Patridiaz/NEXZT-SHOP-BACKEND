import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Sobrescribe el método handleRequest. Si el usuario no está autenticado,
  // en lugar de lanzar un error, simplemente devuelve null.
  handleRequest(err, user, info) {
    return user || null;
  }
}