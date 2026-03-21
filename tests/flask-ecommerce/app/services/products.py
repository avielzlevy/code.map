class ProductsService:
    def find_all(self, search: str = None) -> list:
        """Returns all active products with optional search."""
        return []

    def find_by_id(self, product_id: str) -> dict:
        return {"id": product_id}

    def create(self, data: dict) -> dict:
        return {"id": "prod_1", **data}
