import { Entity, TableInheritance, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class User {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: false })
    @Index({ unique: true })
    username: string;

    @Column({ nullable: false, select: false })
    password: string;

    @Column({ nullable: false, unique: true })
    email: string;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt: Date;
}
