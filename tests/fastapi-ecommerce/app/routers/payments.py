"""
Payments router — Stripe payment intents, confirmations, and webhooks.
"""

from fastapi import APIRouter
from flow_map import flow_step

from app.services.payments import PaymentsService

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentsRouter:
    def __init__(self):
        self.payments_service = PaymentsService()

    @router.post("/intent")
    @flow_step("Create payment intent and return client secret to frontend")
    async def create_intent(self):
        """Creates a Stripe payment intent for the order amount."""
        return await self.payments_service.create_intent()

    @router.post("/confirm")
    @flow_step("Confirm payment with Stripe and mark order as paid")
    async def confirm_payment(self):
        return await self.payments_service.confirm_payment()

    @router.post("/refund")
    @flow_step("Process full or partial refund for cancelled order")
    async def process_refund(self):
        return await self.payments_service.process_refund()

    @router.post("/webhook")
    @flow_step("Handle Stripe webhook: verify signature and dispatch event")
    async def handle_webhook(self):
        return await self.payments_service.handle_webhook()

    @router.get("/methods")
    async def get_saved_methods(self):
        return await self.payments_service.get_saved_payment_methods()
