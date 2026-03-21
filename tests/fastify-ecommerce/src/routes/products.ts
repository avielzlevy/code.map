import { FastifyInstance } from 'fastify';
import { ProductsService } from '../services/products.service';

const productsService = new ProductsService();

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get('/products', async () => productsService.findAll());
  fastify.get('/products/:id', async (request) => {
    const { id } = request.params as { id: string };
    return productsService.findById(id);
  });
  fastify.post('/products', async (request, reply) => {
    const p = await productsService.create(request.body);
    reply.status(201).send(p);
  });
}
