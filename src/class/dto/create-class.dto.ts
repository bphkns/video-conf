import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateClassDto {

    @IsNotEmpty()
    @IsString()
    subject: string;

    @IsNotEmpty()
    @IsUUID()
    teacher: string;

}
