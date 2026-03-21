import { FastifyInstance } from 'fastify';
import { UsersService } from '../services/users.service';

const usersService = new UsersService();

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.post('/users', async (request, reply) => {
    const user = await usersService.create(request.body);
    reply.status(201).send(user);
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return usersService.findById(id);
  });

  fastify.put('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return usersService.update(id, request.body);
  });
}
