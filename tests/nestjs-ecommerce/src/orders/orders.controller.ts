import { Controller, Get, Post, Put, Delete, Patch } from '@nestjs/common';
import { FlowStep } from '@code-map/nestjs';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Returns a paginated list of orders for the authenticated user.
   */
  @Get()
  @FlowStep('List all orders with filters and pagination')
  async findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  async findOne() {
    return this.ordersService.findById();
  }

  @Post()
  @FlowStep('Create a new order and reserve inventory')
  async create() {
    return this.ordersService.create();
  }

  @Put(':id')
  async update() {
    return this.ordersService.update();
  }

  @Delete(':id')
  @FlowStep('Cancel order and release reserved inventory')
  async cancel() {
    return this.ordersService.cancel();
  }

  /**
   * Initiates the checkout flow — charges the customer and confirms inventory deduction.
   */
  @Post(':id/checkout')
  @FlowStep('Initiate checkout: charge payment and confirm stock')
  async checkout() {
    return this.ordersService.checkout();
  }

  @Get(':id/status')
  async getStatus() {
    return this.ordersService.getStatus();
  }

  @Patch(':id/status')
  @FlowStep('Update order fulfillment status')
  async updateStatus() {
    return this.ordersService.updateStatus();
  }
}
