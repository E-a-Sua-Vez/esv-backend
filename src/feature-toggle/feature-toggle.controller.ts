import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FeatureToggleService } from './feature-toggle.service';
import { FeatureToggle, FeatureToggleOption } from './model/feature-toggle.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('feature-toggle')
export class FeatureToggleController {
    constructor(private readonly featureToggleService: FeatureToggleService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getFeatureToggleById(@Param() params: any): Promise<FeatureToggle> {
        const { id } = params;
        return this.featureToggleService.getFeatureToggleById(id);
    }

    @Get('/name/:name')
    public async getFeatureToggleByName(@Param() params: any): Promise<FeatureToggle> {
        const { name } = params;
        return this.featureToggleService.getFeatureToggleByName(name);
    }

    @UseGuards(AuthGuard)
    @Get('/options/all')
    public async getFeatureToggleOptions(): Promise<FeatureToggleOption[]> {
        return this.featureToggleService.getFeatureToggleOptions();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getFeatureToggleByCommerceId(@Param() params: any): Promise<FeatureToggle[]> {
        const { commerceId } = params;
        return this.featureToggleService.getFeatureToggleByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/name/:name')
    public async getFeatureToggleByNameAndCommerceId(@Param() params: any): Promise<FeatureToggle> {
        const { commerceId, name } = params;
        return this.featureToggleService.getFeatureToggleByNameAndCommerceId(commerceId, name);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createFeatureToggle(@User() user, @Body() body: FeatureToggle): Promise<FeatureToggle> {
        const { name, commerceId, type } = body;
        return this.featureToggleService.createFeatureToggle(user, name, commerceId, type);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateFeatureToggle(@User() user, @Param() params: any, @Body() body: FeatureToggle): Promise<FeatureToggle> {
        const { id } = params;
        const { active } = body;
        return this.featureToggleService.updateFeatureToggle(user, id, active);
    }
}