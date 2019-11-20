import { Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Subject {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt: Date;
}
