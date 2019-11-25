import { IsNotEmpty, IsString } from 'class-validator';

export class GetOwnerDto {

    @IsNotEmpty()
    @IsString()
    classId: string;
}
