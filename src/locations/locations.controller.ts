import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Public } from 'src/auth/public.decorator'; // Asegúrate de que sea pública

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Public() // ✅ Importante: Cualquiera (invitado o no) debe poder ver las comunas para comprar
  @Get()
  getAll() {
    return this.locationsService.findAll();
  }
}