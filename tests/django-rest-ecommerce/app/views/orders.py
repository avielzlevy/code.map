from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from app.services.orders import OrdersService


class OrderViewSet(viewsets.ModelViewSet):
    """ViewSet for order CRUD and checkout operations."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.order_service = OrdersService()

    def list(self, request):
        """List all orders for the authenticated user."""
        orders = self.order_service.find_all(str(request.user.id))
        return Response(orders)

    def retrieve(self, request, pk=None):
        order = self.order_service.find_by_id(pk)
        return Response(order)

    def create(self, request):
        order = self.order_service.create(request.data, str(request.user.id))
        return Response(order, status=201)

    def update(self, request, pk=None):
        order = self.order_service.update(pk, request.data)
        return Response(order)

    def destroy(self, request, pk=None):
        self.order_service.cancel(pk)
        return Response(status=204)

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        """Processes checkout for all items in the cart."""
        order = self.order_service.create(request.data, str(request.user.id))
        return Response(order, status=201)
