import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { SharedModule } from './shared/shared.module';
import { ClassModule } from './class/class.module';

@Module({
  imports: [TypeOrmModule.forRoot(), UserModule, SharedModule, ClassModule],
  controllers: [AppController],
})
export class AppModule { }
