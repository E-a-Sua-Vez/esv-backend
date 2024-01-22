import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { Feature } from './feature.entity';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('feature')
export class FeatureController {
    constructor(private readonly featureService: FeatureService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getFeatureToggleById(@Param() params: any): Promise<Feature> {
        const { id } = params;
        return this.featureService.getFeatureById(id);
    }
    @UseGuards(AuthGuard)
    @Post()
    public async createFeature(@Body() body: any): Promise<Feature> {
        const { name, description, type, module } = body;
        return this.featureService.createFeature(name, description, type, module);
    }
    @Get('/name/:name')
    public async getFeatureToggleByName(@Param() params: any): Promise<Feature> {
        const { name } = params;
        return this.featureService.getFeatureByName(name);
    }
    @Get('/type/:type')
    public async getFeatureToggleByType(@Param() params: any): Promise<Feature[]> {
        const { type } = params;
        return this.featureService.getFeatureByType(type);
    }
    @Get('/module/:module')
    public async getFeatureByModule(@Param() params: any): Promise<Feature[]> {
        const { type } = params;
        return this.featureService.getFeatureByModule(type);
    }
}