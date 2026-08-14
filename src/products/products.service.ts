import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindManyOptions, In, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Brand } from 'src/brands/brand.entity';
import { Product } from './product.entity';
import { Edition } from 'src/editions/edition.entity';
import { Game } from 'src/games/game.entity';
import { ProductCategory } from './enums/product-category.enum';
import { OrderItem } from 'src/orders/order-item.entity';
import { Workbook } from 'exceljs';
import { Rarity } from 'src/rarities/rarity.entity';

@Injectable()
export class ProductService {

  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Edition) private readonly editionRepo: Repository<Edition>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Rarity) private readonly rarityRepo: Repository<Rarity>,
    private entityManager: EntityManager,
  ) { }

  async create(dto: CreateProductDto, file: Express.Multer.File): Promise<Product> {
    const codeExists = await this.productRepo.findOneBy({ code: dto.code });
    if (codeExists) {
      throw new BadRequestException(`El código de producto ${dto.code} ya existe.`);
    }

    // 1. Crea la instancia del producto con los datos básicos
    const product = this.productRepo.create(dto);

    // 2. Asigna la URL de la imagen
    if (file) {
      product.imageUrl = `/uploads/${file.filename}`;
    }

    // ✅ 3. Busca y asigna TODAS las relaciones
    const brand = await this.brandRepo.findOneBy({ id: dto.brandId });
    if (!brand) throw new NotFoundException(`Marca con ID ${dto.brandId} no encontrada`);
    product.brand = brand;

    if (dto.gameId) {
      const game = await this.gameRepo.findOneBy({ id: dto.gameId });
      if (!game) throw new NotFoundException(`Juego con ID ${dto.gameId} no encontrado`);
      product.game = game;
    }

    if (dto.editionId) {
      const edition = await this.editionRepo.findOneBy({ id: dto.editionId });
      if (!edition) throw new NotFoundException(`Edición con ID ${dto.editionId} no encontrada`);
      product.edition = edition;
    }

    if (dto.rarityId) {
      const rarity = await this.rarityRepo.findOneBy({ id: dto.rarityId });
      if (!rarity) throw new NotFoundException(`Rareza con ID ${dto.rarityId} no encontrada`);
      product.rarity = rarity;
    }

    // 4. Guarda el nuevo producto
    return this.productRepo.save(product);
  }
  // ✅ MÉTODO findAll OPTIMIZADO
  async findAll(filters: {
    brandId?: number;
    category?: string;
    game?: string;
    gameId?: number;
    editionId?: number;
    rarityId?: number;
    code?: string;
    name?: string;
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'ASC' | 'DESC';
    showHidden?: boolean; // Solo admin: si es true, muestra todos los productos
  }) {
    const {
      page = 1,
      limit = 10,
      search,
      game,
      brandId,
      gameId,
      editionId,
      category,
      rarityId,
      code,
      name,
      sort = 'name',
      order = 'ASC',
      showHidden = false,
    } = filters;

    // LOG PARA DEBUG EN LA TERMINAL (Ayuda al usuario a ver qué llega del frontend)
    console.log('[DEBUG] Products Search Params:', {
      search, category, game, gameId, brandId, editionId, rarityId
    });

    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.game', 'game')
      .leftJoinAndSelect('product.edition', 'edition')
      .leftJoinAndSelect('product.rarity', 'rarity');

    // Solo mostrar productos visibles en la tienda pública
    if (!showHidden) {
      query.andWhere('product.isVisible = true');
    }

    // La búsqueda por texto general
    if (search && search.trim() !== '') {
      const searchTerm = `%${search}%`;
      query.andWhere(
        '(product.name ILIKE :search OR ' +
        'product.code ILIKE :search OR ' +
        'brand.name ILIKE :search OR ' +
        'game.name ILIKE :search OR ' +
        'edition.name ILIKE :search)',
        { search: searchTerm }
      );
    }

    // Filtros explícitos
    if (code) {
      query.andWhere('product.code ILIKE :code', { code: `%${code}%` });
    }
    if (name) {
      query.andWhere('product.name ILIKE :name', { name: `%${name}%` });
    }

    // Si llega gameName, filtramos por nombre. 
    // Si llega gameId, filtramos por ID.
    if (game && game !== 'undefined' && game !== 'null') {
      // Si el frontend envía el ID en el parámetro 'game', lo manejamos
      if (!isNaN(Number(game))) {
        query.andWhere('game.id = :gameIdFromGame', { gameIdFromGame: Number(game) });
      } else {
        query.andWhere('game.name = :gameName', { gameName: game });
      }
    }

    if (brandId) query.andWhere('brand.id = :brandId', { brandId });
    if (gameId) query.andWhere('game.id = :gameId', { gameId });
    if (editionId) query.andWhere('edition.id = :editionId', { editionId });
    if (rarityId) query.andWhere('rarity.id = :rarityId', { rarityId });
    if (category && category !== 'undefined' && category !== 'null' && category !== 'all') {
      query.andWhere('product.category = :category', { category });
    }

    const sortMap = {
      'code': 'product.code',
      'name': 'product.name',
      'rarity': 'rarity.name',
      'edition': 'edition.name',
      'stock': 'product.stock',
      'price': 'product.price',
      'createdAt': 'product.createdAt',
      'updatedAt': 'product.updatedAt',
    };

    const sortKey = sortMap[sort] || 'product.name';
    query.orderBy(sortKey, order);

    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async findByFilter(filters: { game?: string; category?: string }): Promise<Product[]> {
    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.game', 'game')
      .leftJoinAndSelect('product.edition', 'edition')
      .leftJoinAndSelect('product.rarity', 'rarity');

    if (filters.game) {
      query.andWhere('game.name = :gameName', { gameName: filters.game });
    }

    if (filters.category) {
      query.andWhere('product.category = :category', { category: filters.category });
    }

    // Ordenamos para una vista consistente, por ejemplo, por nombre.
    query.orderBy('product.name', 'ASC');

    return query.getMany();
  }


  async findOne(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['brand', 'edition', 'game', 'rarity'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: number, dto: UpdateProductDto, file?: Express.Multer.File): Promise<Product> {
    // 1. Usamos 'preload' para cargar el producto y fusionar los datos simples del DTO
    const product = await this.productRepo.preload({
      id,
      ...dto,
    });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // 2. Si se subió un nuevo archivo, actualizamos la URL de la imagen
    if (file) {
      product.imageUrl = `/uploads/${file.filename}`;
    }

    // ✅ 3. Manejamos las relaciones si vienen en el DTO
    if (dto.brandId) {
      const brand = await this.brandRepo.findOneBy({ id: dto.brandId });
      if (!brand) throw new NotFoundException(`Marca con ID ${dto.brandId} no encontrada`);
      product.brand = brand;
    }

    if (dto.gameId) {
      const game = await this.gameRepo.findOneBy({ id: dto.gameId });
      if (!game) throw new NotFoundException(`Juego con ID ${dto.gameId} no encontrado`);
      product.game = game;
    } else if (dto.gameId === null) { // Permite desasociar un juego
      product.game = null;
    }

    if (dto.editionId) {
      const edition = await this.editionRepo.findOneBy({ id: dto.editionId });
      if (!edition) throw new NotFoundException(`Edición con ID ${dto.editionId} no encontrada`);
      product.edition = edition;
    } else if (dto.editionId === null) { // Permite desasociar una edición
      product.edition = null;
    }

    if (dto.rarityId !== undefined) {
      if (dto.rarityId === null) {
        product.rarity = null;
      } else {
        const rarity = await this.rarityRepo.findOneBy({ id: dto.rarityId });
        if (!rarity) throw new NotFoundException(`Rareza con ID ${dto.rarityId} no encontrada`);
        product.rarity = rarity;
      }
    }

    // 4. Guardamos el producto con todas sus relaciones actualizadas
    return this.productRepo.save(product);
  }



  async replenishStock(items: OrderItem[]): Promise<void> {
    await this.entityManager.transaction(async transactionalEntityManager => {
      for (const item of items) {
        await transactionalEntityManager.increment(
          Product,
          { id: item.product.id },
          'stock',
          item.quantity
        );
      }
    });
  }

  async findRandom(limit: number): Promise<Product[]> {
    // Solo productos visibles en el carrusel/random
    const randomIdsResult = await this.productRepo.createQueryBuilder('product')
      .select('product.id', 'id')
      .where('product.isVisible = true')
      .orderBy('RANDOM()')
      .take(limit)
      .getRawMany();

    if (randomIdsResult.length === 0) {
      return []; // Si no hay productos, devuelve un array vacío
    }

    // Extraemos los IDs del resultado
    const randomIds = randomIdsResult.map(r => r.id);

    // 2. Ahora buscamos los productos completos por esos IDs, con sus relaciones
    return this.productRepo.find({
      where: {
        id: In(randomIds), // Usa el operador "In" para buscar por una lista de IDs
      },
      relations: ['brand', 'edition', 'game', 'rarity'], // Carga las relaciones que necesites
    });
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepo.remove(product);
  }

  /**
 * ✅ 3. NUEVO MÉTODO para descontar el stock
 * Utiliza una transacción para asegurar la consistencia de los datos.
 */
  async deductStock(items: OrderItem[]): Promise<void> {
    await this.entityManager.transaction(async transactionalEntityManager => {
      for (const item of items) {
        const product = await transactionalEntityManager.findOne(Product, {
          where: { id: item.product.id },
          lock: { mode: 'pessimistic_write' }, // Bloquea la fila para evitar concurrencia
        });

        if (!product) {
          throw new NotFoundException(`Producto con ID ${item.product.id} no encontrado.`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(`Stock insuficiente para el producto: ${product.name}`);
        }

        product.stock -= item.quantity;
        await transactionalEntityManager.save(product);
      }
    });
  }


  async bulkCreate(fileBuffer) {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.getWorksheet('Plantilla Productos');

    if (!worksheet) {
      throw new BadRequestException('El archivo Excel no contiene la hoja requerida "Plantilla Productos".');
    }

    const errors: { row: number; message: string }[] = [];
    const productsToUpsert: any[] = [];
    const rowsData: any[] = [];

    // Leemos todas las filas ignorando la fila 1 de encabezados
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1 || !row.values || row.values.length === 0) return;
      rowsData.push({ rowNumber, values: row.values as any });
    });

    const brandNames = new Set(rowsData.map(r => r.values[6]?.toString().trim()).filter(Boolean));
    const gameNames = new Set(rowsData.map(r => r.values[7]?.toString().trim()).filter(Boolean));
    const editionNames = new Set(rowsData.map(r => r.values[8]?.toString().trim()).filter(Boolean));
    const rarityNames = new Set(rowsData.map(r => r.values[10]?.toString().trim()).filter(Boolean));
    const codesInExcel = new Set(rowsData.map(r => r.values[1]?.toString().trim()).filter(Boolean));

    const [brands, games, editions, rarities, existingProducts] = await Promise.all([
      this.brandRepo.findBy({ name: In([...brandNames]) }),
      this.gameRepo.findBy({ name: In([...gameNames]) }),
      this.editionRepo.findBy({ name: In([...editionNames]) }),
      this.rarityRepo.findBy({ name: In([...rarityNames]) }),
      this.productRepo.findBy({ code: In([...codesInExcel]) }),
    ]);

    // Maps case-insensitive para búsquedas sin fallos de mayúsculas/minúsculas
    const brandMap = new Map(brands.map(b => [b.name.trim().toLowerCase(), b]));
    const gameMap = new Map(games.map(g => [g.name.trim().toLowerCase(), g]));
    const editionMap = new Map(editions.map(e => [e.name.trim().toLowerCase(), e]));
    const rarityMap = new Map(rarities.map(r => [r.name.trim().toLowerCase(), r]));
    const existingProductsMap = new Map(existingProducts.map(p => [p.code, p]));

    for (const { rowNumber, values } of rowsData) {
      const rawIsVisible = values[13];
      let isVisibleStr = '';
      if (rawIsVisible !== undefined && rawIsVisible !== null) {
        if (typeof rawIsVisible === 'object' && rawIsVisible.result !== undefined) {
          isVisibleStr = rawIsVisible.result.toString().trim().toUpperCase();
        } else {
          isVisibleStr = rawIsVisible.toString().trim().toUpperCase();
        }
      }

      const rowData = {
        code: values[1]?.toString().trim(),
        name: values[2]?.toString().trim(),
        description: values[3]?.toString().trim(),
        price: parseFloat(values[4]),
        stock: parseInt(values[5], 10),
        brandName: values[6]?.toString().trim(),
        gameName: values[7]?.toString().trim(),
        editionName: values[8]?.toString().trim(),
        categoryName: values[9]?.toString().trim() as ProductCategory | undefined,
        rarityName: values[10]?.toString().trim(),
        offerPrice: values[11] ? parseFloat(values[11]) : undefined,
        purchaseLimit: values[12] ? parseInt(values[12], 10) : undefined,
        isVisibleStr,
        imageUrl: values[14]?.toString().trim(),
      };

      // --- Validar Fila ---
      if (!rowData.code || !rowData.name || isNaN(rowData.price) || isNaN(rowData.stock) || !rowData.brandName) {
        errors.push({ row: rowNumber, message: 'Las columnas code, name, price, stock y brandName son obligatorias.' });
        continue;
      }

      const brand = brandMap.get(rowData.brandName.toLowerCase());
      if (!brand) {
        errors.push({ row: rowNumber, message: `La marca '${rowData.brandName}' no fue encontrada en el sistema.` });
        continue;
      }

      let game: Game | null = null;
      if (rowData.gameName) {
        game = gameMap.get(rowData.gameName.toLowerCase()) || null;
        if (!game) {
          errors.push({ row: rowNumber, message: `El juego '${rowData.gameName}' no fue encontrado en el sistema.` });
          continue;
        }
      }

      let edition: Edition | null = null;
      if (rowData.editionName) {
        edition = editionMap.get(rowData.editionName.toLowerCase()) || null;
        if (!edition) {
          errors.push({ row: rowNumber, message: `La edición '${rowData.editionName}' no fue encontrada en el sistema.` });
          continue;
        }
      }

      let rarity: Rarity | null = null;
      if (rowData.rarityName) {
        rarity = rarityMap.get(rowData.rarityName.toLowerCase()) || null;
        if (!rarity) {
          errors.push({ row: rowNumber, message: `La rareza '${rowData.rarityName}' no fue encontrada en el sistema.` });
          continue;
        }
      }

      if (rowData.categoryName && !Object.values(ProductCategory).includes(rowData.categoryName.toLowerCase() as any)) {
        errors.push({ row: rowNumber, message: `Categoría inválida: '${rowData.categoryName}'.` });
        continue;
      }

      const existingProduct = existingProductsMap.get(rowData.code);

      // Procesar visibilidad (SI, YES, 1, TRUE, VISIBLE -> true; NO, N, FALSE, 0, OCULTO, BORRADOR -> false)
      let isVisible = true;
      if (rowData.isVisibleStr !== '') {
        if (['NO', 'N', 'FALSE', '0', 'NO VISIBLE', 'DESACTIVADO', 'OCULTO', 'BORRADOR'].includes(rowData.isVisibleStr)) {
          isVisible = false;
        } else if (['SI', 'S', 'YES', 'Y', 'TRUE', '1', 'VISIBLE', 'ACTIVADO', 'PUBLICADO'].includes(rowData.isVisibleStr)) {
          isVisible = true;
        } else if (existingProduct) {
          isVisible = existingProduct.isVisible;
        }
      } else if (existingProduct) {
        isVisible = existingProduct.isVisible;
      }

      const productData = {
        ...(existingProduct || {}),
        code: rowData.code,
        name: rowData.name,
        description: rowData.description !== undefined && rowData.description !== '' ? rowData.description : (existingProduct?.description),
        price: rowData.price,
        stock: rowData.stock,
        brand,
        game,
        edition,
        category: (rowData.categoryName?.toLowerCase() as ProductCategory) || (existingProduct?.category || ProductCategory.CARTA),
        rarity,
        offerPrice: (rowData.offerPrice !== undefined && !isNaN(rowData.offerPrice)) ? rowData.offerPrice : (existingProduct?.offerPrice),
        purchaseLimit: (rowData.purchaseLimit !== undefined && !isNaN(rowData.purchaseLimit)) ? rowData.purchaseLimit : (existingProduct?.purchaseLimit),
        isVisible,
        imageUrl: rowData.imageUrl || (existingProduct?.imageUrl),
      };

      productsToUpsert.push(productData);
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Se encontraron errores en el archivo Excel.', errors });
    }

    // --- Guardar en una transacción ---
    try {
      await this.entityManager.transaction(async transactionalEntityManager => {
        await transactionalEntityManager.save(Product, productsToUpsert);
      });
      return { message: `Carga exitosa: ${productsToUpsert.length} productos procesados (creados o actualizados).` };
    } catch (error) {
      throw new BadRequestException(`Ocurrió un error al procesar el archivo: ${error.message}`);
    }
  }

  async findByIds(ids: number[]): Promise<Product[]> {
    if (!ids || ids.length === 0) {
      return []; // Devuelve un arreglo vacío si no se proporcionan IDs
    }
    return this.productRepo.find({
      where: {
        id: In(ids),
      },
    });
  }
}
