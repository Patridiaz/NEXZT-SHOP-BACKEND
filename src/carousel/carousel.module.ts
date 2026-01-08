import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarouselItem } from './carousel-item.entity';
import { CarouselService } from './carousel.service';
import { CarouselController } from './carousel.controller';

@Module({
    imports: [TypeOrmModule.forFeature([CarouselItem])],
    controllers: [CarouselController],
    providers: [CarouselService],
    exports: [CarouselService],
})
export class CarouselModule { }
