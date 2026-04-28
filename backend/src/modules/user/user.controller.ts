import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<unknown>> {
    const user = await this.userService.createUser(dto);
    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  @Get()
  async list(@Query() query: ListUsersQueryDto): Promise<ApiResponse<unknown>> {
    const result = await this.userService.listUsers(query);
    return {
      success: true,
      message: 'Users fetched successfully',
      data: result,
    };
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const user = await this.userService.getUserById(id);
    return {
      success: true,
      message: 'User fetched successfully',
      data: user,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<ApiResponse<unknown>> {
    const user = await this.userService.updateUser(id, dto);
    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.userService.deleteUser(id);
    return {
      success: true,
      message: 'User deleted successfully',
      data: result,
    };
  }
}
