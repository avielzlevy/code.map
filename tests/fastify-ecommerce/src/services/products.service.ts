export class ProductsService {
  async findAll(): Promise<unknown[]> { return []; }
  async findById(id: string): Promise<unknown> { return { id }; }
  async create(data: unknown): Promise<unknown> { return { id: 'prod_1', ...data as object }; }
}
