import { IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteClassDto {
        @IsNotEmpty()
        @IsUUID()
        id:string;
}