"""
Orders router — CRUD + checkout flow for the e-commerce API.
"""

from fastapi import APIRouter
from flow_map import flow_step

from app.services.orders import OrdersService
from app.services.inventory import InventoryService
from app.services.payments import PaymentsService
from app.services.notifications import NotificationService

router = APIRouter(prefix="/orders", tags=["orders"])


class OrdersRouter:
    def __init__(self):
        self.orders_service = OrdersService()

    @router.get("/")
    @flow_step("List all orders with filters and pagination")
    async def list_orders(self):
        """Returns a paginated list of orders for the authenticated user."""
        return await self.orders_service.find_all()

    @router.get("/{order_id}")
    async def get_order(self, order_id: str):
        return await self.orders_service.find_by_id(order_id)

    @router.post("/")
    @flow_step("Create a new order and reserve inventory")
    async def create_order(self):
        return await self.orders_service.create()

    @router.put("/{order_id}")
    async def update_order(self, order_id: str):
        return await self.orders_service.update(order_id)

    @router.delete("/{order_id}")
    @flow_step("Cancel order and release reserved inventory")
    async def cancel_order(self, order_id: str):
        return await self.orders_service.cancel(order_id)

    @router.post("/{order_id}/checkout")
    @flow_step("Initiate checkout: charge payment and confirm stock deduction")
    async def checkout(self, order_id: str):
        """Initiates the checkout flow — charges the customer and confirms inventory deduction."""
        return await self.orders_service.checkout(order_id)

    @router.get("/{order_id}/status")
    async def get_order_status(self, order_id: str):
        return await self.orders_service.get_status(order_id)

    @router.patch("/{order_id}/status")
    @flow_step("Update order fulfillment status")
    async def update_order_status(self, order_id: str):
        return await self.orders_service.update_status(order_id)
