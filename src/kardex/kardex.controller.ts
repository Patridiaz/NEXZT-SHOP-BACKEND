import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { KardexService } from './kardex.service';
import { CreateKardexMovementDto } from './dto/create-kardex-movement.dto';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user.entity';
import { KardexMovementType } from './enums/kardex-movement-type.enum';

@Controller('kardex')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Post('movement')
  async registerMovement(@Body() dto: CreateKardexMovementDto, @Req() req: any) {
    if (!dto.userId && req.user?.id) {
      dto.userId = req.user.id;
    }
    return this.kardexService.registerMovement(dto);
  }

  @Get()
  async findAll(
    @Query('productId') productId?: string,
    @Query('movementType') movementType?: KardexMovementType,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kardexService.findAll({
      productId: productId ? +productId : undefined,
      movementType,
      search,
      page: page ? +page : 1,
      limit: limit ? +limit : 15,
    });
  }

  @Get('summary')
  async getSummary() {
    return this.kardexService.getInventorySummary();
  }
}
