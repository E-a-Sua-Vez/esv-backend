import { Body, Controller, Get, Param, Post, UseGuards, Patch } from '@nestjs/common';
import { RolService } from './rol.service';
import { Rol } from './model/rol.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('rol')
export class RolController {
    constructor(private readonly rolService: RolService) {
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getRoles(): Promise<Rol[]> {
        return this.rolService.getRoles();
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getRolById(@Param() params: any): Promise<Rol> {
        const { id } = params;
        return this.rolService.getRolById(id);
    }

    @Get('/name/:name')
    public async getRolByName(@Param() params: any): Promise<Rol> {
        const { name } = params;
        return this.rolService.getRolByName(name);
    }

    //@UseGuards(AuthGuard)
    @Post('/init')
    public async initRol(@User() user): Promise<Rol[]> {
        return this.rolService.initRol(user);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createRol(@User() user, @Body() body: any): Promise<Rol> {
        const { name, description, permissions } = body;
        return this.rolService.createRol(user, name, description, permissions);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id/permission')
    public async updateRolPermission(@User() user, @Param() params: any, @Body() body: any): Promise<Rol> {
        const { id } = params;
        const { name, value } = body;
        return this.rolService.updateRolPermission(user, id, name, value);
    }
}