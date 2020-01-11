import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {

    constructor(private userService: UserService) { }

    @Post()
    async register(@Body() createUserDto: CreateUserDto) {
        return await this.userService.register(createUserDto);
    }

    @Get('all-students')
    @UseGuards(AuthGuard('jwt'))
    async getAllStudents() {
        return await this.userService.getAllStudents();
    }

    @Get('teachers')
    @UseGuards(AuthGuard('jwt'))
    async getAllTeachers() {
        return await this.userService.getAllteachers();
    }

    @Post('students/delete')
    @UseGuards(AuthGuard('jwt'))
    async deleteStudent(@Body() deletUserDto: DeleteUserDto) {
        return await this.userService.deleteStudent(deletUserDto.id);
    }

    @Post('teachers/delete')
    @UseGuards(AuthGuard('jwt'))
    async deleteTeacher(@Body() deletUserDto: DeleteUserDto) {
        return await this.userService.deleteTeacher(deletUserDto.id);
    }

    @Post('update/student')
    @UseGuards(AuthGuard('jwt'))
    async updateStudent(@Body() data:any){
        const { id,user } = data;
        const { name,email,password } =user;

        return await this.userService.updateStudent({id,name,email,password});
    }

    @Post('update/teacher')
    @UseGuards(AuthGuard('jwt'))
    async updateTEACHER(@Body() data:any){
        const { id,user } = data;
        const { name,email,password } =user;

        return await this.userService.updateTeacher({id,name,email,password});
    }

}
