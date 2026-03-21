from flask import Blueprint, jsonify, request
from flow_map import flow_step

from app.services.orders import OrdersService
from app.services.email import EmailService

orders_bp = Blueprint("orders", __name__, url_prefix="/orders")
orders_service = OrdersService(email_service=EmailService())


@orders_bp.get("/")
@flow_step("List all orders with pagination")
def list_orders():
    """Returns a paginated list of orders for the authenticated user."""
    orders = orders_service.find_all("user_1")
    return jsonify(orders)


@orders_bp.get("/<order_id>")
def get_order(order_id: str):
    order = orders_service.find_by_id(order_id)
    return jsonify(order)


@orders_bp.post("/")
def create_order():
    order = orders_service.create(request.get_json(), "user_1")
    return jsonify(order), 201


@orders_bp.put("/<order_id>")
def update_order(order_id: str):
    order = orders_service.update(order_id, request.get_json())
    return jsonify(order)


@orders_bp.delete("/<order_id>")
def cancel_order(order_id: str):
    orders_service.cancel(order_id)
    return "", 204
