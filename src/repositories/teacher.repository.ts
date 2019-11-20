import { EntityRepository, Repository } from 'typeorm';
import { Teacher } from '../entities/teacher.entity';

@EntityRepository(Teacher)
export class TeacherRepository extends Repository<Teacher> {
}
