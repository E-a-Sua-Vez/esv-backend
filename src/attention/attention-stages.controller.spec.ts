import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AttentionController } from './attention.controller';
import { AttentionService } from './attention.service';
import { AttentionStage } from './model/attention-stage.enum';
import { Attention } from './model/attention.entity';
import { AttentionStatus } from './model/attention-status.enum';

describe('AttentionController - Stages Feature', () => {
  let controller: AttentionController;
  let service: AttentionService;

  const mockUser = { id: 'collaborator-123' };
  const mockAttentionId = 'attention-123';
  const mockQueueId = 'queue-789';
  const mockCommerceId = 'commerce-456';

  const createMockAttention = (): Attention => {
    return {
      id: mockAttentionId,
      commerceId: mockCommerceId,
      queueId: mockQueueId,
      status: AttentionStatus.PROCESSING,
      currentStage: AttentionStage.CHECK_IN,
      stageHistory: [],
    } as Attention;
  };

  beforeEach(async () => {
    const mockService = {
      advanceStage: jest.fn(),
      getAttentionsByStage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttentionController],
      providers: [
        {
          provide: AttentionService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AttentionController>(AttentionController);
    service = module.get<AttentionService>(AttentionService);
  });

  describe('advanceStage', () => {
    it('should call service.advanceStage with correct parameters', async () => {
      // Arrange
      const mockAttention = createMockAttention();
      const body = {
        stage: AttentionStage.PRE_CONSULTATION,
        notes: 'Test notes',
      };
      (service.advanceStage as jest.Mock).mockResolvedValue(mockAttention);

      // Act
      const result = await controller.advanceStage(mockUser, { id: mockAttentionId }, body);

      // Assert
      expect(service.advanceStage).toHaveBeenCalledWith(
        mockUser.id,
        mockAttentionId,
        AttentionStage.PRE_CONSULTATION,
        'Test notes'
      );
      expect(result).toEqual(mockAttention);
    });

    it('should handle missing notes parameter', async () => {
      // Arrange
      const mockAttention = createMockAttention();
      const body = {
        stage: AttentionStage.PRE_CONSULTATION,
      };
      (service.advanceStage as jest.Mock).mockResolvedValue(mockAttention);

      // Act
      const result = await controller.advanceStage(mockUser, { id: mockAttentionId }, body);

      // Assert
      expect(service.advanceStage).toHaveBeenCalledWith(
        mockUser.id,
        mockAttentionId,
        AttentionStage.PRE_CONSULTATION,
        undefined
      );
      expect(result).toEqual(mockAttention);
    });

    it('should propagate service errors', async () => {
      // Arrange
      const error = new HttpException('Feature not enabled', HttpStatus.BAD_REQUEST);
      const body = {
        stage: AttentionStage.PRE_CONSULTATION,
      };
      (service.advanceStage as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.advanceStage(mockUser, { id: mockAttentionId }, body)
      ).rejects.toThrow(error);
    });

    it('should validate stage parameter is provided', async () => {
      // Arrange
      const body = {}; // Missing stage

      // Act & Assert
      await expect(
        controller.advanceStage(mockUser, { id: mockAttentionId }, body)
      ).rejects.toThrow();
    });
  });

  describe('getAttentionsByStage', () => {
    it('should call service.getAttentionsByStage with correct parameters', async () => {
      // Arrange
      const mockAttentions = [createMockAttention()];
      const query = {
        commerceId: mockCommerceId,
        date: '2024-01-15',
      };
      (service.getAttentionsByStage as jest.Mock).mockResolvedValue(mockAttentions);

      // Act
      const result = await controller.getAttentionsByStage(
        { queueId: mockQueueId, stage: AttentionStage.CHECK_IN },
        query
      );

      // Assert
      expect(service.getAttentionsByStage).toHaveBeenCalledWith(
        mockCommerceId,
        mockQueueId,
        AttentionStage.CHECK_IN,
        expect.any(Date)
      );
      expect(result).toEqual(mockAttentions);
    });

    it('should handle missing date parameter', async () => {
      // Arrange
      const mockAttentions = [createMockAttention()];
      const query = {
        commerceId: mockCommerceId,
      };
      (service.getAttentionsByStage as jest.Mock).mockResolvedValue(mockAttentions);

      // Act
      const result = await controller.getAttentionsByStage(
        { queueId: mockQueueId, stage: AttentionStage.CHECK_IN },
        query
      );

      // Assert
      expect(service.getAttentionsByStage).toHaveBeenCalledWith(
        mockCommerceId,
        mockQueueId,
        AttentionStage.CHECK_IN,
        undefined
      );
      expect(result).toEqual(mockAttentions);
    });

    it('should handle invalid date format gracefully', async () => {
      // Arrange
      const query = {
        commerceId: mockCommerceId,
        date: 'invalid-date',
      };

      // Act
      const result = await controller.getAttentionsByStage(
        { queueId: mockQueueId, stage: AttentionStage.CHECK_IN },
        query
      );

      // Assert - Should still call service, but with invalid date
      expect(service.getAttentionsByStage).toHaveBeenCalled();
    });
  });
});





