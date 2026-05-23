import { Controller, Get, Post, Put, Delete } from '@nestjs/common';
import { Dot } from '@code-map/nestjs';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Registers a new user account and sends a welcome email.
   */
  @Post('register')
  @Dot('Register new user: hash password and send welcome email')
  async register() {
    return this.usersService.register();
  }

  @Post('login')
  @Dot('Authenticate credentials and issue JWT token')
  async login() {
    return this.usersService.login();
  }

  @Post('logout')
  async logout() {
    return this.usersService.logout();
  }

  @Get('me')
  @Dot('Fetch authenticated user profile')
  async getProfile() {
    return this.usersService.getProfile();
  }

  @Put('me')
  async updateProfile() {
    return this.usersService.updateProfile();
  }

  @Delete('me')
  @Dot('Deactivate account and revoke all active sessions')
  async deactivate() {
    return this.usersService.deactivate();
  }

  @Post('me/change-password')
  @Dot('Validate old password and set new hashed password')
  async changePassword() {
    return this.usersService.changePassword();
  }
}
