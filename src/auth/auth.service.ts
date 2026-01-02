/* eslint-disable prettier/prettier */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterFromGuestDto } from './dto/register-from-guest.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentService } from 'src/payment/payment.service';
import { Order } from 'src/orders/order.entity';
import { IsNull, Repository } from 'typeorm';
import { User } from 'src/users/user.entity';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    // ✅ CORRECCIÓN 1: Se elimina la inyección de 'UsersService'.
    
    @InjectRepository(User) // ✅ Se inyecta el repositorio de User directamente.
    private userRepo: Repository<User>,
    
    private jwtService: JwtService,
    private paymentService: PaymentService,
    
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    // ✅ CORRECCIÓN 2: Se usa 'this.userRepo' en lugar de 'this.usersService'.
    const user = await this.userRepo.findOneBy({ email });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: User) {
    // Asegúrate de que el objeto 'user' que recibes aquí ya no tiene la contraseña.
    // El método validateUser ya se encarga de quitarla.
    
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, // Asegúrate de que tu entidad User tenga 'role' y no 'roles'}
      name: user.name,
      rut: user.rut

    };
    
    // ✅ CORRECCIÓN: Devuelve tanto el token como el objeto 'user'
    return {
      access_token: this.jwtService.sign(payload),
      user: user // Devuelve el objeto de usuario (sin contraseña) que recibiste
    };
  }

async registerFromGuest(dto: RegisterFromGuestDto) {
  // 1. Valida el token de pago y encuentra la orden (esto se mantiene igual)
  const paymentDetails = await this.paymentService.getPaymentDetails(dto.paymentToken);
  const matches = paymentDetails.commerceOrder?.match(/^order-(\d+)-/);
  if (!matches?.[1]) {
    throw new NotFoundException('Orden no válida en el token de pago.');
  }
  const orderId = parseInt(matches[1], 10);
  const order = await this.orderRepo.findOne({ where: { id: orderId, userId: IsNull() } });

  if (!order) {
    throw new NotFoundException('No se encontró una orden de invitado válida para este pago.');
  }

  // ✅ CORRECCIÓN: Ahora usamos el email del DTO
  // 2. Verifica que el email ingresado no esté ya registrado
  const existingUser = await this.userRepo.findOneBy({ email: dto.email });
  if (existingUser) {
    throw new ConflictException('Ya existe una cuenta con este correo electrónico.');
  }

  // 3. Crea el nuevo usuario con el email y contraseña del DTO
  const hashedPassword = await bcrypt.hash(dto.password, 10);
  const newUser = this.userRepo.create({
    name: dto.name,
    email: dto.email,
    password: hashedPassword,
  });
  await this.userRepo.save(newUser);

  // 4. Vincula la orden al nuevo usuario (esto se mantiene igual)
  order.user = newUser;
  order.userId = newUser.id;
  order.guestEmail = null; // Limpiamos el email de invitado original
  await this.orderRepo.save(order);

  // 5. Devuelve un mensaje de éxito
  return { message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.' };
}  


// ✅ Registro estándar (ahora el registro desde checkout lo maneja OrdersService)
  async register(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // 1. Verifica si el email ya existe
    const existingUser = await this.userRepo.findOneBy({ email: dto.email });
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    // 2. Hashea la contraseña
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. Crea y guarda el nuevo usuario
    const newUser = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      // Si el DTO de CreateUser lo permite, asignamos los extras
      // (Asegúrate de que CreateUserDto tenga rut, phone, etc. si quieres que register normal los acepte)
    });
    
    const savedUser = await this.userRepo.save(newUser);

    // 4. Devuelve el usuario sin la contraseña
    const { password, ...result } = savedUser;
    return result;
  }
}
