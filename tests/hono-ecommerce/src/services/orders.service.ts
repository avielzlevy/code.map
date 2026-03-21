export class OrdersService {
  async findAll(userId: string): Promise<unknown[]> { return []; }
  async findById(id: string): Promise<unknown> { return { id }; }
  async create(data: unknown, userId: string): Promise<unknown> { return { id: 'ord_1', userId, ...data as object }; }
  async update(id: string, data: unknown): Promise<unknown> { return { id, ...data as object }; }
  async cancel(id: string): Promise<void> {}
}
