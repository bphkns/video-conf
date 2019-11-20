import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FilterModule } from './filter/filter.module';
import { InterceptorModule } from './interceptor/interceptor.module';

@Module({
  imports: [AuthModule, FilterModule, InterceptorModule],
})
export class SharedModule {}
