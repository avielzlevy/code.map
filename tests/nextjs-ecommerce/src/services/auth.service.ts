import { FlowStep } from '@code-map/nextjs';

export class AuthService {
  /**
   * Hashes a plaintext password using bcrypt with a configurable salt rounds.
   */
  @FlowStep('Bcrypt-hash the plaintext password with configured salt rounds')
  async hashPassword() {
    const salt = await this.generateSalt();
    return this.bcryptHash(salt);
  }

  @FlowStep('Validate password hash against stored credential')
  async validateCredentials() {
    const storedHash = await this.fetchStoredHash();
    return this.bcryptCompare(storedHash);
  }

  @FlowStep('Sign and return a JWT with user claims and expiry')
  async generateToken() {
    const payload = await this.buildTokenPayload();
    return this.signJwt(payload);
  }

  async revokeToken() {
    return this.addToBlocklist();
  }

  @FlowStep('Invalidate all active sessions for the user')
  async revokeAllTokens() {
    const sessions = await this.fetchActiveSessions();
    return this.bulkRevokeTokens(sessions);
  }

  private async generateSalt() {
    return '$2b$10$salt';
  }

  private async bcryptHash(salt: unknown) {
    return `hashed_${salt}`;
  }

  private async fetchStoredHash() {
    return 'stored_hash';
  }

  private async bcryptCompare(hash: unknown) {
    return hash === 'stored_hash';
  }

  private async buildTokenPayload() {
    return { sub: '1', roles: ['user'] };
  }

  private signJwt(payload: unknown) {
    return `jwt.${JSON.stringify(payload)}.sig`;
  }

  private async addToBlocklist() {
    return true;
  }

  private async fetchActiveSessions() {
    return [];
  }

  private async bulkRevokeTokens(sessions: unknown[]) {
    return sessions.length;
  }
}
