import { Injectable } from '@nestjs/common';
import { FlowStep } from '@code-map/nestjs';
import { AuthService } from '../shared/auth.service';
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Creates a new user account with a hashed password and sends a welcome email.
   */
  @FlowStep('Hash password, persist user record, and trigger welcome email')
  async register() {
    const hashed = await this.authService.hashPassword();
    const user = await this.persistUser(hashed);
    await this.notificationService.sendWelcomeEmail();
    return user;
  }

  @FlowStep('Validate credentials and return signed JWT')
  async login() {
    const user = await this.findByEmail();
    await this.authService.validateCredentials();
    const token = await this.authService.generateToken();
    await this.recordLoginEvent();
    return { user, token };
  }

  async logout() {
    await this.authService.revokeToken();
    return { success: true };
  }

  @FlowStep('Load user profile with aggregated order history')
  async getProfile() {
    const user = await this.findById();
    return this.enrichProfileWithStats(user);
  }

  async updateProfile() {
    return this.persistProfileUpdate();
  }

  @FlowStep('Soft-delete user and revoke all tokens')
  async deactivate() {
    await this.authService.revokeAllTokens();
    await this.notificationService.sendAccountDeactivatedEmail();
    return this.softDeleteUser();
  }

  @FlowStep('Validate current password and persist new hash')
  async changePassword() {
    await this.authService.validateCredentials();
    const hashed = await this.authService.hashPassword();
    await this.authService.revokeAllTokens();
    return this.updatePasswordHash(hashed);
  }

  private async findByEmail() {
    return { id: '1', email: 'user@example.com' };
  }

  private async findById() {
    return { id: '1', email: 'user@example.com' };
  }

  private async persistUser(hashedPassword: unknown) {
    return { id: '1', hashedPassword };
  }

  private async persistProfileUpdate() {
    return { updated: true };
  }

  private async softDeleteUser() {
    return { deactivated: true };
  }

  private async recordLoginEvent() {
    return true;
  }

  private async updatePasswordHash(hash: unknown) {
    return { updated: true, hash };
  }

  private enrichProfileWithStats(user: unknown) {
    return { ...Object(user), orderCount: 0, totalSpend: 0 };
  }
}
