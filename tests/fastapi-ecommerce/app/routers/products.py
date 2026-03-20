"""
Products router — catalog CRUD and search endpoints.
"""

from fastapi import APIRouter
from flow_map import flow_step

from app.services.products import ProductsService

router = APIRouter(prefix="/products", tags=["products"])


class ProductsRouter:
    def __init__(self):
        self.products_service = ProductsService()

    @router.get("/")
    @flow_step("List all products with real-time stock status")
    async def list_products(self):
        """Returns all active products with inventory status."""
        return await self.products_service.find_all()

    @router.get("/search")
    @flow_step("Full-text search across product catalog")
    async def search_products(self):
        return await self.products_service.search()

    @router.get("/{product_id}")
    async def get_product(self, product_id: str):
        return await self.products_service.find_by_id(product_id)

    @router.post("/")
    @flow_step("Create product and initialize inventory slot")
    async def create_product(self):
        return await self.products_service.create()

    @router.put("/{product_id}")
    async def update_product(self, product_id: str):
        return await self.products_service.update(product_id)

    @router.delete("/{product_id}")
    @flow_step("Archive product and zero out inventory")
    async def remove_product(self, product_id: str):
        return await self.products_service.remove(product_id)
