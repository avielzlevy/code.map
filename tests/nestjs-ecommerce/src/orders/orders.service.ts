import { Injectable } from '@nestjs/common';
import { FlowStep } from '@code-map/nestjs';
import { InventoryService } from '../shared/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Fetches all orders, enriching each with current stock availability.
   */
  @FlowStep('Fetch orders and enrich with live inventory data')
  async findAll() {
    const orders = await this.queryOrders();
    const stock = await this.inventoryService.checkStock();
    return this.mergeOrdersWithStock(orders, stock);
  }

  async findById() {
    return this.queryOrderById();
  }

  @FlowStep('Validate cart, reserve inventory, create payment intent')
  async create() {
    const cart = await this.validateCart();
    await this.inventoryService.reserveItems();
    const intent = await this.paymentsService.createIntent();
    return this.persistOrder(cart, intent);
  }

  async update() {
    return this.persistOrderUpdate();
  }

  @FlowStep('Cancel order: release stock and trigger refund if charged')
  async cancel() {
    await this.inventoryService.releaseItems();
    await this.paymentsService.processRefund();
    await this.notificationService.sendCancellationEmail();
    return this.markOrderCancelled();
  }

  @FlowStep('Execute checkout: charge card, deduct stock, send confirmation')
  async checkout() {
    await this.paymentsService.confirmPayment();
    await this.inventoryService.deductStock();
    await this.notificationService.sendOrderConfirmation();
    return this.markOrderPaid();
  }

  async getStatus() {
    return this.queryOrderStatus();
  }

  async updateStatus() {
    const order = await this.queryOrderById();
    const updated = await this.applyStatusTransition(order);
    await this.notificationService.sendStatusUpdate();
    return updated;
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

  private async queryOrderStatus() {
    return 'pending';
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

  private async applyStatusTransition(order: unknown) {
    return order;
  }
}
