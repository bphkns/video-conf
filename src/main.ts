import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync('./../../certs/bikash-phukan.codes.key'),
  cert: fs.readFileSync('./../../certs/bikash-phukan.codes.pem'),
  ca: fs.readFileSync('./../../certs/bikash-phukan.codes.ca.pem')
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { httpsOptions, logger: console });
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
bootstrap();
