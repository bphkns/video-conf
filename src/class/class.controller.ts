import { Controller, UseGuards, Post, Body } from '@nestjs/common';
import { ClassService } from './class.service';
import { AuthGuard } from '@nestjs/passport';
import { TeacherGuard } from '../shared/auth/teacher.guard';
import { CreateClassDto } from './dto/create-class.dto';

@Controller('classes')
@UseGuards(AuthGuard('jwt'))
export class ClassController {
    constructor(private classService: ClassService) { }

    @Post()
    @UseGuards(TeacherGuard)
    async createClass(@Body() createClassDto: CreateClassDto) {
        return await this.classService.createClass(createClassDto);
    }
}
