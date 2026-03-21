export class OrdersService {
  /** Fetch paginated orders for a user. */
  async findAll(userId: string): Promise<unknown[]> { return []; }

  async findById(orderId: string): Promise<unknown> { return { id: orderId }; }

  async create(data: unknown, userId: string): Promise<unknown> {
    return { id: 'ord_1', userId, ...data as object };
  }

  async update(orderId: string, data: unknown): Promise<unknown> {
    return { id: orderId, ...data as object };
  }

  async cancel(orderId: string): Promise<void> {}
}
