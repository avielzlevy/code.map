from flow_map import flow_step


class UsersService:
    @flow_step("Register user and send welcome email")
    def create(self, data: dict) -> dict:
        """Creates a new user account."""
        return {"id": "usr_1", **data}

    def find_by_id(self, user_id: str) -> dict:
        return {"id": user_id}

    def update(self, user_id: str, data: dict) -> dict:
        return {"id": user_id, **data}
