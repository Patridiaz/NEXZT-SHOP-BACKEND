import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateCarouselDto {
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    link?: string;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    order?: number;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    isActive?: boolean;
}
