import { FlowStep } from '@code-map/nextjs';
import { OrderService } from '../../../../../services/order.service';

const orderService = new OrderService();

/**
 * Initiates the checkout flow — charges the customer and confirms inventory deduction.
 */
@FlowStep('Initiate checkout: charge payment and confirm stock deduction')
export async function POST() {
  const result = await orderService.checkout();
  return Response.json({ data: result });
}
