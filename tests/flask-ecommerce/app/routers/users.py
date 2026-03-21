from flask import Blueprint, jsonify, request

from app.services.users import UsersService

users_bp = Blueprint("users", __name__, url_prefix="/users")
users_service = UsersService()


@users_bp.post("/register")
def register():
    """Register a new user account."""
    user = users_service.create(request.get_json())
    return jsonify(user), 201


@users_bp.get("/<user_id>")
def get_user(user_id: str):
    user = users_service.find_by_id(user_id)
    return jsonify(user)


@users_bp.put("/<user_id>")
def update_user(user_id: str):
    user = users_service.update(user_id, request.get_json())
    return jsonify(user)
