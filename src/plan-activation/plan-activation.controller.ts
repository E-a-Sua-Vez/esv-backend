import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlanActivationService } from './plan-activation.service';
import { PlanActivation } from './model/plan-activation.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';
import { Payment } from 'src/payment/model/payment.entity';

@Controller('plan-activation')
export class PlanActivationController {
    constructor(private readonly planActivationService: PlanActivationService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getPlanActivationById(@Param() params: any): Promise<PlanActivation> {
        const { id } = params;
        return this.planActivationService.getPlanActivationById(id);
    }

    @UseGuards(AuthGuard)
    @Get('businessId/:id')
    public async getPlanActivationByBusinessId(@Param() params: any): Promise<PlanActivation[]> {
        const { id } = params;
        return this.planActivationService.getPlanActivationByBusinessId(id);
    }

    @UseGuards(AuthGuard)
    @Get('/validated/:validated/businessId/:id')
    public async getValidatedPlanActivationByBusinessId(@Param() params: any): Promise<PlanActivation> {
        const { id, validated } = params;
        return this.planActivationService.getValidatedPlanActivationByBusinessId(id, validated);
    }

    @UseGuards(AuthGuard)
    @Get('/validated/:validated')
    public async getValidatedPlanActivation(@Param() params: any): Promise<PlanActivation[]> {
        const { validated } = params;
        return this.planActivationService.getValidatedPlanActivation(validated);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createPlanActivation(@User() user, @Body() body: PlanActivation): Promise<PlanActivation> {
        const { businessId, planId, planPayedCopy, renewable, origin, paymentMethod, termsAccepted } = body;
        return this.planActivationService.createPlanActivation(user, businessId, planId, planPayedCopy, renewable, origin, paymentMethod, termsAccepted);
    }

    @UseGuards(AuthGuard)
    @Patch('/validate/:id')
    public async validate(@User() user, @Param() params: any, @Body() body: Payment): Promise<PlanActivation> {
        const { id } = params;
        const { businessId, planId, amount, paymentNumber, paymentDate, bankData, method } = body;
        return this.planActivationService.validate(user, id, businessId, planId, amount, paymentNumber, paymentDate, bankData, method);
    }

    @UseGuards(AuthGuard)
    @Patch('/desactivate/:id')
    public async desactivate(@User() user, @Param() params: any): Promise<PlanActivation> {
        const { id } = params;
        return this.planActivationService.desactivate(user, id);
    }
}