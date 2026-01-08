import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CreateCarouselDto } from './dto/create-carousel.dto';
import { UpdateCarouselDto } from './dto/update-carousel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { Public } from '../auth/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from '../products/multer.config';

@Controller('carousel')
export class CarouselController {
    constructor(private readonly carouselService: CarouselService) { }

    @Public()
    @Get()
    findActive() {
        return this.carouselService.findActive();
    }

    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    findAll() {
        return this.carouselService.findAll();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.carouselService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file', multerOptions))
    create(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: CreateCarouselDto
    ) {
        return this.carouselService.create(dto, file);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file', multerOptions))
    update(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UpdateCarouselDto
    ) {
        return this.carouselService.update(id, dto, file);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.carouselService.remove(id);
    }
}
