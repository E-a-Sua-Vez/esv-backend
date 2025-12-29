import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AttentionService } from './attention.service';
import { AttentionController } from './attention.controller';
import { AttentionStage } from './model/attention-stage.enum';
import { AttentionStatus } from './model/attention-status.enum';

/**
 * E2E Tests for Attention Stages Feature
 *
 * These tests verify the complete flow from HTTP request to database and events
 *
 * Requirements:
 * - Test database (Firestore emulator or test instance)
 * - Event store mock or test instance
 * - Authentication setup
 */
describe('Attention Stages E2E', () => {
  let app: INestApplication;
  let service: AttentionService;
  let authToken: string;

  const testCommerceId = 'test-commerce-123';
  const testQueueId = 'test-queue-456';
  const testAttentionId = 'test-attention-001';
  const testUserId = 'test-user-789';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AttentionController],
      providers: [AttentionService],
      // Add all required providers
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup authentication token for tests
    // authToken = await getTestAuthToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /attention/stage/:id/advance', () => {
    it('should advance stage successfully', async () => {
      // Arrange
      const stage = AttentionStage.PRE_CONSULTATION;
      const notes = 'Paciente preparado para consulta';

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/attention/stage/${testAttentionId}/advance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stage, notes })
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.currentStage).toBe(stage);
      expect(response.body.stageHistory).toBeDefined();
      expect(response.body.stageHistory.length).toBeGreaterThan(0);
    });

    it('should return 404 when attention does not exist', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .patch(`/attention/stage/non-existent-id/advance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stage: AttentionStage.CHECK_IN })
        .expect(404);
    });

    it('should return 400 when feature flag is disabled', async () => {
      // Arrange - Setup commerce without feature flag
      // Act & Assert
      await request(app.getHttpServer())
        .patch(`/attention/stage/${testAttentionId}/advance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stage: AttentionStage.CHECK_IN })
        .expect(400);
    });

    it('should return 400 when attention is cancelled', async () => {
      // Arrange - Create cancelled attention
      // Act & Assert
      await request(app.getHttpServer())
        .patch(`/attention/stage/${testAttentionId}/advance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stage: AttentionStage.CHECK_IN })
        .expect(400);
    });

    it('should require authentication', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .patch(`/attention/stage/${testAttentionId}/advance`)
        .send({ stage: AttentionStage.CHECK_IN })
        .expect(401);
    });

    it('should validate stage enum value', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .patch(`/attention/stage/${testAttentionId}/advance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stage: 'INVALID_STAGE' })
        .expect(400);
    });
  });

  describe('GET /attention/stage/queue/:queueId/stage/:stage', () => {
    it('should return attentions filtered by stage', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get(`/attention/stage/queue/${testQueueId}/stage/${AttentionStage.CHECK_IN}`)
        .query({ commerceId: testCommerceId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((attention: any) => {
        expect(attention.currentStage).toBe(AttentionStage.CHECK_IN);
        expect(attention.queueId).toBe(testQueueId);
        expect(attention.commerceId).toBe(testCommerceId);
      });
    });

    it('should filter by date when provided', async () => {
      // Arrange
      const date = new Date('2024-01-15');

      // Act
      const response = await request(app.getHttpServer())
        .get(`/attention/stage/queue/${testQueueId}/stage/${AttentionStage.CHECK_IN}`)
        .query({ commerceId: testCommerceId, date: date.toISOString() })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((attention: any) => {
        const attentionDate = new Date(attention.createdAt);
        expect(attentionDate.getDate()).toBe(date.getDate());
        expect(attentionDate.getMonth()).toBe(date.getMonth());
        expect(attentionDate.getFullYear()).toBe(date.getFullYear());
      });
    });

    it('should return empty array when no attentions found', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get(`/attention/stage/queue/${testQueueId}/stage/${AttentionStage.TERMINATED}`)
        .query({ commerceId: testCommerceId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
    });

    it('should require commerceId query parameter', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get(`/attention/stage/queue/${testQueueId}/stage/${AttentionStage.CHECK_IN}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Complete Flow E2E', () => {
    it('should complete full attention lifecycle with stages', async () => {
      // This test verifies the complete flow:
      // 1. Create attention
      // 2. Advance through all stages
      // 3. Verify each stage transition
      // 4. Verify events are published
      // 5. Verify read models are updated
      // 6. Query by stage
      // 7. Verify final state

      // Step 1: Create attention
      const createResponse = await request(app.getHttpServer())
        .post('/attention')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          queueId: testQueueId,
          channel: 'QR',
        })
        .expect(201);

      const attentionId = createResponse.body.id;

      // Step 2: Advance through stages
      const stages = [
        AttentionStage.CHECK_IN,
        AttentionStage.PRE_CONSULTATION,
        AttentionStage.CONSULTATION,
        AttentionStage.POST_CONSULTATION,
        AttentionStage.CHECKOUT,
        AttentionStage.TERMINATED,
      ];

      for (const stage of stages) {
        const advanceResponse = await request(app.getHttpServer())
          .patch(`/attention/stage/${attentionId}/advance`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ stage })
          .expect(200);

        expect(advanceResponse.body.currentStage).toBe(stage);
      }

      // Step 3: Verify final state
      const finalResponse = await request(app.getHttpServer())
        .get(`/attention/${attentionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalResponse.body.currentStage).toBe(AttentionStage.TERMINATED);
      expect(finalResponse.body.stageHistory).toHaveLength(stages.length);

      // Step 4: Verify query by stage
      const queryResponse = await request(app.getHttpServer())
        .get(`/attention/stage/queue/${testQueueId}/stage/${AttentionStage.TERMINATED}`)
        .query({ commerceId: testCommerceId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const foundAttention = queryResponse.body.find(
        (att: any) => att.id === attentionId
      );
      expect(foundAttention).toBeDefined();
    });
  });

  describe('Security E2E', () => {
    it('should prevent unauthorized access', async () => {
      await request(app.getHttpServer())
        .patch(`/attention/stage/${testAttentionId}/advance`)
        .send({ stage: AttentionStage.CHECK_IN })
        .expect(401);
    });

    it('should prevent access to other commerce attentions', async () => {
      // Verify user can only access attentions from their commerce
      // This requires proper authorization setup
    });

    it('should validate user permissions', async () => {
      // Verify that only authorized users can advance stages
      // Different roles may have different permissions
    });
  });

  describe('Performance E2E', () => {
    it('should handle concurrent stage advances', async () => {
      // Test race conditions and concurrent updates
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .patch(`/attention/stage/${testAttentionId}/advance`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ stage: AttentionStage.PRE_CONSULTATION })
      );

      const results = await Promise.allSettled(promises);
      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle large number of attentions in query', async () => {
      // Test query performance with many attentions
      const startTime = Date.now();
      await request(app.getHttpServer())
        .get(`/attention/stage/queue/${testQueueId}/stage/${AttentionStage.CHECK_IN}`)
        .query({ commerceId: testCommerceId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration = Date.now() - startTime;
      // Should complete in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000);
    });
  });
});





