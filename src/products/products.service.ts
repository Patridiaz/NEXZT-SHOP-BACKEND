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
import { Subdivision } from 'src/subdivisions/subdivision.entity';

import { KardexService } from 'src/kardex/kardex.service';
import { KardexMovementType } from 'src/kardex/enums/kardex-movement-type.enum';
import { StockAlertsService } from './stock-alerts.service';

@Injectable()
export class ProductService {

  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Edition) private readonly editionRepo: Repository<Edition>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Rarity) private readonly rarityRepo: Repository<Rarity>,
    @InjectRepository(Subdivision) private readonly subdivisionRepo: Repository<Subdivision>,
    private readonly kardexService: KardexService,
    private readonly stockAlertsService: StockAlertsService,
    private entityManager: EntityManager,
  ) { }

  private generateBarcode(): string {
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000); // 8 dígitos aleatorios
    return `NXZ-${randomSuffix}`;
  }

  async create(dto: CreateProductDto, file: Express.Multer.File): Promise<Product> {
    const codeExists = await this.productRepo.findOneBy({ code: dto.code });
    if (codeExists) {
      throw new BadRequestException(`El código de producto ${dto.code} ya existe.`);
    }

    if (dto.barcode) {
      const barcodeExists = await this.productRepo.findOneBy({ barcode: dto.barcode });
      if (barcodeExists) {
        throw new BadRequestException(`El código de barras ${dto.barcode} ya está asignado a otro producto.`);
      }
    }

    const initialStock = dto.stock !== undefined ? dto.stock : 0;

    // 1. Crea la instancia del producto con stock inicial 0 (el movimiento de Kardex establecerá el stock real)
    const product = this.productRepo.create({
      ...dto,
      stock: 0,
      barcode: dto.barcode || this.generateBarcode(),
      costPrice: dto.costPrice !== undefined ? dto.costPrice : 0,
      minStock: dto.minStock !== undefined ? dto.minStock : 5,
      maxStock: dto.maxStock !== undefined ? dto.maxStock : 100,
    });

    // 2. Asigna la URL de la imagen
    if (file) {
      product.imageUrl = `/uploads/${file.filename}`;
    } else if (!product.imageUrl) {
      product.imageUrl = '/uploads/defecto-img.png';
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

    if (dto.subdivisionId) {
      const subdivision = await this.subdivisionRepo.findOneBy({ id: dto.subdivisionId });
      if (!subdivision) throw new NotFoundException(`Subdivisión con ID ${dto.subdivisionId} no encontrada`);
      product.subdivision = subdivision;
    }

    // 4. Guarda el nuevo producto con stock 0
    const savedProduct = await this.productRepo.save(product);

    // 5. Registrar el stock inicial en el Kardex si es > 0 (kardexService sumará initialStock al 0 previo)
    if (initialStock > 0) {
      await this.kardexService.registerMovement({
        productId: savedProduct.id,
        movementType: KardexMovementType.ENTRADA_COMPRA,
        quantity: initialStock,
        unitCost: savedProduct.costPrice,
        reference: 'Stock Inicial',
        notes: 'Creación inicial del producto',
      });
    }

    return (await this.productRepo.findOne({
      where: { id: savedProduct.id },
      relations: ['brand', 'edition', 'game', 'rarity', 'subdivision'],
    }))!;
  }
  // ✅ MÉTODO findAll OPTIMIZADO
  async findAll(filters: {
    brandId?: number;
    category?: string;
    game?: string;
    gameId?: number;
    editionId?: number;
    rarityId?: number;
    subdivisionId?: number;
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
      subdivisionId,
      code,
      name,
      sort = 'name',
      order = 'ASC',
      showHidden = false,
    } = filters;

    // LOG PARA DEBUG EN LA TERMINAL (Ayuda al usuario a ver qué llega del frontend)
    console.log('[DEBUG] Products Search Params:', {
      search, category, game, gameId, brandId, editionId, rarityId, subdivisionId
    });

    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.game', 'game')
      .leftJoinAndSelect('product.edition', 'edition')
      .leftJoinAndSelect('product.rarity', 'rarity')
      .leftJoinAndSelect('product.subdivision', 'subdivision');

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
        'product.barcode ILIKE :search OR ' +
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
    if (subdivisionId) query.andWhere('subdivision.id = :subdivisionId', { subdivisionId });
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
      relations: ['brand', 'edition', 'game', 'rarity', 'subdivision'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByBarcode(barcode: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: [{ barcode }, { code: barcode }],
      relations: ['brand', 'edition', 'game', 'rarity', 'subdivision'],
    });
    if (!product) throw new NotFoundException(`Producto con código ${barcode} no fue encontrado`);
    return product;
  }

  async update(id: number, dto: UpdateProductDto, file?: Express.Multer.File): Promise<Product> {
    const existingProduct = await this.productRepo.findOne({ where: { id } });
    if (!existingProduct) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    const previousStock = existingProduct.stock;
    const targetStock = dto.stock;

    // 1. Usamos 'preload' para cargar el producto manteniendo el stock previo intacto antes del Kardex
    const product = await this.productRepo.preload({
      id,
      ...dto,
      stock: previousStock,
      barcode: dto.barcode || existingProduct.barcode || this.generateBarcode(),
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
    } else if (dto.gameId === null) {
      product.game = null;
    }

    if (dto.editionId) {
      const edition = await this.editionRepo.findOneBy({ id: dto.editionId });
      if (!edition) throw new NotFoundException(`Edición con ID ${dto.editionId} no encontrada`);
      product.edition = edition;
    } else if (dto.editionId === null) {
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

    if (dto.subdivisionId !== undefined) {
      if (dto.subdivisionId === null) {
        product.subdivision = null;
      } else {
        const subdivision = await this.subdivisionRepo.findOneBy({ id: dto.subdivisionId });
        if (!subdivision) throw new NotFoundException(`Subdivisión con ID ${dto.subdivisionId} no encontrada`);
        product.subdivision = subdivision;
      }
    }

    // 4. Guardamos el producto con el stock previo (sin alterar aún)
    const savedProduct = await this.productRepo.save(product);

    // 5. Auditar cambio manual de stock en Kardex si hubo diferencia
    if (targetStock !== undefined && targetStock !== previousStock) {
      const diff = targetStock - previousStock;
      const movementType = diff > 0 ? KardexMovementType.AJUSTE_POSITIVO : KardexMovementType.AJUSTE_NEGATIVO;
      await this.kardexService.registerMovement({
        productId: savedProduct.id,
        movementType,
        quantity: Math.abs(diff),
        unitCost: savedProduct.costPrice,
        reference: 'Ajuste Manual Ficha Producto',
        notes: `Modificación manual de stock de ${previousStock} a ${targetStock}`,
      });
    }

    // Evaluar alertas de stock si cambiaron stock, minStock o purchaseLimit
    if (
      (targetStock !== undefined && targetStock !== previousStock) ||
      dto.minStock !== undefined ||
      dto.purchaseLimit !== undefined
    ) {
      this.stockAlertsService.checkAndAlert([savedProduct.id]).catch((err) => {
        console.error('Error al evaluar alertas de stock post-actualización:', err);
      });
    }

    return (await this.productRepo.findOne({
      where: { id: savedProduct.id },
      relations: ['brand', 'edition', 'game', 'rarity', 'subdivision'],
    }))!;
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
    const affectedProductIds: number[] = [];
    for (const item of items) {
      if (item.product) {
        affectedProductIds.push(item.product.id);
        await this.kardexService.registerMovement({
          productId: item.product.id,
          movementType: KardexMovementType.SALIDA_VENTA,
          quantity: item.quantity,
          reference: 'Venta Tienda Online',
          notes: `Descuento automático por compra de ${item.quantity} un.`,
        });
      }
    }

    if (affectedProductIds.length > 0) {
      // Verificar y enviar alertas de stock mínimo y límite de compra web si corresponde
      this.stockAlertsService.checkAndAlert(affectedProductIds).catch((err) => {
        console.error('Error evaluando alertas de stock post-venta online:', err);
      });
    }
  }

  async checkStockAlerts(productIds?: number[]) {
    return this.stockAlertsService.checkAndAlert(productIds);
  }


  async bulkPreview(fileBuffer: any) {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer);

    let worksheet = workbook.getWorksheet('Plantilla Productos');
    if (!worksheet) {
      worksheet = workbook.worksheets.find(ws => ws.name.trim().toLowerCase() === 'plantilla productos')
        || workbook.worksheets.find(ws => ws.name.trim().toLowerCase() !== 'instrucciones')
        || workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas de datos válidas.');
    }

    const errors: { row: number; message: string }[] = [];
    const rowsData: any[] = [];

    const getCellValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        if (val.result !== undefined && val.result !== null) return val.result.toString().trim();
        if (val.text !== undefined && val.text !== null) return val.text.toString().trim();
        if (Array.isArray(val.richText)) return val.richText.map((r: any) => r.text || '').join('').trim();
      }
      return val.toString().trim();
    };

    // Mapeo dinámico de encabezados
    const headerMap = new Map<string, number>();
    const headerRow = worksheet.getRow(1);
    if (headerRow && headerRow.values) {
      const hValues = headerRow.values as any[];
      hValues.forEach((val, idx) => {
        if (val) {
          const str = getCellValue(val).toLowerCase().replace(/[^a-z0-9]/g, '');
          headerMap.set(str, idx);
        }
      });
    }

    const getCol = (values: any[], aliases: string[], fallbackIdx: number): string => {
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        const idx = headerMap.get(cleanAlias);
        if (idx !== undefined && values[idx] !== undefined) {
          return getCellValue(values[idx]);
        }
      }
      return values[fallbackIdx] !== undefined ? getCellValue(values[fallbackIdx]) : '';
    };

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1 || !row.values || row.values.length === 0) return;
      rowsData.push({ rowNumber, values: row.values as any });
    });

    if (rowsData.length === 0) {
      throw new BadRequestException('El archivo Excel no contiene filas de datos para procesar.');
    }

    const brandNames = new Set(rowsData.map(r => getCol(r.values, ['brandname', 'brand', 'marca'], 8)).filter(Boolean));
    const gameNames = new Set(rowsData.map(r => getCol(r.values, ['gamename', 'game', 'juego'], 9)).filter(Boolean));
    const editionNames = new Set(rowsData.map(r => getCol(r.values, ['editionname', 'edition', 'edicion'], 10)).filter(Boolean));
    const rarityNames = new Set(rowsData.map(r => getCol(r.values, ['rarityname', 'rarity', 'rareza'], 12)).filter(Boolean));
    const codesInExcel = new Set(rowsData.map(r => getCol(r.values, ['code', 'codigo'], 1)).filter(Boolean));
    const barcodesInExcel = new Set(rowsData.map(r => getCol(r.values, ['barcode', 'codigobarras'], 2)).filter(Boolean));

    const hasSubdivisionHeader = ['subdivisionname', 'subdivision', 'subdivisiones'].some(a => headerMap.has(a));
    const hasCategoryHeader = ['categoryname', 'category', 'categoria'].some(a => headerMap.has(a));

    const subdivisionNames = new Set(rowsData.map(r => {
      if (hasSubdivisionHeader) {
        return getCol(r.values, ['subdivisionname', 'subdivision', 'subdivisiones'], 11);
      } else if (!hasCategoryHeader) {
        return getCellValue(r.values[11]);
      }
      return '';
    }).filter(Boolean));

    const [brands, games, editions, rarities, subdivisions, existingProductsByCode, existingProductsByBarcode] = await Promise.all([
      brandNames.size > 0 ? this.brandRepo.findBy({ name: In([...brandNames]) }) : Promise.resolve([]),
      gameNames.size > 0 ? this.gameRepo.find({ where: { name: In([...gameNames]) }, relations: ['subdivisions'] }) : Promise.resolve([]),
      editionNames.size > 0 ? this.editionRepo.findBy({ name: In([...editionNames]) }) : Promise.resolve([]),
      rarityNames.size > 0 ? this.rarityRepo.findBy({ name: In([...rarityNames]) }) : Promise.resolve([]),
      subdivisionNames.size > 0 ? this.subdivisionRepo.findBy({ name: In([...subdivisionNames]) }) : Promise.resolve([]),
      codesInExcel.size > 0 ? this.productRepo.findBy({ code: In([...codesInExcel]) }) : Promise.resolve([]),
      barcodesInExcel.size > 0 ? this.productRepo.findBy({ barcode: In([...barcodesInExcel]) }) : Promise.resolve([]),
    ]);

    const brandMap = new Map(brands.map(b => [b.name.trim().toLowerCase(), b]));
    const gameMap = new Map(games.map(g => [g.name.trim().toLowerCase(), g]));
    const editionMap = new Map(editions.map(e => [e.name.trim().toLowerCase(), e]));
    const rarityMap = new Map(rarities.map(r => [r.name.trim().toLowerCase(), r]));
    const subdivisionMap = new Map(subdivisions.map(s => [s.name.trim().toLowerCase(), s]));

    const existingProductsMap = new Map<string, Product>();
    existingProductsByCode.forEach(p => existingProductsMap.set(p.code, p));
    existingProductsByBarcode.forEach(p => {
      if (p.barcode) existingProductsMap.set(p.barcode, p);
    });

    const items: any[] = [];
    const autoCreatedBrands = new Set<string>();
    const autoCreatedGames = new Set<string>();
    const autoCreatedEditions = new Set<string>();
    const autoCreatedRarities = new Set<string>();
    const autoCreatedSubdivisions = new Set<string>();

    for (const { rowNumber, values } of rowsData) {
      const isVisibleStr = getCol(values, ['isvisible', 'visible'], 15).toUpperCase();
      const rawCostPrice = getCol(values, ['costprice', 'costo', 'preciocosto'], 5);
      const rawPrice = getCol(values, ['price', 'precio'], 6);
      const rawStock = getCol(values, ['stock', 'cantidad'], 7);
      const rawOfferPrice = getCol(values, ['offerprice', 'preciooferta'], 13);
      const rawPurchaseLimit = getCol(values, ['purchaselimit', 'limitedecompra'], 14);

      let rowSubdivisionName = '';
      if (hasSubdivisionHeader) {
        rowSubdivisionName = getCol(values, ['subdivisionname', 'subdivision', 'subdivisiones'], 11);
      } else if (!hasCategoryHeader) {
        rowSubdivisionName = getCellValue(values[11]);
      }

      let rowCategoryName: ProductCategory | undefined = undefined;
      if (hasCategoryHeader) {
        const catVal = getCol(values, ['categoryname', 'category', 'categoria'], 11).toLowerCase();
        if (Object.values(ProductCategory).includes(catVal as any)) {
          rowCategoryName = catVal as ProductCategory;
        }
      }

      const rowData = {
        code: getCol(values, ['code', 'codigo'], 1),
        barcode: getCol(values, ['barcode', 'codigobarras'], 2),
        name: getCol(values, ['name', 'nombre'], 3),
        description: getCol(values, ['description', 'descripcion'], 4),
        costPrice: rawCostPrice ? parseFloat(rawCostPrice) : 0,
        price: parseFloat(rawPrice),
        stock: parseInt(rawStock, 10),
        brandName: getCol(values, ['brandname', 'brand', 'marca'], 8),
        gameName: getCol(values, ['gamename', 'game', 'juego'], 9),
        editionName: getCol(values, ['editionname', 'edition', 'edicion'], 10),
        subdivisionName: rowSubdivisionName,
        categoryName: rowCategoryName,
        rarityName: getCol(values, ['rarityname', 'rarity', 'rareza'], 12),
        offerPrice: rawOfferPrice ? parseFloat(rawOfferPrice) : undefined,
        purchaseLimit: rawPurchaseLimit ? parseInt(rawPurchaseLimit, 10) : undefined,
        isVisibleStr,
        imageUrl: getCol(values, ['imageurl', 'image', 'imagen'], 16),
      };

      if (!rowData.code || !rowData.name || isNaN(rowData.price) || isNaN(rowData.stock) || !rowData.brandName) {
        errors.push({ row: rowNumber, message: 'Las columnas code, name, price, stock y brandName son obligatorias.' });
        continue;
      }

      if (!brandMap.has(rowData.brandName.toLowerCase())) {
        autoCreatedBrands.add(rowData.brandName);
      }
      if (rowData.gameName && !gameMap.has(rowData.gameName.toLowerCase())) {
        autoCreatedGames.add(rowData.gameName);
      }
      if (rowData.editionName && !editionMap.has(rowData.editionName.toLowerCase())) {
        autoCreatedEditions.add(rowData.editionName);
      }
      if (rowData.subdivisionName && !subdivisionMap.has(rowData.subdivisionName.toLowerCase())) {
        autoCreatedSubdivisions.add(rowData.subdivisionName);
      }
      if (rowData.rarityName && !rarityMap.has(rowData.rarityName.toLowerCase())) {
        autoCreatedRarities.add(rowData.rarityName);
      }

      const existingProduct = existingProductsMap.get(rowData.code) || (rowData.barcode ? existingProductsMap.get(rowData.barcode) : undefined);
      const isNew = !existingProduct;

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

      const currentStock = existingProduct?.stock || 0;
      const newTotalStock = currentStock + rowData.stock;

      items.push({
        rowNumber,
        code: rowData.code,
        barcode: rowData.barcode || existingProduct?.barcode || '(Autogenerado)',
        name: rowData.name,
        brandName: rowData.brandName,
        gameName: rowData.gameName || '-',
        editionName: rowData.editionName || '-',
        subdivisionName: rowData.subdivisionName || '-',
        rarityName: rowData.rarityName || '-',
        price: rowData.price,
        costPrice: rowData.costPrice,
        stockToAdd: rowData.stock,
        currentStock,
        newTotalStock,
        isNew,
        status: isNew ? 'NUEVO' : 'ACTUALIZACIÓN',
        isVisible,
      });
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Se encontraron errores en el archivo Excel.', errors });
    }

    return {
      valid: true,
      totalRows: items.length,
      toCreateCount: items.filter(i => i.isNew).length,
      toUpdateCount: items.filter(i => !i.isNew).length,
      autoCreatedRelations: {
        brands: Array.from(autoCreatedBrands),
        games: Array.from(autoCreatedGames),
        editions: Array.from(autoCreatedEditions),
        rarities: Array.from(autoCreatedRarities),
        subdivisions: Array.from(autoCreatedSubdivisions),
      },
      items,
    };
  }

  async bulkCreate(fileBuffer: any) {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer);

    let worksheet = workbook.getWorksheet('Plantilla Productos');
    if (!worksheet) {
      worksheet = workbook.worksheets.find(ws => ws.name.trim().toLowerCase() === 'plantilla productos')
        || workbook.worksheets.find(ws => ws.name.trim().toLowerCase() !== 'instrucciones')
        || workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas de datos válidas.');
    }

    const errors: { row: number; message: string }[] = [];
    const productsToUpsert: any[] = [];
    const rowsData: any[] = [];

    const getCellValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        if (val.result !== undefined && val.result !== null) return val.result.toString().trim();
        if (val.text !== undefined && val.text !== null) return val.text.toString().trim();
        if (Array.isArray(val.richText)) return val.richText.map((r: any) => r.text || '').join('').trim();
      }
      return val.toString().trim();
    };

    // Mapeo dinámico de encabezados
    const headerMap = new Map<string, number>();
    const headerRow = worksheet.getRow(1);
    if (headerRow && headerRow.values) {
      const hValues = headerRow.values as any[];
      hValues.forEach((val, idx) => {
        if (val) {
          const str = getCellValue(val).toLowerCase().replace(/[^a-z0-9]/g, '');
          headerMap.set(str, idx);
        }
      });
    }

    const getCol = (values: any[], aliases: string[], fallbackIdx: number): string => {
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        const idx = headerMap.get(cleanAlias);
        if (idx !== undefined && values[idx] !== undefined) {
          return getCellValue(values[idx]);
        }
      }
      return values[fallbackIdx] !== undefined ? getCellValue(values[fallbackIdx]) : '';
    };

    // Leemos todas las filas ignorando la fila 1 de encabezados
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1 || !row.values || row.values.length === 0) return;
      rowsData.push({ rowNumber, values: row.values as any });
    });

    if (rowsData.length === 0) {
      throw new BadRequestException('El archivo Excel no contiene filas de datos para procesar.');
    }

    const brandNames = new Set(rowsData.map(r => getCol(r.values, ['brandname', 'brand', 'marca'], 8)).filter(Boolean));
    const gameNames = new Set(rowsData.map(r => getCol(r.values, ['gamename', 'game', 'juego'], 9)).filter(Boolean));
    const editionNames = new Set(rowsData.map(r => getCol(r.values, ['editionname', 'edition', 'edicion'], 10)).filter(Boolean));
    const rarityNames = new Set(rowsData.map(r => getCol(r.values, ['rarityname', 'rarity', 'rareza'], 12)).filter(Boolean));
    const codesInExcel = new Set(rowsData.map(r => getCol(r.values, ['code', 'codigo'], 1)).filter(Boolean));
    const barcodesInExcel = new Set(rowsData.map(r => getCol(r.values, ['barcode', 'codigobarras'], 2)).filter(Boolean));

    const hasSubdivisionHeader = ['subdivisionname', 'subdivision', 'subdivisiones'].some(a => headerMap.has(a));
    const hasCategoryHeader = ['categoryname', 'category', 'categoria'].some(a => headerMap.has(a));

    const subdivisionNames = new Set(rowsData.map(r => {
      if (hasSubdivisionHeader) {
        return getCol(r.values, ['subdivisionname', 'subdivision', 'subdivisiones'], 11);
      } else if (!hasCategoryHeader) {
        return getCellValue(r.values[11]);
      }
      return '';
    }).filter(Boolean));

    const [brands, games, editions, rarities, subdivisions, existingProductsByCode, existingProductsByBarcode] = await Promise.all([
      brandNames.size > 0 ? this.brandRepo.findBy({ name: In([...brandNames]) }) : Promise.resolve([]),
      gameNames.size > 0 ? this.gameRepo.find({ where: { name: In([...gameNames]) }, relations: ['subdivisions'] }) : Promise.resolve([]),
      editionNames.size > 0 ? this.editionRepo.findBy({ name: In([...editionNames]) }) : Promise.resolve([]),
      rarityNames.size > 0 ? this.rarityRepo.findBy({ name: In([...rarityNames]) }) : Promise.resolve([]),
      subdivisionNames.size > 0 ? this.subdivisionRepo.findBy({ name: In([...subdivisionNames]) }) : Promise.resolve([]),
      codesInExcel.size > 0 ? this.productRepo.findBy({ code: In([...codesInExcel]) }) : Promise.resolve([]),
      barcodesInExcel.size > 0 ? this.productRepo.findBy({ barcode: In([...barcodesInExcel]) }) : Promise.resolve([]),
    ]);

    // Maps case-insensitive para búsquedas
    const brandMap = new Map(brands.map(b => [b.name.trim().toLowerCase(), b]));
    const gameMap = new Map(games.map(g => [g.name.trim().toLowerCase(), g]));
    const editionMap = new Map(editions.map(e => [e.name.trim().toLowerCase(), e]));
    const rarityMap = new Map(rarities.map(r => [r.name.trim().toLowerCase(), r]));
    const subdivisionMap = new Map(subdivisions.map(s => [s.name.trim().toLowerCase(), s]));

    const existingProductsMap = new Map<string, Product>();
    existingProductsByCode.forEach(p => existingProductsMap.set(p.code, p));
    existingProductsByBarcode.forEach(p => {
      if (p.barcode) existingProductsMap.set(p.barcode, p);
    });

    const kardexMovementsToRegister: {
      productId?: number;
      productCode?: string;
      quantity: number;
      unitCost: number;
    }[] = [];

    const autoCreatedBrands = new Set<string>();
    const autoCreatedGames = new Set<string>();
    const autoCreatedEditions = new Set<string>();
    const autoCreatedRarities = new Set<string>();
    const autoCreatedSubdivisions = new Set<string>();

    let createdProductsCount = 0;
    let updatedProductsCount = 0;

    for (const { rowNumber, values } of rowsData) {
      const isVisibleStr = getCol(values, ['isvisible', 'visible'], 15).toUpperCase();
      const rawCostPrice = getCol(values, ['costprice', 'costo', 'preciocosto'], 5);
      const rawPrice = getCol(values, ['price', 'precio'], 6);
      const rawStock = getCol(values, ['stock', 'cantidad'], 7);
      const rawOfferPrice = getCol(values, ['offerprice', 'preciooferta'], 13);
      const rawPurchaseLimit = getCol(values, ['purchaselimit', 'limitedecompra'], 14);

      let rowSubdivisionName = '';
      if (hasSubdivisionHeader) {
        rowSubdivisionName = getCol(values, ['subdivisionname', 'subdivision', 'subdivisiones'], 11);
      } else if (!hasCategoryHeader) {
        rowSubdivisionName = getCellValue(values[11]);
      }

      let rowCategoryName: ProductCategory | undefined = undefined;
      if (hasCategoryHeader) {
        const catVal = getCol(values, ['categoryname', 'category', 'categoria'], 11).toLowerCase();
        if (Object.values(ProductCategory).includes(catVal as any)) {
          rowCategoryName = catVal as ProductCategory;
        }
      }

      const rowData = {
        code: getCol(values, ['code', 'codigo'], 1),
        barcode: getCol(values, ['barcode', 'codigobarras'], 2),
        name: getCol(values, ['name', 'nombre'], 3),
        description: getCol(values, ['description', 'descripcion'], 4),
        costPrice: rawCostPrice ? parseFloat(rawCostPrice) : 0,
        price: parseFloat(rawPrice),
        stock: parseInt(rawStock, 10),
        brandName: getCol(values, ['brandname', 'brand', 'marca'], 8),
        gameName: getCol(values, ['gamename', 'game', 'juego'], 9),
        editionName: getCol(values, ['editionname', 'edition', 'edicion'], 10),
        subdivisionName: rowSubdivisionName,
        categoryName: rowCategoryName,
        rarityName: getCol(values, ['rarityname', 'rarity', 'rareza'], 12),
        offerPrice: rawOfferPrice ? parseFloat(rawOfferPrice) : undefined,
        purchaseLimit: rawPurchaseLimit ? parseInt(rawPurchaseLimit, 10) : undefined,
        isVisibleStr,
        imageUrl: getCol(values, ['imageurl', 'image', 'imagen'], 16),
      };

      // --- Validar Fila ---
      if (!rowData.code || !rowData.name || isNaN(rowData.price) || isNaN(rowData.stock) || !rowData.brandName) {
        errors.push({ row: rowNumber, message: 'Las columnas code, name, price, stock y brandName son obligatorias.' });
        continue;
      }

      // 1. Marca: Buscar o crear automáticamente si no existe
      let brand = brandMap.get(rowData.brandName.toLowerCase());
      if (!brand) {
        brand = await this.brandRepo.save(this.brandRepo.create({ name: rowData.brandName }));
        brandMap.set(rowData.brandName.toLowerCase(), brand);
        autoCreatedBrands.add(brand.name);
      }

      // 2. Juego: Buscar o crear automáticamente si se especifica y no existe
      let game: Game | null = null;
      if (rowData.gameName) {
        game = gameMap.get(rowData.gameName.toLowerCase()) || null;
        if (!game) {
          game = await this.gameRepo.save(this.gameRepo.create({ name: rowData.gameName, showInNavbar: true }));
          game.subdivisions = [];
          gameMap.set(rowData.gameName.toLowerCase(), game);
          autoCreatedGames.add(game.name);
        }
      }

      // 3. Subdivisión: Buscar o crear automáticamente si se especifica y no existe
      let subdivision: Subdivision | null = null;
      if (rowData.subdivisionName) {
        subdivision = subdivisionMap.get(rowData.subdivisionName.toLowerCase()) || null;
        if (!subdivision) {
          subdivision = await this.subdivisionRepo.save(this.subdivisionRepo.create({ name: rowData.subdivisionName }));
          subdivisionMap.set(rowData.subdivisionName.toLowerCase(), subdivision);
          autoCreatedSubdivisions.add(subdivision.name);
        }

        // Si se especifica un juego, asegurar que la subdivisión esté asignada al juego
        if (game) {
          if (!game.subdivisions) {
            game.subdivisions = [];
          }
          const alreadyLinked = game.subdivisions.some(s => s.id === subdivision!.id || s.name.toLowerCase() === subdivision!.name.toLowerCase());
          if (!alreadyLinked) {
            game.subdivisions.push(subdivision);
            await this.gameRepo.save(game);
          }
        }
      }

      // 4. Edición: Buscar o crear automáticamente si se especifica y no existe
      let edition: Edition | null = null;
      if (rowData.editionName) {
        edition = editionMap.get(rowData.editionName.toLowerCase()) || null;
        if (!edition) {
          edition = await this.editionRepo.save(this.editionRepo.create({ name: rowData.editionName, game: game || null }));
          editionMap.set(rowData.editionName.toLowerCase(), edition);
          autoCreatedEditions.add(edition.name);
        }
      }

      // 5. Rareza: Buscar o crear automáticamente si se especifica y no existe
      let rarity: Rarity | null = null;
      if (rowData.rarityName) {
        rarity = rarityMap.get(rowData.rarityName.toLowerCase()) || null;
        if (!rarity) {
          rarity = await this.rarityRepo.save(this.rarityRepo.create({ name: rowData.rarityName }));
          rarityMap.set(rowData.rarityName.toLowerCase(), rarity);
          autoCreatedRarities.add(rarity.name);
        }
      }

      const existingProduct = existingProductsMap.get(rowData.code) || (rowData.barcode ? existingProductsMap.get(rowData.barcode) : undefined);

      if (existingProduct) {
        updatedProductsCount++;
      } else {
        createdProductsCount++;
      }

      // Procesar visibilidad
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

      // Si el producto ya existe: sumar el nuevo stock y calcular costo promedio ponderado
      const prevStock = existingProduct?.stock || 0;
      let newStock = prevStock + rowData.stock;
      let finalCostPrice = rowData.costPrice;
      let barcodeToAssign = rowData.barcode || existingProduct?.barcode || this.generateBarcode();

      if (existingProduct) {
        if (rowData.costPrice > 0) {
          const totalCostPrev = prevStock * Number(existingProduct.costPrice || 0);
          const totalCostNew = rowData.stock * rowData.costPrice;
          finalCostPrice = newStock > 0 ? Number(((totalCostPrev + totalCostNew) / newStock).toFixed(2)) : rowData.costPrice;
        } else {
          finalCostPrice = Number(existingProduct.costPrice || 0);
        }
      }

      const productData = {
        ...(existingProduct || {}),
        code: rowData.code,
        barcode: barcodeToAssign,
        name: rowData.name,
        description: rowData.description !== undefined && rowData.description !== '' ? rowData.description : (existingProduct?.description),
        costPrice: finalCostPrice,
        price: rowData.price,
        stock: prevStock, // Mantenemos prevStock para que kardexService aplique el incremento sin duplicar
        brand,
        game,
        edition,
        subdivision: subdivision || (existingProduct?.subdivision || null),
        category: rowData.categoryName || (existingProduct?.category || null),
        rarity,
        offerPrice: (rowData.offerPrice !== undefined && !isNaN(rowData.offerPrice)) ? rowData.offerPrice : (existingProduct?.offerPrice),
        purchaseLimit: (rowData.purchaseLimit !== undefined && !isNaN(rowData.purchaseLimit)) ? rowData.purchaseLimit : (existingProduct?.purchaseLimit),
        isVisible,
        imageUrl: (rowData.imageUrl && !rowData.imageUrl.includes('placeholder')) ? rowData.imageUrl : (existingProduct?.imageUrl || '/uploads/defecto-img.png'),
      };

      productsToUpsert.push(productData);

      if (rowData.stock > 0) {
        kardexMovementsToRegister.push({
          productCode: rowData.code,
          quantity: rowData.stock,
          unitCost: rowData.costPrice,
        });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Se encontraron errores en el archivo Excel.', errors });
    }

    // --- Guardar en una transacción ---
    try {
      const savedProducts = await this.entityManager.transaction(async transactionalEntityManager => {
        return await transactionalEntityManager.save(Product, productsToUpsert);
      });

      // Registrar entradas en el Kardex
      const savedProductsMap = new Map(savedProducts.map(p => [p.code, p]));
      for (const m of kardexMovementsToRegister) {
        const prod = savedProductsMap.get(m.productCode!);
        if (prod) {
          await this.kardexService.registerMovement({
            productId: prod.id,
            movementType: KardexMovementType.ENTRADA_CARGA_MASIVA,
            quantity: m.quantity,
            unitCost: m.unitCost,
            reference: 'Carga Masiva Excel',
            notes: `Ingreso masivo de ${m.quantity} unidades por archivo Excel`,
          });
        }
      }

      const summary = {
        totalProcessed: productsToUpsert.length,
        createdProducts: createdProductsCount,
        updatedProducts: updatedProductsCount,
        autoCreatedBrands: Array.from(autoCreatedBrands),
        autoCreatedGames: Array.from(autoCreatedGames),
        autoCreatedEditions: Array.from(autoCreatedEditions),
        autoCreatedRarities: Array.from(autoCreatedRarities),
        autoCreatedSubdivisions: Array.from(autoCreatedSubdivisions),
      };

      let detailMsg = `Carga exitosa: ${productsToUpsert.length} productos procesados (${createdProductsCount} creados, ${updatedProductsCount} actualizados con Kardex auditado).`;
      const autoTotal = summary.autoCreatedBrands.length + summary.autoCreatedGames.length + summary.autoCreatedEditions.length + summary.autoCreatedRarities.length + summary.autoCreatedSubdivisions.length;
      if (autoTotal > 0) {
        detailMsg += ` Se crearon automáticamente relaciones no existentes.`;
      }

      return {
        message: detailMsg,
        summary,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
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
