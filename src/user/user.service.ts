import { HttpException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { StudentRepository } from '../repositories/student.repository';
import { TeacherRepository } from '../repositories/teacher.repository';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class UserService {

    constructor(
        private readonly userRepository: UserRepository,
        private readonly teacherRepository: TeacherRepository,
        private readonly studentRepository: StudentRepository,
    ) { }

    async register(user: CreateUserDto): Promise<Partial<User>> {
        const getUser = await this.userRepository.findOne({ email: user.email });

        if (getUser) {
            throw new HttpException(`User Already Exist With Email : ${user.email}`, 409);
        }

        if (user.type === 'teacher') {
            delete user.type;
            const savedTeacher = await this.teacherRepository.save(user);
            delete savedTeacher.password;
            return Promise.resolve(savedTeacher);
        }
        delete user.type;
        const savedStudent = await this.studentRepository.save(user);
        delete savedStudent.password;
        return Promise.resolve(savedStudent);

    }

    async verifyUserCredentials(loginuserDto: LoginUserDto) {
        const { username, password } = loginuserDto;
        const user = await this.userRepository.findOne({
            where: {
                email:username,
            },
            select: ['username', 'password', 'id', 'isAdmin'],
        });
        if (!user) {
            throw new HttpException('User not found', 404);
        }
        const verified = await bcrypt.compare(password, user.password);

        if (verified) {
            return user;
        } else {
            throw new HttpException('Invalid username or password', 403);
        }
    }

    async validateTeacher(id: string) {
        try {
            return await this.teacherRepository.findOneOrFail(id);
        } catch (err) {
            throw new Error('Not a user');
        }
    }

    //     async findByPayload(payload: any) {
    //         const user: User = payload.user;
    //         if (!user) {
    //             throw new HttpException(`User not found with email : ${user.email}`, 404);
    //         }
    //         return user;
    //     }

    sanitizeUser(user: User) {
        const sanitized = user;
        delete sanitized.password;
        return user;
    }

    async getAllStudents() {
        return await this.studentRepository.find({ where: { isAdmin: false } });
    }

    async getAllteachers() {
        return await this.teacherRepository.find({});
    }


    async findTeacher(id: string) {
        return await this.teacherRepository.findOne({ id });
    }

    async deleteStudent(id: string) {
        return await this.studentRepository.delete(id);
    }

    async deleteTeacher(id: string) {
        return await this.teacherRepository.delete(id);
    }

    async getTotalStudents() {
        return await this.studentRepository.count();
    }

    async getTotalTeachers() {
        return await this.teacherRepository.count();
    }
    
    async updateTeacher({ id, name, email,password }) {
        const teacher = await this.teacherRepository.findOne(id);
        if(name !=undefined  && name.length > 0) {
            teacher.name = name;
        }

        if(email !=undefined  && email.length > 0) {
            teacher.email = email;
        }

        if(password !=undefined  && password.length > 0) {
            teacher.password = password;
        }

        return await this.teacherRepository.save(teacher);
    }

    async updateStudent({ id, name, email,password }) {
        const student = await this.studentRepository.findOne(id);
        if(name !=undefined  && name.length > 0) {
            student.name = name;
        }

        if(email !=undefined  && email.length > 0) {
            student.email = email;
            student.username = email;
        }

        if(password !=undefined  && password.length > 0) {
            student.password = password;
        }

        return await this.studentRepository.save(student);
    }
}
