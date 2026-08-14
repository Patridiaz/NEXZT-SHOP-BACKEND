import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { Brand } from 'src/brands/brand.entity';
import { Game } from 'src/games/game.entity';
import { Edition } from 'src/editions/edition.entity';
import { Rarity } from 'src/rarities/rarity.entity';

@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Edition) private readonly editionRepo: Repository<Edition>,
    private readonly entityManager: EntityManager,
  ) { }

  async generateProductTemplate() {
    const workbook = new Workbook();

    // --- Hoja 0: Instrucciones ---
    const helpSheet = workbook.addWorksheet('Instrucciones');
    helpSheet.columns = [{ header: 'Instrucción', key: 'text', width: 90 }];
    helpSheet.addRow({ text: 'GUÍA DE CARGA MASIVA DE PRODUCTOS - NEXT Z SHOP' });
    helpSheet.addRow({ text: '--------------------------------------------------' });
    helpSheet.addRow({ text: '1. Los productos se procesan únicamente desde la hoja "Plantilla Productos".' });
    helpSheet.addRow({ text: '2. CAMPOS OBLIGATORIOS: code, name, price, stock y brandName.' });
    helpSheet.addRow({ text: '3. LÓGICA DE ACTUALIZACIÓN (UPSERT):' });
    helpSheet.addRow({ text: '   - Si el "code" ya existe en el sistema, el producto se ACTUALIZARÁ con los nuevos datos.' });
    helpSheet.addRow({ text: '   - Si el "code" NO existe, se CREARÁ un nuevo producto.' });
    helpSheet.addRow({ text: '4. VISIBILIDAD (isVisible):' });
    helpSheet.addRow({ text: '   - Escribe "SI" para que el producto sea visible en el catálogo de la tienda.' });
    helpSheet.addRow({ text: '   - Escribe "NO" para guardarlo como borrador/oculto (no visible para clientes).' });
    helpSheet.addRow({ text: '   - Si se deja en blanco, los productos nuevos serán visibles ("SI") y los existentes mantendrán su estado.' });
    helpSheet.addRow({ text: '5. RELACIONES: La Marca, Juego, Edición y Rareza deben existir previamente en el sistema.' });
    helpSheet.addRow({ text: '   - Consulta las pestañas correspondientes para ver los nombres válidos.' });
    helpSheet.addRow({ text: '6. FORMATOS:' });
    helpSheet.addRow({ text: '   - price / offerPrice: Solo números enteros o decimales, sin signos de peso ni puntos separadores de miles.' });
    helpSheet.addRow({ text: '   - imageUrl: URL completa o ruta de la imagen principal del producto.' });
    helpSheet.addRow({ text: '' });
    helpSheet.addRow({ text: 'Por favor, no modifiques los nombres de las columnas ni de las hojas del archivo.' });

    // --- Hoja 1: Plantilla de Productos ---
    const templateSheet = workbook.addWorksheet('Plantilla Productos');
    templateSheet.columns = [
      { header: 'code', key: 'code', width: 15 },
      { header: 'name', key: 'name', width: 32 },
      { header: 'description', key: 'description', width: 40 },
      { header: 'price', key: 'price', width: 12 },
      { header: 'stock', key: 'stock', width: 10 },
      { header: 'brandName', key: 'brandName', width: 22 },
      { header: 'gameName', key: 'gameName', width: 22 },
      { header: 'editionName', key: 'editionName', width: 22 },
      { header: 'categoryName', key: 'categoryName', width: 18 },
      { header: 'rarityName', key: 'rarityName', width: 18 },
      { header: 'offerPrice', key: 'offerPrice', width: 15 },
      { header: 'purchaseLimit', key: 'purchaseLimit', width: 15 },
      { header: 'isVisible', key: 'isVisible', width: 15 },
      { header: 'imageUrl', key: 'imageUrl', width: 35 },
    ];

    // Ejemplo 1: Producto visible
    templateSheet.addRow({
      code: 'PKM-001', name: 'Booster Box Scarlet & Violet', description: 'Caja sellada de 36 sobres de expansión.',
      price: 120000, stock: 50, brandName: 'Pokemon Company', gameName: 'Pokémon TCG',
      editionName: 'Scarlet & Violet', categoryName: 'carta', rarityName: 'Rare',
      offerPrice: 110000, purchaseLimit: 2, isVisible: 'SI', imageUrl: 'https://...'
    });

    // Ejemplo 2: Producto oculto (isVisible = NO)
    templateSheet.addRow({
      code: 'PKM-002', name: 'Charizard ex Secret Rare', description: 'Carta de colección en impecable estado.',
      price: 85000, stock: 3, brandName: 'Pokemon Company', gameName: 'Pokémon TCG',
      editionName: 'Scarlet & Violet', categoryName: 'carta', rarityName: 'Ultra Rare',
      offerPrice: null, purchaseLimit: 1, isVisible: 'NO', imageUrl: 'https://...'
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

    const raritiesSheet = workbook.addWorksheet('Rarezas Válidas');
    raritiesSheet.columns = [{ header: 'Nombre Rareza', key: 'name', width: 30 }];
    const rarities = await this.entityManager.getRepository(Rarity).find({ order: { name: 'ASC' } });
    rarities.forEach(r => raritiesSheet.addRow({ name: r.name }));

    const categorySheet = workbook.addWorksheet('Categorías Válidas');
    categorySheet.columns = [{ header: 'Nombre Categoría', key: 'name', width: 30 }];
    categorySheet.addRow({ name: 'carta' });
    categorySheet.addRow({ name: 'figura' });
    categorySheet.addRow({ name: 'accesorio' });

    return await workbook.xlsx.writeBuffer();
  }
}