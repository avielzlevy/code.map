from rest_framework import viewsets
from rest_framework.response import Response

from app.services.users import UsersService


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for user registration and profile management."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.user_service = UsersService()

    def create(self, request):
        """Register a new user account."""
        user = self.user_service.create(request.data)
        return Response(user, status=201)

    def retrieve(self, request, pk=None):
        user = self.user_service.find_by_id(pk)
        return Response(user)

    def update(self, request, pk=None):
        user = self.user_service.update(pk, request.data)
        return Response(user)
