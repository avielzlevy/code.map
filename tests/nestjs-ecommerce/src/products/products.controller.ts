import { Controller, Get, Post, Put, Delete } from '@nestjs/common';
import { FlowStep } from '@code-map/nestjs';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Returns all active products with inventory status.
   */
  @Get()
  @FlowStep('List all products with real-time stock status')
  async findAll() {
    return this.productsService.findAll();
  }

  @Get('search')
  @FlowStep('Full-text search across product catalog')
  async search() {
    return this.productsService.search();
  }

  @Get(':id')
  async findOne() {
    return this.productsService.findById();
  }

  @Post()
  @FlowStep('Create product and initialize inventory slot')
  async create() {
    return this.productsService.create();
  }

  @Put(':id')
  async update() {
    return this.productsService.update();
  }

  @Delete(':id')
  @FlowStep('Archive product and zero out inventory')
  async remove() {
    return this.productsService.remove();
  }
}
