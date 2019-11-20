import { Controller, UseGuards, Post, Request, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { TeacherGuard } from './teacher.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @UseGuards(AuthGuard('local'))
    @Post('login')
    async login(@Request() req) {
        return this.authService.login(req.user);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('is-teacher')
    async isTeacher(@Request() req) {
        const user = req.user;
        try {
            const teacher = await this.authService.isTeacher(user.id);
            if (!teacher.isActive) {
                throw new Error('Your teacher account is not verified.');
            }
            return;
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.UNAUTHORIZED);
        }
    }

    @Get('test')
    @UseGuards(AuthGuard('jwt'), TeacherGuard)
    async test(@Request() req) {
        return req.user;
    }

}
