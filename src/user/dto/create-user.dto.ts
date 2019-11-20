import { IsAlphanumeric, IsEmail, IsNotEmpty, MaxLength, MinLength, IsString } from 'class-validator';

export class CreateUserDto {

    @IsNotEmpty()
    @MinLength(6)
    @MaxLength(20)
    password: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    type: string;
}
