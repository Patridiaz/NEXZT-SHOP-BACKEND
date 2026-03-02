import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CreateRarityDto, UpdateRarityDto } from './dto/rarity.dto';
import { Rarity } from './rarity.entity';
import { RaritiesService } from './rarities.service';
import { Public } from 'src/auth/public.decorator';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/users/user.entity';

@Controller('rarities')
export class RaritiesController {
    constructor(private readonly raritiesService: RaritiesService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    create(@Body() dto: CreateRarityDto): Promise<Rarity> {
        return this.raritiesService.create(dto);
    }

    @Public()
    @Get('all')
    findAllSimple() {
        return this.raritiesService.findAll();
    }

    @Public()
    @Get()
    findAll(): Promise<Rarity[]> {
        return this.raritiesService.findAll();
    }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number): Promise<Rarity> {
        return this.raritiesService.findOne(id);
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRarityDto): Promise<Rarity> {
        return this.raritiesService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.raritiesService.remove(id);
    }
}
