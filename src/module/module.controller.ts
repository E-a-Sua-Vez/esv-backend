import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModuleService } from './module.service';
import { Module } from './module.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('module')
export class ModuleController {
    constructor(private readonly moduleService: ModuleService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getModuleById(@Param() params: any): Promise<Module> {
        const { id } = params;
        return this.moduleService.getModuleById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getAllModule(): Promise<Module[]> {
        return this.moduleService.getAllModule();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getModulesByCommerceId(@Param() params: any): Promise<Module[]> {
        const { commerceId } = params;
        return this.moduleService.getModulesByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/active')
    public async getActiveModulesByCommerceId(@Param() params: any): Promise<Module[]> {
        const { commerceId } = params;
        return this.moduleService.getActiveModulesByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createModule(@User() user, @Body() body: Module): Promise<Module> {
        const { commerceId, name } = body;
        return this.moduleService.createModule(user, commerceId, name);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateModuleConfigurations(@User() user, @Param() params: any, @Body() body: Module): Promise<Module> {
        const { id } = params;
        const { name, active } = body;
        return this.moduleService.updateModuleConfigurations(user, id, name, active);
    }
}