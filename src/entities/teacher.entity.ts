import { Entity, ChildEntity, OneToMany, Column } from 'typeorm';
import { User } from './user.entity';
import { ClassDetails } from './class.entity';

@ChildEntity()
export class Teacher extends User {

    @Column({ nullable: false, default: false })
    isActive: boolean;

    @OneToMany(type => ClassDetails, classDetail => classDetail.teacher)
    classes: ClassDetails[];
}
