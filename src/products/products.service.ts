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
import { ProductRarity } from './enums/product-rarity.enum';
import { Workbook } from 'exceljs';

@Injectable()
export class ProductService {

  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Edition) private readonly editionRepo: Repository<Edition>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
     private entityManager: EntityManager,
  ) {}

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

  // 4. Guarda el nuevo producto
  return this.productRepo.save(product);
}
 // ✅ MÉTODO findAll OPTIMIZADO
 async findAll(filters: { brandId?: number; category?: string; game?: string; gameId?: number; page?: number; limit?: number; search?: string; rarity?: ProductRarity }) {
    const { page = 1, limit = 10, search, game,brandId, gameId, category, rarity } = filters;

    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.game', 'game')
      .leftJoinAndSelect('product.edition', 'edition');

    // La búsqueda por texto ahora incluye el código del producto
    if (search) {
      query.andWhere(
        '(product.name LIKE :search OR product.code LIKE :search OR brand.name LIKE :search)',
        { search: `%${search}%` }
      );
    }
    
    // ✅ Nuevos filtros
    // ✅ Añade la lógica para filtrar por el nombre del juego
    if (game) query.andWhere('game.name = :gameName', { gameName: game });
    if (brandId) query.andWhere('product.brandId = :brandId', { brandId });
    if (gameId) query.andWhere('product.gameId = :gameId', { gameId });
    if (rarity) query.andWhere('product.rarity = :rarity', { rarity });
    if (category) query.andWhere('product.category = :category', { category });

    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async findByFilter(filters: { game?: string; category?: string }): Promise<Product[]> {
  const query = this.productRepo.createQueryBuilder('product')
    .leftJoinAndSelect('product.brand', 'brand')
    .leftJoinAndSelect('product.game', 'game')
    .leftJoinAndSelect('product.edition', 'edition');

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
      relations: ['brand', 'edition', 'game'],
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
    // Usamos QueryBuilder para poder usar la función RANDOM() de la base de datos
    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand') // Incluye las relaciones que necesites
      .orderBy('RAND()') // Para PostgreSQL / SQLite
      // .orderBy('RAND()') // Descomenta esta línea y comenta la anterior si usas MySQL
      .take(limit); // Limita el número de resultados

    return query.getMany();
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
    const productsToCreate: Partial<Product>[] = [];
    const rowsData: any[] = [];

    // Primero, leemos todas las filas para poder hacer consultas optimizadas
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1 || row.values.length === 0) return; // Ignora header y filas vacías
      rowsData.push({ rowNumber, values: row.values });
    });

    // ✅ 1. Optimización: Cargar solo las entidades necesarias que se mencionan en el archivo
    const brandNames = new Set(rowsData.map(r => r.values[6]?.toString().trim()).filter(Boolean));
    const gameNames = new Set(rowsData.map(r => r.values[7]?.toString().trim()).filter(Boolean));
    const editionNames = new Set(rowsData.map(r => r.values[8]?.toString().trim()).filter(Boolean));

    const [brands, games, editions, existingProducts] = await Promise.all([
      this.brandRepo.findBy({ name: In([...brandNames]) }),
      this.gameRepo.findBy({ name: In([...gameNames]) }),
      this.editionRepo.findBy({ name: In([...editionNames]) }),
      this.productRepo.find({ select: ['code'] }),
    ]);

    const brandMap = new Map(brands.map(b => [b.name, b]));
    const gameMap = new Map(games.map(g => [g.name, g]));
    const editionMap = new Map(editions.map(e => [e.name, e]));
    const existingCodes = new Set(existingProducts.map(p => p.code));

    // Ahora procesamos los datos con las entidades ya cargadas
    for (const { rowNumber, values } of rowsData) {
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
        rarityName: values[10]?.toString().trim() as ProductRarity | undefined,
      };

      // --- Validar Fila ---
      if (!rowData.code || !rowData.name || isNaN(rowData.price) || isNaN(rowData.stock) || !rowData.brandName) {
        errors.push({ row: rowNumber, message: 'Las columnas code, name, price, stock y brandName son obligatorias.' });
        continue;
      }
      if (existingCodes.has(rowData.code)) {
        errors.push({ row: rowNumber, message: `El código de producto '${rowData.code}' ya existe.` });
        continue;
      }
      const brand = brandMap.get(rowData.brandName);
      if (!brand) {
        errors.push({ row: rowNumber, message: `La marca '${rowData.brandName}' no fue encontrada.` });
        continue;
      }
      
      let game: Game | undefined;
      if (rowData.gameName) {
        game = gameMap.get(rowData.gameName);
        if (!game) {
          errors.push({ row: rowNumber, message: `El juego '${rowData.gameName}' no fue encontrado.` });
          continue;
        }
      }

      let edition: Edition | undefined;
      if (rowData.editionName) {
        edition = editionMap.get(rowData.editionName);
        if (!edition) {
          errors.push({ row: rowNumber, message: `La edición '${rowData.editionName}' no fue encontrada.` });
          continue;
        }
      }
      if (rowData.categoryName && !Object.values(ProductCategory).includes(rowData.categoryName)) {
        errors.push({ row: rowNumber, message: `Categoría inválida: '${rowData.categoryName}'.` });
        continue;
      }
      let rarity: ProductRarity | undefined;
      if (rowData.rarityName) {
        // ✅ Comprueba si el texto del Excel es uno de los valores válidos del Enum
        if (Object.values(ProductRarity).includes(rowData.rarityName)) {
          rarity = rowData.rarityName; // Si es válido, lo asignamos
        } else {
          // Si no es válido, lanzamos un error detallado
          errors.push({ row: rowNumber, message: `Rareza inválida: '${rowData.rarityName}'. Los valores válidos son: ${Object.values(ProductRarity).join(', ')}.` });
          continue;
        }
      }

      // ✅ 3. Claridad: Mapeo explícito de propiedades
      productsToCreate.push({
        code: rowData.code,
        name: rowData.name,
        description: rowData.description,
        price: rowData.price,
        stock: rowData.stock,
        brand,
        game,
        edition,
        category: rowData.categoryName,
        rarity,
      });
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Se encontraron errores en el archivo Excel.', errors });
    }
    
    // --- Guardar en una transacción ---
    try {
      await this.entityManager.transaction(async transactionalEntityManager => {
        await transactionalEntityManager.save(Product, productsToCreate);
      });
      return { message: `Se han creado ${productsToCreate.length} productos con éxito.` };
    } catch (error) {
      throw new BadRequestException(`Ocurrió un error al guardar los productos: ${error.message}`);
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
