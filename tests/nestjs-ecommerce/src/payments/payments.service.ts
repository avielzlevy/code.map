import { Injectable } from '@nestjs/common';
import { FlowStep } from '@code-map/nestjs';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * Creates a Stripe PaymentIntent for the given order total.
   */
  @FlowStep('Call Stripe API to create PaymentIntent with idempotency key')
  async createIntent() {
    const intent = await this.stripeService.createPaymentIntent();
    await this.persistPaymentRecord(intent);
    return this.formatIntentResponse(intent);
  }

  @FlowStep('Confirm payment with Stripe and update order status')
  async confirmPayment() {
    const result = await this.stripeService.confirmPaymentIntent();
    await this.updatePaymentStatus(result);
    return result;
  }

  @FlowStep('Initiate Stripe refund and record refund event')
  async processRefund() {
    const refund = await this.stripeService.createRefund();
    await this.persistRefundRecord(refund);
    return refund;
  }

  @FlowStep('Verify Stripe webhook signature and route to handler')
  async handleWebhook() {
    const event = await this.stripeService.verifyWebhookSignature();
    return this.dispatchWebhookEvent(event);
  }

  async getSavedPaymentMethods() {
    return this.stripeService.listPaymentMethods();
  }

  private async persistPaymentRecord(intent: unknown) {
    return { id: '1', intent };
  }

  private async persistRefundRecord(refund: unknown) {
    return { id: '1', refund };
  }

  private async updatePaymentStatus(result: unknown) {
    return result;
  }

  private formatIntentResponse(intent: unknown) {
    return { clientSecret: 'sk_test_xxx', intent };
  }

  private async dispatchWebhookEvent(event: unknown) {
    return event;
  }
}
