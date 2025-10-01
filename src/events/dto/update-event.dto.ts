import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEventDto extends PartialType(CreateEventDto) {
    @IsOptional()
    @IsBoolean()
    // ✅ LÓGICA DE TRANSFORMACIÓN CORREGIDA Y SIMPLIFICADA
    @Transform(({ value }) => value === 'true')
    isFeatured?: boolean;
}