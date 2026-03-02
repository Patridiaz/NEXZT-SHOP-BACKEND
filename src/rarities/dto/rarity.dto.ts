import { IsNotEmpty, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateRarityDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class UpdateRarityDto extends PartialType(CreateRarityDto) { }
