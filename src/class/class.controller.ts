import { Controller, UseGuards, Post, Body, Req, Get, Param } from '@nestjs/common';
import { ClassService } from './class.service';
import { AuthGuard } from '@nestjs/passport';
import { TeacherGuard } from '../shared/auth/teacher.guard';
import { CreateClassDto } from './dto/create-class.dto';
import { SubjectService } from '../subject/subject.service';
import { Teacher } from '../entities/teacher.entity';
import request = require('superagent');
import { EndClassDto } from './dto/end-class.dto';
import { UserService } from '../user/user.service';
import { DeleteClassDto } from './dto/delete-class.dto';

@Controller('classes')
@UseGuards(AuthGuard('jwt'))
export class ClassController {
    constructor(private classService: ClassService, private subjectService: SubjectService, private userService: UserService) { }

    @Post('create')
    async createClass(@Req() req, @Body() createClassDto: CreateClassDto) {
        const subject = await this.subjectService.create(createClassDto.subject);
        const teacher: Teacher = await this.userService.findTeacher(createClassDto.teacher);
        return await this.classService.create({ subject, teacher });
    }

    @Get()
    async getClasses() {
        return await this.classService.getLiveClasses();
    }

    @Get('all-classes')
    async allClasses() {
        return await this.classService.getAllClasses();
    }

    @Get(':id')
    async getClassDetails(@Param() id: string) {
        return await this.classService.getClassDetails(id);
    }

    @Post('end-class')
    async endClass(@Body() endClassDto: EndClassDto) {
        return await this.classService.endClass(endClassDto.classId);
    }

    @Post('delete')
    async deleteClass(@Body() deleteClassDto: DeleteClassDto) {
        return await this.classService.deleteClass(deleteClassDto.id);
    }

    @Post('update')
    async updateClass(@Body() { id,name }) {
        return await this.classService.updateClass({id,name});
    }

}
