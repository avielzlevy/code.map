import { Router } from 'express';
import { ProductsService } from './products.service';

const router = Router();
const productsService = new ProductsService();

router.get('/', async (req, res) => {
  const products = await productsService.findAll(req.query.search as string);
  res.json(products);
});

router.get('/:id', async (req, res) => {
  const product = await productsService.findById(req.params.id);
  res.json(product);
});

router.post('/', async (req, res) => {
  const product = await productsService.create(req.body);
  res.status(201).json(product);
});

export default router;
