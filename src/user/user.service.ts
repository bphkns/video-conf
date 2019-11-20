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
                username,
            },
            select: ['username', 'password', 'id'],
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

    //     async findById(id: string) {
    //         const user = await this.userRepository.findOne({ id });
    //         if (!user) {
    //             throw new HttpException(`User not found with Id : ${id}`, 404);
    //         }
    //         return user;
    //     }

    //     async findByEmail(email: string) {
    //         const user = await this.userRepository.findOne({ email });
    //         if (!user) {
    //             throw new HttpException(`User not found with Email : ${email}`, 404);
    //         }
    //         return user;
    //     }

    //     async sendMail(user: Partial<User>) {
    //         const msg = {
    //             to: user.email,
    //             from: 'test@example.com',
    //             subject: 'Sending with SendGrid is Fun',
    //             text: 'and easy to do anywhere, even with Node.js',
    //             html: 'and easy to do anywhere, even with Node.js',
    //         };

    //         sgMail.send(msg);
    //     }

    //     async verifyEmail(emailVerifyDto: EmailVerifyDto) {
    //         const user = await this.findByEmail(emailVerifyDto.email);
    //         if (!user || emailVerifyDto.key !== user.key) {
    //             return false;
    //         }
    //         user.active = true;
    //         user.expiresAt = new Date();
    //         user.key = null;
    //         await this.userRepository.save(user);
    //         return true;
    //     }

    //     async update(user: User) {
    //         return await this.userRepository.save(user);
    //     }
}
