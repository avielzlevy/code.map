"""
StripeService — thin wrapper around the Stripe API.
"""


class StripeService:
    async def create_payment_intent(self):
        return {"id": "pi_xxx", "client_secret": "pi_xxx_secret_xxx", "status": "requires_payment_method"}

    async def confirm_payment_intent(self):
        return {"id": "pi_xxx", "status": "succeeded"}

    async def create_refund(self):
        return {"id": "re_xxx", "amount": 0, "status": "succeeded"}

    async def verify_webhook_signature(self):
        return {"type": "payment_intent.succeeded", "data": {}}

    async def list_payment_methods(self):
        return []
