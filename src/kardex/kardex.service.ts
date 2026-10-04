import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Kardex } from './kardex.entity';
import { Product } from 'src/products/product.entity';
import { User } from 'src/users/user.entity';
import { CreateKardexMovementDto } from './dto/create-kardex-movement.dto';
import { KardexMovementType } from './enums/kardex-movement-type.enum';

@Injectable()
export class KardexService {
  constructor(
    @InjectRepository(Kardex)
    private readonly kardexRepository: Repository<Kardex>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Registra un movimiento de Kardex y actualiza el stock/costo del producto en una transacción atómica.
   */
  async registerMovement(dto: CreateKardexMovementDto): Promise<Kardex> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
      });

      if (!product) {
        throw new NotFoundException(`Producto con ID ${dto.productId} no fue encontrado.`);
      }

      const previousStock = product.stock;
      const unitCost = dto.unitCost !== undefined ? Number(dto.unitCost) : Number(product.costPrice || 0);

      // Determinar si incrementa o decrementa stock
      const isPositiveMovement = [
        KardexMovementType.ENTRADA_COMPRA,
        KardexMovementType.ENTRADA_CARGA_MASIVA,
        KardexMovementType.AJUSTE_POSITIVO,
        KardexMovementType.DEVOLUCION_CLIENTE,
      ].includes(dto.movementType);

      const quantityDelta = isPositiveMovement ? Math.abs(dto.quantity) : -Math.abs(dto.quantity);
      const newStock = previousStock + quantityDelta;

      if (newStock < 0) {
        throw new BadRequestException(
          `Stock insuficiente para el producto '${product.name}'. Stock actual: ${previousStock}, intentando restar: ${Math.abs(dto.quantity)}`,
        );
      }

      // Si se proporciona un costo unitario válido, actualizar el costo del producto directamente
      if (dto.unitCost !== undefined && dto.unitCost > 0) {
        product.costPrice = dto.unitCost;
      }

      product.stock = newStock;
      await queryRunner.manager.save(product);

      let user: User | null = null;
      if (dto.userId) {
        user = await queryRunner.manager.findOne(User, { where: { id: dto.userId } });
      }

      const kardexEntry = queryRunner.manager.create(Kardex, {
        product,
        movementType: dto.movementType,
        quantity: dto.quantity,
        previousStock,
        newStock,
        unitCost,
        totalValue: Number((Math.abs(dto.quantity) * unitCost).toFixed(2)),
        reference: dto.reference || undefined,
        notes: dto.notes || undefined,
        user: user || undefined,
      });

      const savedKardex = await queryRunner.manager.save(kardexEntry);
      await queryRunner.commitTransaction();

      return savedKardex;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene movimientos del Kardex con paginación y filtros
   */
  async findAll(query: {
    productId?: number;
    movementType?: KardexMovementType;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 15;
    const skip = (page - 1) * limit;

    const qb = this.kardexRepository.createQueryBuilder('kardex')
      .leftJoinAndSelect('kardex.product', 'product')
      .leftJoinAndSelect('kardex.user', 'user')
      .orderBy('kardex.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.productId) {
      qb.andWhere('product.id = :productId', { productId: query.productId });
    }

    if (query.movementType) {
      qb.andWhere('kardex.movementType = :movementType', { movementType: query.movementType });
    }

    if (query.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.code ILIKE :search OR product.barcode ILIKE :search OR kardex.reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene métricas valorizadas del inventario general
   */
  async getInventorySummary() {
    const products = await this.productRepository.find();

    let totalProducts = products.length;
    let totalStockItems = 0;
    let totalInventoryValueCost = 0;
    let totalInventoryValueRetail = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = p.stock || 0;
      const cost = Number(p.costPrice || 0);
      const price = Number(p.price || 0);
      const minStock = p.minStock || 5;

      totalStockItems += stock;
      totalInventoryValueCost += stock * cost;
      totalInventoryValueRetail += stock * price;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    }

    const totalPotentialProfit = totalInventoryValueRetail - totalInventoryValueCost;

    return {
      totalProducts,
      totalStockItems,
      totalInventoryValueCost: Number(totalInventoryValueCost.toFixed(2)),
      totalInventoryValueRetail: Number(totalInventoryValueRetail.toFixed(2)),
      totalPotentialProfit: Number(totalPotentialProfit.toFixed(2)),
      lowStockCount,
      outOfStockCount,
    };
  }
}
