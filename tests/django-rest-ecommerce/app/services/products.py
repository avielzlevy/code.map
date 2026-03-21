class ProductsService:
    def find_all(self) -> list:
        """Returns all active products."""
        return []

    def find_by_id(self, product_id: str) -> dict:
        return {"id": product_id}

    def create(self, data: dict) -> dict:
        return {"id": "prod_1", **data}
