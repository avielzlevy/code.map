import { Controller, Get, Post, Put, Delete } from '@nestjs/common';
import { FlowStep } from '@code-map/nestjs';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Registers a new user account and sends a welcome email.
   */
  @Post('register')
  @FlowStep('Register new user: hash password and send welcome email')
  async register() {
    return this.usersService.register();
  }

  @Post('login')
  @FlowStep('Authenticate credentials and issue JWT token')
  async login() {
    return this.usersService.login();
  }

  @Post('logout')
  async logout() {
    return this.usersService.logout();
  }

  @Get('me')
  @FlowStep('Fetch authenticated user profile')
  async getProfile() {
    return this.usersService.getProfile();
  }

  @Put('me')
  async updateProfile() {
    return this.usersService.updateProfile();
  }

  @Delete('me')
  @FlowStep('Deactivate account and revoke all active sessions')
  async deactivate() {
    return this.usersService.deactivate();
  }

  @Post('me/change-password')
  @FlowStep('Validate old password and set new hashed password')
  async changePassword() {
    return this.usersService.changePassword();
  }
}
