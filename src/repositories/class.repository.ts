import { EntityRepository, Repository } from 'typeorm';
import { ClassDetails } from '../entities/class.entity';

@EntityRepository(ClassDetails)
export class ClassRepository extends Repository<ClassDetails> {
}
