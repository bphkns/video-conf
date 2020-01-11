import { IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteUserDto {
    @IsNotEmpty()
    @IsUUID()
    id: string;
}