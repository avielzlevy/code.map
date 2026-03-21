export class UsersService {
  async findById(id: string): Promise<unknown> { return { id }; }
  async create(data: unknown): Promise<unknown> { return { id: 'usr_1', ...data as object }; }
  async update(id: string, data: unknown): Promise<unknown> { return { id, ...data as object }; }
}
