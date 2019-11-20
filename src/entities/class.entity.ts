import { Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { Teacher } from './teacher.entity';
import { Subject } from './subject.entity';

@Entity()
export class ClassDetails {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(type => Teacher, teacher => teacher.classes)
    teacher: Teacher;

    @OneToOne(type => Subject)
    @JoinColumn()
    subject: Subject;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt: Date;
}
