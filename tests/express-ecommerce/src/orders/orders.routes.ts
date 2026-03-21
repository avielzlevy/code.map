import { Router } from 'express';
import { OrdersService } from './orders.service';

const router = Router();
const ordersService = new OrdersService();

/** List all orders for the authenticated user. */
router.get('/', async (req, res) => {
  const orders = await ordersService.findAll('user_1');
  res.json(orders);
});

router.get('/:id', async (req, res) => {
  const order = await ordersService.findById(req.params.id);
  res.json(order);
});

router.post('/', async (req, res) => {
  const order = await ordersService.create(req.body, 'user_1');
  res.status(201).json(order);
});

router.put('/:id', async (req, res) => {
  const order = await ordersService.update(req.params.id, req.body);
  res.json(order);
});

router.delete('/:id', async (req, res) => {
  await ordersService.cancel(req.params.id);
  res.status(204).send();
});

export default router;
