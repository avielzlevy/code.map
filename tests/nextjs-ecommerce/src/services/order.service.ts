import { FlowStep } from '@code-map/nextjs';
import { InventoryService } from './inventory.service';
import { PaymentService } from './payment.service';
import { NotificationService } from './notification.service';

export class OrderService {
  private readonly inventory = new InventoryService();
  private readonly payments = new PaymentService();
  private readonly notifications = new NotificationService();

  /**
   * Fetches all orders, enriching each with current stock availability.
   */
  @FlowStep('Fetch orders and enrich with live inventory data')
  async findAll() {
    const orders = await this.queryOrders();
    const stock = await this.inventory.checkStock();
    return this.mergeOrdersWithStock(orders, stock);
  }

  async findById() {
    return this.queryOrderById();
  }

  @FlowStep('Validate cart, reserve inventory, create payment intent')
  async create() {
    const cart = await this.validateCart();
    await this.inventory.reserveItems();
    const intent = await this.payments.createIntent();
    return this.persistOrder(cart, intent);
  }

  async update() {
    return this.persistOrderUpdate();
  }

  @FlowStep('Cancel order: release stock and trigger refund')
  async cancel() {
    await this.inventory.releaseItems();
    await this.payments.processRefund();
    await this.notifications.sendCancellationEmail();
    return this.markOrderCancelled();
  }

  @FlowStep('Execute checkout: charge card, deduct stock, send confirmation')
  async checkout() {
    await this.payments.confirmPayment();
    await this.inventory.deductStock();
    await this.notifications.sendOrderConfirmation();
    return this.markOrderPaid();
  }

  private async validateCart() {
    return { items: [], total: 0 };
  }

  private async queryOrders() {
    return [];
  }

  private async queryOrderById() {
    return { id: '1', status: 'pending' };
  }

  private async persistOrder(cart: unknown, intent: unknown) {
    return { id: '1', cart, intent };
  }

  private async persistOrderUpdate() {
    return { updated: true };
  }

  private async markOrderCancelled() {
    return { status: 'cancelled' };
  }

  private async markOrderPaid() {
    return { status: 'paid' };
  }

  private mergeOrdersWithStock(orders: unknown[], stock: unknown) {
    return { orders, stock };
  }
}
