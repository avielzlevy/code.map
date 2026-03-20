"""
PaymentsService — Stripe integration for payment processing.
"""

from flow_map import flow_step

from app.services.stripe import StripeService


class PaymentsService:
    def __init__(self):
        self.stripe = StripeService()

    @flow_step("Call Stripe API to create PaymentIntent with idempotency key")
    async def create_intent(self):
        """Creates a Stripe PaymentIntent for the given order total."""
        intent = await self.stripe.create_payment_intent()
        await self._persist_payment_record(intent)
        return self._format_intent_response(intent)

    @flow_step("Confirm payment with Stripe and update order status")
    async def confirm_payment(self):
        result = await self.stripe.confirm_payment_intent()
        await self._update_payment_status(result)
        return result

    @flow_step("Initiate Stripe refund and record refund event")
    async def process_refund(self):
        refund = await self.stripe.create_refund()
        await self._persist_refund_record(refund)
        return refund

    @flow_step("Verify Stripe webhook signature and route to handler")
    async def handle_webhook(self):
        event = await self.stripe.verify_webhook_signature()
        return await self._dispatch_webhook_event(event)

    async def get_saved_payment_methods(self):
        return await self.stripe.list_payment_methods()

    async def _persist_payment_record(self, intent):
        return {"id": "1", "intent": intent}

    async def _persist_refund_record(self, refund):
        return {"id": "1", "refund": refund}

    async def _update_payment_status(self, result):
        return result

    def _format_intent_response(self, intent):
        return {"client_secret": "pi_xxx_secret_xxx", "intent": intent}

    async def _dispatch_webhook_event(self, event):
        return event
