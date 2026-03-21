import { Hono } from 'hono';
import { UsersService } from '../services/users.service';

const app = new Hono();
const usersService = new UsersService();

app.post('/users', async (c) => {
  const body = await c.req.json();
  const user = await usersService.create(body);
  return c.json(user, 201);
});

app.get('/users/:id', async (c) => {
  const user = await usersService.findById(c.req.param('id'));
  return c.json(user);
});

app.put('/users/:id', async (c) => {
  const body = await c.req.json();
  const user = await usersService.update(c.req.param('id'), body);
  return c.json(user);
});

export default app;
