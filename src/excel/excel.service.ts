import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { Brand } from 'src/brands/brand.entity';
import { Game } from 'src/games/game.entity';
import { Edition } from 'src/editions/edition.entity';
import { ProductRarity } from 'src/products/enums/product-rarity.enum';

@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Edition) private readonly editionRepo: Repository<Edition>,
  ) {}

  // ✅ CORRECCIÓN AQUÍ: Eliminamos ': Promise<Buffer>' de la firma de la función.
  async generateProductTemplate() {
    const workbook = new Workbook();

    // --- Hoja 1: Plantilla de Productos ---
    const templateSheet = workbook.addWorksheet('Plantilla Productos');
    templateSheet.columns = [
      { header: 'code', key: 'code', width: 15 },
      { header: 'name', key: 'name', width: 30 },
      { header: 'description', key: 'description', width: 40 },
      { header: 'price', key: 'price', width: 10 },
      { header: 'stock', key: 'stock', width: 10 },
      { header: 'brandName', key: 'brandName', width: 20 },
      { header: 'gameName', key: 'gameName', width: 20 },
      { header: 'editionName', key: 'editionName', width: 20 },
      { header: 'categoryName', key: 'categoryName', width: 20 },
      { header: 'rarityName', key: 'rarityName', width: 20 },
    ];
    templateSheet.addRow({
      code: 'PKM-001', name: 'Booster Box SV01', description: 'Caja de 36 sobres de la colección Escarlata y Púrpura.',
      price: 120000, stock: 50, brandName: 'Pokemon Company', gameName: 'Pokémon TCG', editionName: 'Scarlet & Violet',
      categoryName: 'carta', rarityName: 'Rare'
    });

    // --- Hojas de Datos de Referencia ---
    const [brands, games, editions] = await Promise.all([
      this.brandRepo.find({ order: { name: 'ASC' } }),
      this.gameRepo.find({ order: { name: 'ASC' } }),
      this.editionRepo.find({ order: { name: 'ASC' } }),
    ]);

    const brandsSheet = workbook.addWorksheet('Marcas Válidas');
    brandsSheet.columns = [{ header: 'Nombre Marca', key: 'name', width: 30 }];
    brands.forEach(b => brandsSheet.addRow({ name: b.name }));

    const gamesSheet = workbook.addWorksheet('Juegos Válidos');
    gamesSheet.columns = [{ header: 'Nombre Juego', key: 'name', width: 30 }];
    games.forEach(g => gamesSheet.addRow({ name: g.name }));

    const editionsSheet = workbook.addWorksheet('Ediciones Válidas');
    editionsSheet.columns = [{ header: 'Nombre Edición', key: 'name', width: 30 }];
    editions.forEach(e => editionsSheet.addRow({ name: e.name }));
    
    // ✅ NUEVA HOJA PARA LAS RAREZAS
    const raritiesSheet = workbook.addWorksheet('Rarezas Válidas');
    raritiesSheet.columns = [{ header: 'Nombre Rareza', key: 'name', width: 30 }];
    Object.values(ProductRarity).forEach(r => raritiesSheet.addRow({ name: r }));

    const categorySheet = workbook.addWorksheet('Categorías Válidas');
    categorySheet.columns = [{ header: 'Nombre Categoría', key: 'name', width: 30 }];
    categorySheet.addRow({ name: 'carta' });
    categorySheet.addRow({ name: 'figura' });
    categorySheet.addRow({ name: 'accesorio' });

    return await workbook.xlsx.writeBuffer();
  }
}