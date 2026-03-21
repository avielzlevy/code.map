import { FlowStep } from '../../../backend/packages/nestjs/src/decorators';
import { EmailService } from '../shared/email.service';

export class OrdersService {
  private readonly emailService = new EmailService();

  /** Returns paginated orders for a user. */
  @FlowStep('Fetch and paginate user orders')
  async findAll(userId: string): Promise<unknown[]> {
    return [];
  }

  async findById(orderId: string): Promise<unknown> {
    return { id: orderId };
  }

  @FlowStep('Create order and reserve inventory')
  async create(data: unknown, userId: string): Promise<unknown> {
    const order = { id: 'ord_1', userId, ...data as object };
    await this.emailService.sendOrderConfirmation('ord_1', 'user@example.com');
    return order;
  }

  async update(orderId: string, data: unknown): Promise<unknown> {
    return { id: orderId, ...data as object };
  }

  @FlowStep('Cancel order and release inventory')
  async cancel(orderId: string): Promise<void> {
    await this.emailService.send('user@example.com', 'Order cancelled', `Order ${orderId} cancelled`);
  }
}
