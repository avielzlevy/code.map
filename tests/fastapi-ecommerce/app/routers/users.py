"""
Users router — authentication and profile management.
"""

from fastapi import APIRouter
from flow_map import flow_step

from app.services.users import UsersService

router = APIRouter(prefix="/users", tags=["users"])


class UsersRouter:
    def __init__(self):
        self.users_service = UsersService()

    @router.post("/register")
    @flow_step("Register new user: hash password and send welcome email")
    async def register(self):
        """Registers a new user account and sends a welcome email."""
        return await self.users_service.register()

    @router.post("/login")
    @flow_step("Authenticate credentials and issue JWT token")
    async def login(self):
        return await self.users_service.login()

    @router.post("/logout")
    async def logout(self):
        return await self.users_service.logout()

    @router.get("/me")
    @flow_step("Fetch authenticated user profile with order history")
    async def get_profile(self):
        return await self.users_service.get_profile()

    @router.put("/me")
    async def update_profile(self):
        return await self.users_service.update_profile()

    @router.delete("/me")
    @flow_step("Deactivate account and revoke all active sessions")
    async def deactivate(self):
        return await self.users_service.deactivate()

    @router.post("/me/change-password")
    @flow_step("Validate old password and set new hashed password")
    async def change_password(self):
        return await self.users_service.change_password()
