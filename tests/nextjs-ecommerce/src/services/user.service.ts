import { FlowStep } from '@code-map/nextjs';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

export class UserService {
  private readonly auth = new AuthService();
  private readonly notifications = new NotificationService();

  /**
   * Creates a new user account with a hashed password and sends a welcome email.
   */
  @FlowStep('Hash password, persist user record, trigger welcome email')
  async register() {
    const hashed = await this.auth.hashPassword();
    const user = await this.persistUser(hashed);
    await this.notifications.sendWelcomeEmail();
    return user;
  }

  @FlowStep('Validate credentials and return signed JWT')
  async login() {
    const user = await this.findByEmail();
    await this.auth.validateCredentials();
    const token = await this.auth.generateToken();
    return { user, token };
  }

  @FlowStep('Load user profile with aggregated order history')
  async getProfile() {
    const user = await this.findById();
    return this.enrichProfileWithStats(user);
  }

  async updateProfile() {
    return this.persistProfileUpdate();
  }

  @FlowStep('Soft-delete user and revoke all active tokens')
  async deactivate() {
    await this.auth.revokeAllTokens();
    await this.notifications.sendAccountDeactivatedEmail();
    return this.softDeleteUser();
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

  private enrichProfileWithStats(user: unknown) {
    return { ...Object(user), orderCount: 0, totalSpend: 0 };
  }
}
