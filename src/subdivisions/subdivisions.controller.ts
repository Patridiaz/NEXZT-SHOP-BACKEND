import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SubdivisionsService } from './subdivisions.service';
import { CreateSubdivisionDto, UpdateSubdivisionDto } from './dto/subdivision.dto';
import { Subdivision } from './subdivision.entity';
import { Public } from 'src/auth/public.decorator';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/users/user.entity';

@Controller('subdivisions')
export class SubdivisionsController {
  constructor(private readonly subdivisionsService: SubdivisionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSubdivisionDto): Promise<Subdivision> {
    return this.subdivisionsService.create(dto);
  }

  @Public()
  @Get()
  findAll(): Promise<Subdivision[]> {
    return this.subdivisionsService.findAll();
  }

  @Public()
  @Get('by-game/:gameId')
  findByGame(@Param('gameId', ParseIntPipe) gameId: number): Promise<Subdivision[]> {
    return this.subdivisionsService.findByGameId(gameId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Subdivision> {
    return this.subdivisionsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubdivisionDto): Promise<Subdivision> {
    return this.subdivisionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.subdivisionsService.remove(id);
  }
}
