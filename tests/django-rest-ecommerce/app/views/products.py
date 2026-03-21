from rest_framework import viewsets
from rest_framework.response import Response

from app.services.products import ProductsService


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for product catalog — read-only."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.product_service = ProductsService()

    def list(self, request):
        """Returns all active products."""
        products = self.product_service.find_all()
        return Response(products)

    def retrieve(self, request, pk=None):
        product = self.product_service.find_by_id(pk)
        return Response(product)
