import { Module } from '@nestjs/common';
import { ClassGateway } from './class.gateway';
import { ClassModule } from '../class.module';

@Module({
    imports: [ClassModule],
    providers: [ClassGateway],
})
export class SocketsModule { }
