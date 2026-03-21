export class ProductsService {
  /** Returns all active products with optional search filter. */
  async findAll(search?: string): Promise<unknown[]> {
    return [];
  }

  async findById(productId: string): Promise<unknown> {
    return { id: productId };
  }

  async create(data: unknown): Promise<unknown> {
    return { id: 'prod_1', ...data as object };
  }
}
