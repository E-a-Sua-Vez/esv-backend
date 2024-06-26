import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './model/user.entity';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getUserById(@Param() params: any): Promise<User> {
        const { id } = params;
        return this.userService.getUserById(id);
    }

    //@UseGuards(AuthGuard)
    @Get('/')
    public async getUsers(): Promise<User[]> {
        return this.userService.getUsers();
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createUser(@Body() body: any): Promise<User> {
        const { name, phone, email, commerceId, queueId, personalInfo, acceptTermsAndConditions } = body;
        return this.userService.createUser(name, phone, email, commerceId, queueId, personalInfo, undefined, acceptTermsAndConditions);
    }
}