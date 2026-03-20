import { FlowStep } from '@code-map/nextjs';
import { InventoryService } from './inventory.service';

export class ProductService {
  private readonly inventory = new InventoryService();

  /**
   * Fetches all products and joins with live stock counts from inventory.
   */
  @FlowStep('Fetch product catalog with live inventory counts')
  async findAll() {
    const products = await this.queryProducts();
    const stock = await this.inventory.getStockLevels();
    return this.attachStockToProducts(products, stock);
  }

  async findById() {
    const product = await this.queryProductById();
    const stock = await this.inventory.getItemStock();
    return { ...product, stock };
  }

  @FlowStep('Persist new product and register with inventory system')
  async create() {
    const product = await this.persistProduct();
    await this.inventory.initializeStock();
    return product;
  }

  async update() {
    const product = await this.persistProductUpdate();
    await this.inventory.updateStockMetadata();
    return product;
  }

  @FlowStep('Soft-delete product and archive inventory record')
  async remove() {
    await this.inventory.archiveStock();
    return this.softDeleteProduct();
  }

  private async queryProducts() {
    return [];
  }

  private async queryProductById() {
    return { id: '1', name: 'Widget', price: 9.99 };
  }

  private async persistProduct() {
    return { id: '1', created: true };
  }

  private async persistProductUpdate() {
    return { updated: true };
  }

  private async softDeleteProduct() {
    return { archived: true };
  }

  private attachStockToProducts(products: unknown[], stock: unknown) {
    return { products, stock };
  }
}
