"""
OrdersService — domain logic for order lifecycle management.
"""

from flow_map import flow_step

from app.services.inventory import InventoryService
from app.services.payments import PaymentsService
from app.services.notifications import NotificationService


class OrdersService:
    def __init__(self):
        self.inventory = InventoryService()
        self.payments = PaymentsService()
        self.notifications = NotificationService()

    @flow_step("Fetch orders and enrich with live inventory data")
    async def find_all(self):
        """Fetches all orders, enriching each with current stock availability."""
        orders = await self._query_orders()
        stock = await self.inventory.check_stock()
        return self._merge_orders_with_stock(orders, stock)

    async def find_by_id(self, order_id: str):
        return await self._query_order_by_id(order_id)

    @flow_step("Validate cart, reserve inventory, create payment intent")
    async def create(self):
        cart = await self._validate_cart()
        await self.inventory.reserve_items()
        intent = await self.payments.create_intent()
        return await self._persist_order(cart, intent)

    async def update(self, order_id: str):
        return await self._persist_order_update(order_id)

    @flow_step("Cancel order: release stock and trigger refund if charged")
    async def cancel(self, order_id: str):
        await self.inventory.release_items()
        await self.payments.process_refund()
        await self.notifications.send_cancellation_email()
        return await self._mark_order_cancelled(order_id)

    @flow_step("Execute checkout: charge card, deduct stock, send confirmation")
    async def checkout(self, order_id: str):
        await self.payments.confirm_payment()
        await self.inventory.deduct_stock()
        await self.notifications.send_order_confirmation()
        return await self._mark_order_paid(order_id)

    async def get_status(self, order_id: str):
        return await self._query_order_status(order_id)

    async def update_status(self, order_id: str):
        order = await self._query_order_by_id(order_id)
        updated = await self._apply_status_transition(order)
        await self.notifications.send_status_update()
        return updated

    async def _validate_cart(self):
        return {"items": [], "total": 0}

    async def _query_orders(self):
        return []

    async def _query_order_by_id(self, order_id: str):
        return {"id": order_id, "status": "pending"}

    async def _query_order_status(self, order_id: str):
        return "pending"

    async def _persist_order(self, cart, intent):
        return {"id": "1", "cart": cart, "intent": intent}

    async def _persist_order_update(self, order_id: str):
        return {"updated": True}

    async def _mark_order_cancelled(self, order_id: str):
        return {"status": "cancelled"}

    async def _mark_order_paid(self, order_id: str):
        return {"status": "paid"}

    def _merge_orders_with_stock(self, orders, stock):
        return {"orders": orders, "stock": stock}

    async def _apply_status_transition(self, order):
        return order
