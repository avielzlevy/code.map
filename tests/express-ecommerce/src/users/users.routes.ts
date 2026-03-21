import { Router } from 'express';
import { UsersService } from './users.service';

const router = Router();
const usersService = new UsersService();

router.post('/register', async (req, res) => {
  const user = await usersService.create(req.body);
  res.status(201).json(user);
});

router.get('/:id', async (req, res) => {
  const user = await usersService.findById(req.params.id);
  res.json(user);
});

router.put('/:id', async (req, res) => {
  const user = await usersService.update(req.params.id, req.body);
  res.json(user);
});

export default router;
