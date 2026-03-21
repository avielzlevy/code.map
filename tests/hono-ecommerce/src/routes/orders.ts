import { Hono } from 'hono';
import { OrdersService } from '../services/orders.service';

const app = new Hono();
const ordersService = new OrdersService();

app.get('/orders', async (c) => {
  const orders = await ordersService.findAll('user_1');
  return c.json(orders);
});

app.get('/orders/:id', async (c) => {
  const order = await ordersService.findById(c.req.param('id'));
  return c.json(order);
});

app.post('/orders', async (c) => {
  const body = await c.req.json();
  const order = await ordersService.create(body, 'user_1');
  return c.json(order, 201);
});

app.put('/orders/:id', async (c) => {
  const body = await c.req.json();
  const order = await ordersService.update(c.req.param('id'), body);
  return c.json(order);
});

app.delete('/orders/:id', async (c) => {
  await ordersService.cancel(c.req.param('id'));
  return c.body(null, 204);
});

export default app;
