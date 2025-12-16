import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';

import { ReceiveHL7MessageDto, HL7MessageResponseDto } from './dto/hl7-message.dto';
import { HL7ApiKeyGuard } from './guards/hl7-api-key.guard';
import { HL7Service } from './hl7.service';

@ApiTags('HL7')
@Controller('hl7')
export class HL7Controller {
  private readonly logger = new Logger(HL7Controller.name);

  constructor(private readonly hl7Service: HL7Service) {}

  @Post('receive')
  @UseGuards(HL7ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive HL7 message',
    description:
      'Receives and processes HL7 messages from laboratories (ORU^R01). Requires API Key in X-API-Key header.',
  })
  @ApiSecurity('ApiKeyAuth')
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    type: HL7MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid HL7 message format',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API Key',
  })
  @ApiResponse({
    status: 404,
    description: 'Matching exam order not found',
  })
  async receiveMessage(
    @Body() dto: ReceiveHL7MessageDto,
    @Req() request: any
  ): Promise<HL7MessageResponseDto> {
    const laboratory = request.laboratory;
    this.logger.log(`Received HL7 message from laboratory: ${laboratory.name} (${laboratory.id})`);

    try {
      const result = await this.hl7Service.processMessage(
        dto.message,
        laboratory.id,
        laboratory.name
      );

      return {
        success: result.success,
        messageId: result.messageId,
        examOrderIds: result.examOrderIds,
      };
    } catch (error) {
      this.logger.error(`Error processing HL7 message: ${error.message}`);

      return {
        success: false,
        messageId: '',
        examOrderIds: [],
        error: error.message,
      };
    }
  }

  /**
   * Endpoint for health check / testing
   * Can be used without authentication for testing purposes
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test HL7 message parsing',
    description: 'Test endpoint to verify HL7 message parsing without processing',
  })
  async testMessage(@Body() dto: ReceiveHL7MessageDto) {
    this.logger.log('Testing HL7 message parsing');

    // This would just parse and return the parsed structure
    // Useful for debugging
    return {
      message: 'HL7 message received for testing',
      length: dto.message.length,
    };
  }
}
