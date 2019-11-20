import { Injectable } from '@nestjs/common';
import { SubjectRepository } from '../repositories/subject.repository';

@Injectable()
export class SubjectService {
    constructor(private subjectRepository: SubjectRepository) {
    }

    create(name: string) {
        return this.subjectRepository.save({ name });
    }
}
