import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './model/user.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User as UserDecorator } from 'src/auth/user.decorator';

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
        const {name, phone, email, commerceId, queueId, personalInfo } = body;
        return this.userService.createUser(name, phone, email, commerceId, queueId, personalInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('contact/:id')
    public async contactUser(@UserDecorator() user, @Param() params: any): Promise<User> {
        const { id } = params;
        return this.userService.contactUser(user, id);
    }
}