import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

async create(name: string, email: string, password: string, role: UserRole = UserRole.CUSTOMER): Promise<User> {
  const hashed = await bcrypt.hash(password, 10);
  const user = this.usersRepository.create({ name, email, password: hashed, role });
  return this.usersRepository.save(user);
}


async findByEmail(email: string): Promise<User | null> {
  return this.usersRepository.findOne({ where: { email } });
}


  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
