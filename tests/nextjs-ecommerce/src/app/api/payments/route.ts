import { FlowStep } from '@code-map/nextjs';
import { PaymentService } from '../../../services/payment.service';

const paymentService = new PaymentService();

export async function GET() {
  const methods = await paymentService.getSavedPaymentMethods();
  return Response.json({ data: methods });
}
