import { FlowStep } from '@code-map/nextjs';
import { PaymentService } from '../../../../services/payment.service';

const paymentService = new PaymentService();

@FlowStep('Handle Stripe webhook: verify signature and dispatch event')
export async function POST() {
  const result = await paymentService.handleWebhook();
  return Response.json({ data: result });
}
