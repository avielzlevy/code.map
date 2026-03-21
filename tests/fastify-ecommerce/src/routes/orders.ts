import { FastifyInstance } from 'fastify';
import { OrdersService } from '../services/orders.service';

const ordersService = new OrdersService();

/** Orders plugin — registers all order routes on the Fastify instance. */
export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.get('/orders', async (request, reply) => {
    return ordersService.findAll('user_1');
  });

  fastify.get('/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return ordersService.findById(id);
  });

  fastify.post('/orders', async (request, reply) => {
    const order = await ordersService.create(request.body, 'user_1');
    reply.status(201).send(order);
  });

  fastify.put('/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return ordersService.update(id, request.body);
  });

  fastify.delete('/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await ordersService.cancel(id);
    reply.status(204).send();
  });
}
