import { Controller, UseGuards, Post, Body, Req, Get, Param } from '@nestjs/common';
import { ClassService } from './class.service';
import { AuthGuard } from '@nestjs/passport';
import { TeacherGuard } from '../shared/auth/teacher.guard';
import { CreateClassDto } from './dto/create-class.dto';
import { SubjectService } from '../subject/subject.service';
import { Teacher } from '../entities/teacher.entity';
import request = require('superagent');

@Controller('classes')
@UseGuards(AuthGuard('jwt'))
export class ClassController {
    constructor(private classService: ClassService, private subjectService: SubjectService) { }

    @Post('create')
    @UseGuards(TeacherGuard)
    async createClass(@Req() req, @Body() createClassDto: CreateClassDto) {
        const subject = await this.subjectService.create(createClassDto.subject);
        const teacher: Teacher = req.user;
        return await this.classService.create({ subject, teacher });
    }

    @Get()
    async getClasses() {
        return await this.classService.getLiveClasses();
    }

    @Get(':id')
    async getClassDetails(@Param() id:string){
        return await this.classService.getClassDetails(id);
    }

}
