import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectRepository } from '../repositories/subject.repository';
import { SubjectService } from './subject.service';

@Module({
    imports: [TypeOrmModule.forFeature([SubjectRepository])],
    providers: [SubjectService],
    exports: [SubjectService],
})
export class SubjectModule { }
