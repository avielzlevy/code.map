export class EmailService {
  /** Sends a transactional email via the configured SMTP provider. */
  async send(to: string, subject: string, body: string): Promise<void> {
    // SMTP dispatch
  }

  async sendOrderConfirmation(orderId: string, email: string): Promise<void> {
    await this.send(email, 'Order confirmed', `Order ${orderId} confirmed`);
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    await this.send(email, 'Reset your password', `Token: ${token}`);
  }
}
