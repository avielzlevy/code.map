import { FlowStep } from '@code-map/nextjs';
import { UserService } from '../../../../services/user.service';

const userService = new UserService();

@FlowStep('Fetch authenticated user profile with order history')
export async function GET() {
  const profile = await userService.getProfile();
  return Response.json({ data: profile });
}

export async function PUT() {
  const profile = await userService.updateProfile();
  return Response.json({ data: profile });
}

@FlowStep('Deactivate account and revoke all active sessions')
export async function DELETE() {
  const result = await userService.deactivate();
  return Response.json({ data: result });
}
