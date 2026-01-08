import { Controller, Get, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(UserRole.ADMIN)
    async findAll() {
        return this.usersService.findAll();
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    async update(@Param('id', ParseIntPipe) id: number, @Body() updateData: any) {
        return this.usersService.update(id, updateData);
    }
}
