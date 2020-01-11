import { Injectable } from '@nestjs/common';
import { ClassRepository } from '../repositories/class.repository';
import { ClassDetails } from '../entities/class.entity';
import { SubjectService } from '../subject/subject.service';

@Injectable()
export class ClassService {
    constructor(private readonly classRepository: ClassRepository,private subjectService: SubjectService) { }

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

    async endClass(id: string) {
        const classDetails = await this.classRepository.findOne(id);
        classDetails.endedAt = new Date();
        return await this.classRepository.save(classDetails);
    }

    async getAllClasses() {
        return await this.classRepository.find({ relations: ['teacher', 'subject'] });
    }

    async deleteClass(id: string) {
        return await this.classRepository.delete(id);
    }

    async getTotalClass() {
        return await this.classRepository.count();
    }

    async updateClass({id,name}) {
        const classDetails = await this.classRepository.findOne(id,{ relations: ['subject', 'teacher'] });
        classDetails.subject= await this.subjectService.create(name);
        return await this.classRepository.save(classDetails); 
    }
}
