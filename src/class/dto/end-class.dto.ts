import { IsNotEmpty, IsString } from "class-validator";

export class EndClassDto { 
    @IsNotEmpty()
    @IsString()
    classId: string;
}