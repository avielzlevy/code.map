from flow_map import flow_step


class OrdersService:
    @flow_step("Fetch and paginate user orders")
    def find_all(self, user_id: str) -> list:
        """Returns paginated orders for the authenticated user."""
        return []

    def find_by_id(self, order_id: str) -> dict:
        return {"id": order_id}

    @flow_step("Create order and reserve inventory")
    def create(self, data: dict, user_id: str) -> dict:
        return {"id": "ord_1", "user_id": user_id, **data}

    def update(self, order_id: str, data: dict) -> dict:
        return {"id": order_id, **data}

    @flow_step("Cancel order and release inventory")
    def cancel(self, order_id: str) -> None:
        pass
