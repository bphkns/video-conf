import { Controller, UseGuards, Post, Request, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './../user/user.service';
import { ClassService } from './../class/class.service';

@Controller('stastics')
@UseGuards(AuthGuard('jwt'))
export class StasticsController {

    constructor(private userService: UserService, private classService: ClassService) { }

    @Get()
    async get() {
        const classes = await this.classService.getTotalClass();
        const students = await this.userService.getTotalStudents();
        const teachers = await this.userService.getTotalTeachers();

        return {
            classes, teachers, students
        }
    }
}