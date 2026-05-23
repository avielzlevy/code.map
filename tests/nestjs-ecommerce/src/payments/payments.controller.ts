import { Controller, Post, Get } from '@nestjs/common';
import { Dot } from '@code-map/nestjs';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Creates a Stripe payment intent for the order amount.
   */
  @Post('intent')
  @Dot('Create payment intent and return client secret')
  async createIntent() {
    return this.paymentsService.createIntent();
  }

  @Post('confirm')
  @Dot('Confirm payment and mark order as paid')
  async confirmPayment() {
    return this.paymentsService.confirmPayment();
  }

  @Post('refund')
  @Dot('Process full or partial refund for cancelled order')
  async processRefund() {
    return this.paymentsService.processRefund();
  }

  @Post('webhook')
  @Dot('Handle Stripe webhook: verify signature and dispatch event')
  async handleWebhook() {
    return this.paymentsService.handleWebhook();
  }

  @Get('methods')
  async getSavedMethods() {
    return this.paymentsService.getSavedPaymentMethods();
  }
}
