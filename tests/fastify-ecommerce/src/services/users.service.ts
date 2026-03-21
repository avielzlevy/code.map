export class UsersService {
  async findById(userId: string): Promise<unknown> { return { id: userId }; }
  async create(data: unknown): Promise<unknown> { return { id: 'usr_1', ...data as object }; }
  async update(userId: string, data: unknown): Promise<unknown> { return { id: userId, ...data as object }; }
}
