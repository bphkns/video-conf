import { Injectable } from '@nestjs/common';
import { ClassRepository } from '../repositories/class.repository';
import { ClassDetails } from '../entities/class.entity';

@Injectable()
export class ClassService {
    constructor(private readonly classRepository: ClassRepository) { }

    async create(classDetails: Partial<ClassDetails>) {
        return await this.classRepository.save(classDetails);
    }

    async getLiveClasses() {
        return await this.classRepository.find({ where: { endedAt: null }, relations: ['teacher', 'subject'] });
    }

    async getOwner(id: string) {
        const classDetails = await this.classRepository.findOne(id, { relations: ['teacher', 'subject'] });
        return classDetails.teacher;
    }

    async getClassDetails(id: string) {
        return await this.classRepository.findOne(id, { relations: ['teacher', 'subject'] });
    }
}
