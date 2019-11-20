import { Controller, Get, Post, UsePipes, Body, BadRequestException, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';
import { Request, Response } from 'express';

@Controller('users')
export class UserController {

    constructor(private userService: UserService) { }

    @Post()
    async register(@Body() createUserDto: CreateUserDto) {
        return await this.userService.register(createUserDto);
    }
}
