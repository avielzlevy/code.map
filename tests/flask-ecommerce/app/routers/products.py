from flask import Blueprint, jsonify, request

from app.services.products import ProductsService

products_bp = Blueprint("products", __name__, url_prefix="/products")
products_service = ProductsService()


@products_bp.get("/")
def list_products():
    """Returns all active products."""
    products = products_service.find_all(request.args.get("search"))
    return jsonify(products)


@products_bp.get("/<product_id>")
def get_product(product_id: str):
    product = products_service.find_by_id(product_id)
    return jsonify(product)


@products_bp.post("/")
def create_product():
    product = products_service.create(request.get_json())
    return jsonify(product), 201
