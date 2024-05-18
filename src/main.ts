import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestInterceptor } from './shared/interceptors/request.interceptor';
import { TransformInterceptor } from './shared/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  const corsOriginConfig = {
    'local': [
      "http://localhost:5173"
    ],
    'test': [
      "https://estuturno.app",
      "https://www.estuturno.app",
      "https://www.estuturno.cl",
      "https://easuavez.com",
      "https://www.easuavez.com",
      "https://publico.estuturno.app",
      "https://publico.easuavez.com",
      "https://interno.estuturno.cl",
      "https://interno.estuturno.app",
      "https://interno.easuavez.com",
      "https://app.easuavez.com",
      "https://test.easuavez.com",
      "https://event.estuturno.app",
      "https://event.easuavez.com",
      "https://event-store.easuavez.com",
      "https://consumer.estuturno.app",
      "https://consumer.easuavez.com",
      "https://event-consumer.easuavez.com",
      "https://query.estuturno.app",
      "https://query.easuavez.com",
      "https://query-stack.easuavez.com",
    ],
    'prod': [
      "https://estuturno.app",
      "https://www.estuturno.app",
      "https://www.estuturno.cl",
      "https://easuavez.com",
      "https://www.easuavez.com",
      "https://publico.estuturno.app",
      "https://publico.easuavez.com",
      "https://interno.estuturno.cl",
      "https://interno.estuturno.app",
      "https://interno.easuavez.com",
      "https://app.easuavez.com",
      "https://event.estuturno.app",
      "https://event.easuavez.com",
      "https://event-store.easuavez.com",
      "https://consumer.estuturno.app",
      "https://consumer.easuavez.com",
      "https://event-consumer.easuavez.com",
      "https://query.estuturno.app",
      "https://query.easuavez.com",
      "https://query-stack.easuavez.com",
    ],
  }
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    next();
  });
  app.enableCors({
    origin: corsOriginConfig[process.env.NODE_ENV],
    methods: ['GET','PUT','PATCH','POST'],
    allowedHeaders:"*"
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new RequestInterceptor(), new TransformInterceptor())
  const server = await app.listen(process.env.PORT || 3000);
  server.setTimeout(60000);
}
bootstrap();
