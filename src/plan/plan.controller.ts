import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlanService } from './plan.service';
import { Plan } from './model/plan.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('plan')
export class PlanController {
    constructor(private readonly planService: PlanService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getPlanById(@Param() params: any): Promise<Plan> {
        const { id } = params;
        return this.planService.getPlanById(id);
    }

    @Get('/')
    public async getPlan(): Promise<Plan[]> {
        return this.planService.getAll();
    }

    @Get('/online/country/:country')
    public async getOnlinePlans(@Param() params: any): Promise<Plan[]> {
        const { country } = params;
        return this.planService.getOnlinePlans(country);
    }

    @UseGuards(AuthGuard)
    @Post('/init')
    public async initPlan(@User() user): Promise<Plan[]> {
        return this.planService.initPlan(user);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createPlan(@User() user, @Body() body: Plan): Promise<Plan> {
        const { name, country, description, price, periodicity, order, online, onlinePrice, saving, onlineSaving } = body;
        return this.planService.createPlan(user, name, country, description, price, periodicity, order, online, onlinePrice, saving, onlineSaving);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id/permission')
    public async updatePlanPermission(@User() user, @Param() params: any, @Body() body: any): Promise<Plan> {
        const { id } = params;
        const { name, value } = body;
        return this.planService.updatePlanPermission(user, id, name, value);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updatePlanConfigurations(@User() user, @Param() params: any, @Body() body: Plan): Promise<Plan> {
        const { id } = params;
        const { name, country, description, periodicity, order, price, active, online, onlinePrice, saving, onlineSaving } = body;
        return this.planService.updatePlanConfigurations(user, id, name, country, description, periodicity, order, price, active, online, onlinePrice, saving, onlineSaving);
    }
}