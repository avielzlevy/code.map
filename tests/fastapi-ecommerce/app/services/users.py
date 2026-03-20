"""
UsersService — authentication and user profile management.
"""

from flow_map import flow_step

from app.services.auth import AuthService
from app.services.notifications import NotificationService


class UsersService:
    def __init__(self):
        self.auth = AuthService()
        self.notifications = NotificationService()

    @flow_step("Hash password, persist user record, trigger welcome email")
    async def register(self):
        """Creates a new user account with a hashed password and sends a welcome email."""
        hashed = await self.auth.hash_password()
        user = await self._persist_user(hashed)
        await self.notifications.send_welcome_email()
        return user

    @flow_step("Validate credentials and return signed JWT")
    async def login(self):
        user = await self._find_by_email()
        await self.auth.validate_credentials()
        token = await self.auth.generate_token()
        await self._record_login_event()
        return {"user": user, "token": token}

    async def logout(self):
        await self.auth.revoke_token()
        return {"success": True}

    @flow_step("Load user profile with aggregated order history")
    async def get_profile(self):
        user = await self._find_by_id()
        return self._enrich_profile_with_stats(user)

    async def update_profile(self):
        return await self._persist_profile_update()

    @flow_step("Soft-delete user and revoke all active tokens")
    async def deactivate(self):
        await self.auth.revoke_all_tokens()
        await self.notifications.send_account_deactivated_email()
        return await self._soft_delete_user()

    @flow_step("Validate current password and persist new hash")
    async def change_password(self):
        await self.auth.validate_credentials()
        hashed = await self.auth.hash_password()
        await self.auth.revoke_all_tokens()
        return await self._update_password_hash(hashed)

    async def _find_by_email(self):
        return {"id": "1", "email": "user@example.com"}

    async def _find_by_id(self):
        return {"id": "1", "email": "user@example.com"}

    async def _persist_user(self, hashed_password):
        return {"id": "1", "hashed_password": hashed_password}

    async def _persist_profile_update(self):
        return {"updated": True}

    async def _soft_delete_user(self):
        return {"deactivated": True}

    async def _record_login_event(self):
        return True

    async def _update_password_hash(self, hash_value):
        return {"updated": True, "hash": hash_value}

    def _enrich_profile_with_stats(self, user):
        return {**user, "order_count": 0, "total_spend": 0}
