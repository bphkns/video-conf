import { Module } from '@nestjs/common';
import { UserModule } from '../../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { TeacherGuard } from './teacher.guard';

@Module({
    imports: [
        UserModule,
        PassportModule,
        JwtModule.register({
            secret: 'thisIsASuperSecret09876123456',
            signOptions: {
                expiresIn: '30 days',
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, LocalStrategy, JwtStrategy, TeacherGuard],
})
export class AuthModule { }
