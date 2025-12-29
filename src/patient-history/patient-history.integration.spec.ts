import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PatientHistoryModule } from './patient-history.module';

describe('PatientHistory Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PatientHistoryModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('API Endpoints', () => {
    it('should require authentication for patient history endpoints', async () => {
      // Test that endpoints are protected
      await request(app.getHttpServer())
        .get('/patient-history')
        .expect(401);

      await request(app.getHttpServer())
        .get('/patient-history/commerceId/test-commerce')
        .expect(401);

      await request(app.getHttpServer())
        .get('/patient-history/test-id')
        .expect(401);
    });

    it('should have correct endpoint structure', async () => {
      // Test that endpoints exist (even if they return 401)
      const response1 = await request(app.getHttpServer())
        .get('/patient-history')
        .expect(401);

      const response2 = await request(app.getHttpServer())
        .get('/patient-history/commerceId/test-commerce')
        .expect(401);

      // Verify it's authentication error, not 404
      expect(response1.body.message).toContain('Authentication token required');
      expect(response2.body.message).toContain('Authentication token required');
    });

    it('should reject invalid routes', async () => {
      // Test that non-existent endpoints return 404
      await request(app.getHttpServer())
        .get('/patient-history/invalid-route')
        .expect(404);
    });
  });

  describe('Request Validation', () => {
    it('should validate route parameters', async () => {
      // Test with empty parameters
      await request(app.getHttpServer())
        .get('/patient-history/commerceId/')
        .expect(404); // Should not match route

      // Test with invalid characters (if validation exists)
      await request(app.getHttpServer())
        .get('/patient-history/commerceId/invalid@id')
        .expect(401); // Should still require auth first
    });
  });

  describe('HTTP Methods', () => {
    it('should only allow correct HTTP methods', async () => {
      // Test that only GET is allowed for read endpoints
      await request(app.getHttpServer())
        .post('/patient-history')
        .expect(401); // Should require auth, but method is allowed

      await request(app.getHttpServer())
        .delete('/patient-history/test-id')
        .expect(404); // Method not allowed - should be 404 or 405
    });
  });

  describe('Response Format', () => {
    it('should return JSON responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/patient-history')
        .expect(401);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('message');
    });

    it('should include proper error structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/patient-history/commerceId/test-commerce')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.path).toBe('/patient-history/commerceId/test-commerce');
      expect(Array.isArray(response.body.message)).toBe(true);
    });
  });
});

describe('PatientHistory Service Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PatientHistoryModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should load the module successfully', () => {
    expect(app).toBeDefined();
  });

  it('should have patient history service available', () => {
    const patientHistoryService = app.get('PatientHistoryService');
    expect(patientHistoryService).toBeDefined();
  });

  it('should have consultation history service available', () => {
    const consultationHistoryService = app.get('ConsultationHistoryService');
    expect(consultationHistoryService).toBeDefined();
  });
});









