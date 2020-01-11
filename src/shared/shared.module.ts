import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FilterModule } from './filter/filter.module';
import { InterceptorModule } from './interceptor/interceptor.module';
import { UserModule } from '../user/user.module';
import { ClassModule } from '../class/class.module';
import { StasticsController } from './stastics.controller';

@Module({
  imports: [AuthModule, FilterModule, InterceptorModule, UserModule,ClassModule],
  controllers: [StasticsController]
})
export class SharedModule {}
