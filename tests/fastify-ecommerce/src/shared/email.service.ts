export class EmailService {
  async send(to: string, subject: string): Promise<void> {}
  async sendOrderConfirmation(orderId: string, email: string): Promise<void> {
    await this.send(email, `Order ${orderId} confirmed`);
  }
}
