import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaritiesController } from './rarities.controller';
import { RaritiesService } from './rarities.service';
import { Rarity } from './rarity.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Rarity])],
    controllers: [RaritiesController],
    providers: [RaritiesService],
    exports: [RaritiesService, TypeOrmModule],
})
export class RaritiesModule { }
