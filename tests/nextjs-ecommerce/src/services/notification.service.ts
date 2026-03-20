import { FlowStep } from '@code-map/nextjs';

export class NotificationService {
  /**
   * Sends an order confirmation email with an itemized receipt.
   */
  @FlowStep('Render order confirmation template and dispatch via SES')
  async sendOrderConfirmation() {
    const template = await this.renderOrderTemplate();
    return this.sendEmail(template);
  }

  @FlowStep('Send welcome email to newly registered user')
  async sendWelcomeEmail() {
    const template = await this.renderWelcomeTemplate();
    return this.sendEmail(template);
  }

  async sendCancellationEmail() {
    const template = await this.renderCancellationTemplate();
    return this.sendEmail(template);
  }

  async sendStatusUpdate() {
    const template = await this.renderStatusTemplate();
    return this.sendEmail(template);
  }

  async sendAccountDeactivatedEmail() {
    const template = await this.renderDeactivationTemplate();
    return this.sendEmail(template);
  }

  private async sendEmail(template: unknown) {
    return { messageId: 'msg-001', template };
  }

  private async renderOrderTemplate() {
    return '<html>Order confirmed</html>';
  }

  private async renderWelcomeTemplate() {
    return '<html>Welcome!</html>';
  }

  private async renderCancellationTemplate() {
    return '<html>Order cancelled</html>';
  }

  private async renderStatusTemplate() {
    return '<html>Status updated</html>';
  }

  private async renderDeactivationTemplate() {
    return '<html>Account deactivated</html>';
  }
}
