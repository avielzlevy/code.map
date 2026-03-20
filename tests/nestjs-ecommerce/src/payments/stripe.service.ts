import { Injectable } from '@nestjs/common';

@Injectable()
export class StripeService {
  async createPaymentIntent() {
    return { id: 'pi_xxx', clientSecret: 'pi_xxx_secret_xxx', status: 'requires_payment_method' };
  }

  async confirmPaymentIntent() {
    return { id: 'pi_xxx', status: 'succeeded' };
  }

  async createRefund() {
    return { id: 're_xxx', amount: 0, status: 'succeeded' };
  }

  async verifyWebhookSignature() {
    return { type: 'payment_intent.succeeded', data: {} };
  }

  async listPaymentMethods() {
    return [];
  }
}
