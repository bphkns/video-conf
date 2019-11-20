
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class TeacherGuard implements CanActivate {

    constructor(private authService: AuthService) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = await request.user;
        if (!user) {
            return Promise.resolve(false);
        }
        const teacher = await this.authService.isTeacher(user.id);
        if (!teacher.isActive) {
            return Promise.resolve(false);
        }

        return Promise.resolve(true);
    }
}
