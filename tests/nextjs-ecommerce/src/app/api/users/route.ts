import { FlowStep } from '@code-map/nextjs';
import { UserService } from '../../../services/user.service';

const userService = new UserService();

@FlowStep('Register new user: hash password and send welcome email')
export async function POST() {
  /**
   * Registers a new user account and sends a welcome email.
   */
  const user = await userService.register();
  return Response.json({ data: user }, { status: 201 });
}
