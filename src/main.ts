import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';

import { AppModule } from './app.module';
import { GcpLoggerService } from './shared/logger/gcp-logger.service';

async function bootstrap(): Promise<void> {
  try {
    console.log('[Bootstrap] Starting NestJS application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'], // Enable some logging to see what's happening
    });
    console.log('[Bootstrap] AppModule created successfully');

    // Get the custom logger service
    const logger = app.get(GcpLoggerService);
    logger.setContext('Bootstrap');
    console.log('[Bootstrap] Logger initialized');
    console.log('[Bootstrap] Setting up middleware...');
    // Request size limits - reduced from 10mb for security
    // Consider reducing further based on actual needs
    const maxRequestSize = process.env.MAX_REQUEST_SIZE || '5mb';
    app.use(bodyParser.json({ limit: maxRequestSize }));
    app.use(bodyParser.urlencoded({ limit: maxRequestSize, extended: true }));
    console.log('[Bootstrap] Body parser configured');
    const corsOriginConfig = {
      local: ['http://localhost:5173', 'http://localhost:5174'],
      test: [
        'https://estuturno.app',
        'https://www.estuturno.app',
        'https://www.estuturno.cl',
        'https://easuavez.com',
        'https://www.easuavez.com',
        'https://publico.estuturno.app',
        'https://publico.easuavez.com',
        'https://interno.estuturno.cl',
        'https://interno.estuturno.app',
        'https://interno.easuavez.com',
        'https://app.easuavez.com',
        'https://test.easuavez.com',
        'https://event.estuturno.app',
        'https://event.easuavez.com',
        'https://event-store.easuavez.com',
        'https://consumer.estuturno.app',
        'https://consumer.easuavez.com',
        'https://event-consumer.easuavez.com',
        'https://query.estuturno.app',
        'https://query.easuavez.com',
        'https://query-stack.easuavez.com',
      ],
      prod: [
        'https://estuturno.app',
        'https://www.estuturno.app',
        'https://www.estuturno.cl',
        'https://easuavez.com',
        'https://www.easuavez.com',
        'https://publico.estuturno.app',
        'https://publico.easuavez.com',
        'https://interno.estuturno.cl',
        'https://interno.estuturno.app',
        'https://interno.easuavez.com',
        'https://app.easuavez.com',
        'https://event.estuturno.app',
        'https://event.easuavez.com',
        'https://event-store.easuavez.com',
        'https://consumer.estuturno.app',
        'https://consumer.easuavez.com',
        'https://event-consumer.easuavez.com',
        'https://query.estuturno.app',
        'https://query.easuavez.com',
        'https://query-stack.easuavez.com',
      ],
    };
    // CORS configuration - removed manual headers for security
    // Only use enableCors() to avoid conflicts and security issues
    console.log('[Bootstrap] Configuring CORS...');
    const allowedOrigins = corsOriginConfig[process.env.NODE_ENV] || corsOriginConfig['local'];
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Log CORS violation for security monitoring
          console.warn(
            JSON.stringify({
              severity: 'WARNING',
              timestamp: new Date().toISOString(),
              message: 'CORS violation - Origin not allowed',
              origin,
              allowedOrigins,
              service: 'esv-backend',
              securityEvent: 'CORS_VIOLATION',
            })
          );
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'PUT', 'PATCH', 'POST'],
      allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
      credentials: true,
      maxAge: 86400, // 24 hours
    });
    console.log('[Bootstrap] CORS configured');
    app.enableVersioning({
      type: VersioningType.URI,
    });
    console.log('[Bootstrap] Versioning enabled');
    // Global exception filter is registered via APP_FILTER in app.module.ts

    // Global validation pipe - disabled strict validation to allow all properties
    console.log('[Bootstrap] Setting up ValidationPipe...');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: false, // Allow all properties
        forbidNonWhitelisted: false, // Don't throw error for non-whitelisted properties
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );
    console.log('[Bootstrap] ValidationPipe configured (permissive mode)');

    // Security headers
    console.log('[Bootstrap] Setting up security headers...');
    app.use((req, res, next) => {
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // XSS Protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      // Content Security Policy (adjust based on your needs)
      if (process.env.NODE_ENV === 'prod') {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        );
      }
      next();
    });
    console.log('[Bootstrap] Security headers configured');

    console.log('[Bootstrap] Setting up Swagger...');
    // Swagger/OpenAPI Documentation
    const config = new DocumentBuilder()
      .setTitle('ESV Backend API')
      .setDescription('API documentation for ESV Backend - Appointment and Queue Management System')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth' // This name here is important for matching up with @ApiBearerAuth() in your controller!
      )
      .addServer(process.env.BACKEND_URL || 'http://localhost:3000', 'Default server')
      .addTag('booking', 'Booking management endpoints')
      .addTag('commerce', 'Commerce management endpoints')
      .addTag('queue', 'Queue management endpoints')
      .addTag('user', 'User management endpoints')
      .addTag('client', 'Client management endpoints')
      .addTag('attention', 'Attention management endpoints')
      .addTag('waitlist', 'Waitlist management endpoints')
      .addTag('notification', 'Notification endpoints')
      .addTag('business', 'Business management endpoints')
      .addTag('service', 'Service management endpoints')
      .addTag('payment', 'Payment processing endpoints')
      .addTag('plan', 'Plan management endpoints')
      .addTag('survey', 'Survey management endpoints')
      .addTag('health', 'Health check endpoints')
      .addTag('rol', 'Role management endpoints')
      .addTag('feature-toggle', 'Feature toggle management endpoints')
      .addTag('administrator', 'Administrator management endpoints')
      .addTag('collaborator', 'Collaborator management endpoints')
      .addTag('partner', 'Partner management endpoints')
      .addTag('income', 'Income management endpoints')
      .addTag('package', 'Package management endpoints')
      .addTag('form', 'Form management endpoints')
      .addTag('feature', 'Feature management endpoints')
      .addTag('module', 'Module management endpoints')
      .addTag('product', 'Product management endpoints')
      .addTag('company', 'Company management endpoints')
      .addTag('block', 'Block management endpoints')
      .addTag('message', 'Message management endpoints')
      .addTag('documents', 'Document management endpoints')
      .addTag('outcome', 'Outcome management endpoints')
      .addTag('outcome-type', 'Outcome type management endpoints')
      .addTag('form-personalized', 'Personalized form management endpoints')
      .addTag('patient-history', 'Patient history management endpoints')
      .addTag('patient-history-item', 'Patient history item management endpoints')
      .addTag('plan-activation', 'Plan activation management endpoints')
      .addTag('survey-personalized', 'Personalized survey management endpoints')
      .addTag('suggestion', 'Suggestion management endpoints')
      .addTag('app', 'Application root endpoints')
      .build();

    console.log('[Bootstrap] Creating Swagger document...');
    const document = SwaggerModule.createDocument(app, config);
    console.log('[Bootstrap] Setting up Swagger UI...');
    SwaggerModule.setup('api-docs', app, document, {
      customSiteTitle: 'ESV Backend API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    console.log('[Bootstrap] Swagger setup complete');
    // Generate OpenAPI JSON file for Postman import
    if (process.env.NODE_ENV === 'local' || process.env.GENERATE_SWAGGER_JSON === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');
      const outputPath = path.join(process.cwd(), 'docs', 'openapi.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
      logger.info(`OpenAPI specification written to ${outputPath}`);
    }

    const port = process.env.PORT || 3000;
    console.log(`[Bootstrap] Starting server on port ${port}...`);
    const server = await app.listen(port);
    server.setTimeout(60000);

    const baseUrl = `http://localhost:${port}`;
    logger.info(`Application is running on: ${baseUrl}/health`, {
      environment: process.env.NODE_ENV || 'local',
      port,
      healthEndpoint: `${baseUrl}/health`,
      swaggerEndpoint: `${baseUrl}/api-docs`,
    });
    console.log(`[Bootstrap] ✓ Application is running on: ${baseUrl}/health`);
    console.log(`[Bootstrap] ✓ Swagger documentation available at: ${baseUrl}/api-docs`);
  } catch (error) {
    console.error('[Bootstrap] Error during bootstrap:', error);
    process.exit(1);
  }
}

bootstrap().catch(error => {
  console.error('[Bootstrap] Unhandled error:', error);
  process.exit(1);
});
