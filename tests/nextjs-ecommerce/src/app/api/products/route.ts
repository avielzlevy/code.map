import { Dot } from '@code-map/nextjs';
import { ProductService } from '../../../services/product.service';

const productService = new ProductService();

/**
 * Returns all active products with inventory status.
 */
@Dot('List all products with real-time stock status')
export async function GET() {
  const products = await productService.findAll();
  return Response.json({ data: products });
}

@Dot('Create product and initialize inventory slot')
export async function POST() {
  const product = await productService.create();
  return Response.json({ data: product }, { status: 201 });
}
