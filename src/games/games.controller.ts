import { Controller, Get, Post, Put, Delete, Param, Body, Patch, ParseIntPipe } from '@nestjs/common';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';
import { Game } from './game.entity';
import { GamesService } from './games.service';
import { Public } from 'src/auth/public.decorator';

@Controller('games')
export class GamesController {
  constructor(private readonly gameService: GamesService) {}

  @Post()
  create(@Body() dto: CreateGameDto): Promise<Game> {
    return this.gameService.create(dto);
  }
  
  @Public()
  @Get('all')
  findAllSimple() {
    return this.gameService.findAll();
  }

  @Get()
  findAll(): Promise<Game[]> {
    return this.gameService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number): Promise<Game> {
    return this.gameService.findOne(id);
  }

  @Patch(':id') 
    update(
      @Param('id', ParseIntPipe) id: number, 
      @Body() updateGameDto: UpdateGameDto
    ) {
      return this.gameService.update(id, updateGameDto);
    }

  @Delete(':id')
  remove(@Param('id') id: number): Promise<void> {
    return this.gameService.remove(id);
  }

  @Public()
  @Get('navbar/list')
  getNavbarGames() {
    // Llama a una función en tu servicio
    return this.gameService.findForNavbar(); 
  }




}
