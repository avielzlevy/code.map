import { FlowStep } from '@code-map/nextjs';
import { PaymentService } from '../../../../services/payment.service';

const paymentService = new PaymentService();

/**
 * Creates a Stripe payment intent for the order amount.
 */
@FlowStep('Create payment intent and return client secret to frontend')
export async function POST() {
  const intent = await paymentService.createIntent();
  return Response.json({ data: intent }, { status: 201 });
}
