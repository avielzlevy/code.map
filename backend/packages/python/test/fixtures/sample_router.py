"""
Fixture file used by AST parser unit tests.
Intentionally minimal FastAPI-style Python that exercises every extraction
path the parser must handle.
"""

# Simulated FastAPI decorators (real imports not needed for static AST analysis)
class router:
    @staticmethod
    def get(path: str):
        def decorator(fn): return fn
        return decorator

    @staticmethod
    def post(path: str):
        def decorator(fn): return fn
        return decorator


from code_map import dot


class UserRouter:
    @router.get("/users")
    @dot("Fetch all active users with pagination")
    async def find_all(self):
        """Returns a paginated list of active users."""
        return await self.user_service.find_all()

    @router.post("/users")
    async def create(self):
        return await self.user_service.create()


class UserService:
    @dot("Persist new user record to database")
    async def create(self):
        return await self._save_to_db()

    async def find_all(self):
        return self._filter_by_status()

    async def _save_to_db(self):
        return {"id": 1}

    def _filter_by_status(self):
        return []
