import { FlowStep } from '@code-map/nextjs';
import { OrderService } from '../../../services/order.service';
import { InventoryService } from '../../../services/inventory.service';

const orderService = new OrderService();
const inventoryService = new InventoryService();

/**
 * Returns a paginated list of orders for the authenticated user.
 */
@FlowStep('List all orders with filters and pagination')
export async function GET() {
  const orders = await orderService.findAll();
  const stock = await inventoryService.checkStock();
  return Response.json({ data: { orders, stock } });
}

@FlowStep('Create a new order and reserve inventory')
export async function POST() {
  const order = await orderService.create();
  return Response.json({ data: order }, { status: 201 });
}
