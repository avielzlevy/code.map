import { FlowStep } from '@code-map/nextjs';
import { ProductService } from '../../../../services/product.service';

const productService = new ProductService();

export async function GET() {
  const product = await productService.findById();
  return Response.json({ data: product });
}

export async function PUT() {
  const product = await productService.update();
  return Response.json({ data: product });
}

@FlowStep('Archive product and zero out inventory')
export async function DELETE() {
  const result = await productService.remove();
  return Response.json({ data: result });
}
