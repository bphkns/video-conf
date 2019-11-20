import { EntityRepository, Repository } from 'typeorm';
import { ClassDetails } from '../entities/class.entity';
import { Subject } from './../entities/subject.entity';

@EntityRepository(Subject)
export class SubjectRepository extends Repository<Subject> {
}
