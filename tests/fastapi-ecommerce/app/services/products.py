"""
ProductsService — catalog management and search.
"""

from flow_map import flow_step

from app.services.inventory import InventoryService


class ProductsService:
    def __init__(self):
        self.inventory = InventoryService()

    @flow_step("Fetch product catalog with live inventory counts")
    async def find_all(self):
        """Fetches all products and joins with live stock counts from inventory."""
        products = await self._query_products()
        stock = await self.inventory.get_stock_levels()
        return self._attach_stock_to_products(products, stock)

    @flow_step("Execute full-text search with relevance ranking")
    async def search(self):
        results = await self._run_search_query()
        return self._rank_results(results)

    async def find_by_id(self, product_id: str):
        product = await self._query_product_by_id(product_id)
        stock = await self.inventory.get_item_stock()
        return {**product, "stock": stock}

    @flow_step("Persist new product and register with inventory system")
    async def create(self):
        product = await self._persist_product()
        await self.inventory.initialize_stock()
        return product

    async def update(self, product_id: str):
        product = await self._persist_product_update(product_id)
        await self.inventory.update_stock_metadata()
        return product

    @flow_step("Soft-delete product and archive inventory record")
    async def remove(self, product_id: str):
        await self.inventory.archive_stock()
        return await self._soft_delete_product(product_id)

    async def _query_products(self):
        return []

    async def _query_product_by_id(self, product_id: str):
        return {"id": product_id, "name": "Widget", "price": 9.99}

    async def _persist_product(self):
        return {"id": "1", "created": True}

    async def _persist_product_update(self, product_id: str):
        return {"updated": True}

    async def _soft_delete_product(self, product_id: str):
        return {"archived": True}

    async def _run_search_query(self):
        return []

    def _rank_results(self, results):
        return results

    def _attach_stock_to_products(self, products, stock):
        return {"products": products, "stock": stock}
