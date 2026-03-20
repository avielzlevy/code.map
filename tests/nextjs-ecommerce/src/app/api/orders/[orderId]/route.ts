import { FlowStep } from '@code-map/nextjs';
import { OrderService } from '../../../../services/order.service';

const orderService = new OrderService();

export async function GET() {
  const order = await orderService.findById();
  return Response.json({ data: order });
}

export async function PUT() {
  const order = await orderService.update();
  return Response.json({ data: order });
}

@FlowStep('Cancel order and release reserved inventory')
export async function DELETE() {
  const result = await orderService.cancel();
  return Response.json({ data: result });
}
