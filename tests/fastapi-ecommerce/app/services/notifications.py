"""
NotificationService — transactional email dispatch via SES.
"""

from flow_map import flow_step


class NotificationService:
    @flow_step("Render order confirmation template and dispatch via SES")
    async def send_order_confirmation(self):
        """Sends an order confirmation email with an itemized receipt."""
        template = await self._render_order_template()
        return await self._send_email(template)

    @flow_step("Send welcome email to newly registered user")
    async def send_welcome_email(self):
        template = await self._render_welcome_template()
        return await self._send_email(template)

    async def send_cancellation_email(self):
        template = await self._render_cancellation_template()
        return await self._send_email(template)

    async def send_status_update(self):
        template = await self._render_status_template()
        return await self._send_email(template)

    async def send_account_deactivated_email(self):
        template = await self._render_deactivation_template()
        return await self._send_email(template)

    async def _send_email(self, template):
        return {"message_id": "msg-001", "template": template}

    async def _render_order_template(self):
        return "<html>Order confirmed</html>"

    async def _render_welcome_template(self):
        return "<html>Welcome!</html>"

    async def _render_cancellation_template(self):
        return "<html>Order cancelled</html>"

    async def _render_status_template(self):
        return "<html>Status updated</html>"

    async def _render_deactivation_template(self):
        return "<html>Account deactivated</html>"
