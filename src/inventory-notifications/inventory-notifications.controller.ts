import { Controller, Post, HttpCode, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SimpleGuard } from '../auth/simple.guard';

import { InventoryNotificationsService } from './inventory-notifications.service';

@ApiTags('inventory-notifications')
@Controller('inventory-notifications')
export class InventoryNotificationsController {
  private readonly logger = new Logger(InventoryNotificationsController.name);

  constructor(private readonly inventoryNotificationsService: InventoryNotificationsService) {}

  @Post('check-low-stock')
  @UseGuards(SimpleGuard)
  @ApiBearerAuth('simple-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Check low stock products and send notifications',
    description: 'Scheduled endpoint called by GCP Scheduler to check products with low stock levels'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Check completed successfully',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 150 },
        notificationsSent: { type: 'number', example: 12 }
      }
    }
  })
  async checkLowStock() {
    this.logger.log('📞 Endpoint /check-low-stock called');
    try {
      const result = await this.inventoryNotificationsService.checkLowStockProducts();
      this.logger.log(`✅ Low stock check completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Error in check-low-stock endpoint:', error.stack);
      throw error;
    }
  }

  @Post('check-expiring-batches')
  @UseGuards(SimpleGuard)
  @ApiBearerAuth('simple-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Check expiring product batches and send notifications',
    description: 'Scheduled endpoint called by GCP Scheduler to check batches expiring soon'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Check completed successfully',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 85 },
        notificationsSent: { type: 'number', example: 5 }
      }
    }
  })
  async checkExpiringBatches() {
    this.logger.log('📞 Endpoint /check-expiring-batches called');
    try {
      const result = await this.inventoryNotificationsService.checkExpiringBatches();
      this.logger.log(`✅ Expiring batches check completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Error in check-expiring-batches endpoint:', error.stack);
      throw error;
    }
  }
}
