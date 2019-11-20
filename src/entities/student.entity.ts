import { Entity, ChildEntity } from 'typeorm';
import { User } from './user.entity';

@ChildEntity()
export class Student extends User {

}
