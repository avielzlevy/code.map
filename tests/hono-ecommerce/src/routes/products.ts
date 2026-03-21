import { Hono } from 'hono';
import { ProductsService } from '../services/products.service';

const app = new Hono();
const productsService = new ProductsService();

app.get('/products', async (c) => c.json(await productsService.findAll()));
app.get('/products/:id', async (c) => c.json(await productsService.findById(c.req.param('id'))));
app.post('/products', async (c) => {
  const p = await productsService.create(await c.req.json());
  return c.json(p, 201);
});

export default app;
