import { IsArray, IsNumber } from 'class-validator';

export class GetProductsByIdsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  ids: number[];
}