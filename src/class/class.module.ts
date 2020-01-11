import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassRepository } from '../repositories/class.repository';
import { SubjectModule } from '../subject/subject.module';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { AuthModule } from '../shared/auth/auth.module';
import { ClassGateway } from './gateways/class.gateway';
import { UserModule } from '../user/user.module';

@Module({
    imports: [TypeOrmModule.forFeature([ClassRepository]), SubjectModule, AuthModule, UserModule],
    controllers: [ClassController],
    providers: [ClassService],
    exports: [ClassService],
})
export class ClassModule { }
