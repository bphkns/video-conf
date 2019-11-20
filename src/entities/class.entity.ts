import { Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, OneToOne, ManyToOne, JoinColumn, Column } from 'typeorm';
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

    @Column({ type: 'timestamp', default: null })
    endedAt: Date;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt: Date;
}
