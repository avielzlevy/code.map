/**
 * Fixture file used by AST parser unit tests.
 * This is NOT production code — it is intentionally minimal TypeScript
 * that exercises every extraction path the parser must handle.
 */

// Simulated NestJS decorators (real imports not needed for static AST analysis)
declare function Controller(prefix?: string): ClassDecorator;
declare function Injectable(): ClassDecorator;
declare function Get(path?: string): MethodDecorator;
declare function Post(path?: string): MethodDecorator;
declare function FlowStep(description: string): MethodDecorator;

@Controller('users')
class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Returns a paginated list of active users.
   */
  @Get()
  @FlowStep('Fetch all active users with pagination')
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async create() {
    return this.userService.create();
  }
}

@Injectable()
class UserService {
  @FlowStep('Persist new user record to database')
  async create() {
    return this.saveToDb();
  }

  async findAll() {
    return this.filterByStatus();
  }

  private saveToDb() {
    return { id: 1 };
  }

  private filterByStatus() {
    return [];
  }
}
