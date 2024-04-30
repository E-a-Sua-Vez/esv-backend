import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OutcomeTypeService } from './outcome-type.service';
import { OutcomeType } from './model/outcome-type.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('outcome-type')
export class OutcomeTypeController {
    constructor(private readonly outcomeTypeService: OutcomeTypeService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getOutcomeTypeById(@Param() params: any): Promise<OutcomeType> {
        const { id } = params;
        return this.outcomeTypeService.getOutcomeTypeById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getOutcomeTypes(): Promise<OutcomeType[]> {
        return this.outcomeTypeService.getOutcomeTypes();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getOutcomeTypeByCommerce(@Param() params: any): Promise<OutcomeType[]> {
        const { commerceId } = params;
        return this.outcomeTypeService.getOutcomeTypeByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/list/:ids')
    public async getOutcomeTypesById(@Param() params: any): Promise<OutcomeType[]> {
        const { ids } = params;
        return this.outcomeTypeService.getOutcomeTypesById(ids.split(','));
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createOutcomeType(@User() user, @Body() body: OutcomeType): Promise<OutcomeType> {
        const { commerceId, type, name, tag } = body;
        return this.outcomeTypeService.createOutcomeType(user, commerceId, type, name, tag);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateOutcomeType(@User() user, @Param() params: any, @Body() body: OutcomeType): Promise<OutcomeType> {
        const { id } = params;
        const { type, name, tag, active, available } = body;
        return this.outcomeTypeService.updateOutcomeTypeConfigurations(user, id, name, tag, active, available);
    }
}