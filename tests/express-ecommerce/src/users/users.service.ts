import { FlowStep } from '../../../backend/packages/nestjs/src/decorators';
import { EmailService } from '../shared/email.service';

export class UsersService {
  private readonly emailService = new EmailService();

  @FlowStep('Register user and send welcome email')
  async create(data: unknown): Promise<unknown> {
    const user = { id: 'usr_1', ...data as object };
    await this.emailService.send('user@example.com', 'Welcome!', 'Thanks for joining');
    return user;
  }

  async findById(userId: string): Promise<unknown> {
    return { id: userId };
  }

  async update(userId: string, data: unknown): Promise<unknown> {
    return { id: userId, ...data as object };
  }
}
