import { productRepository } from '../repositories/productRepository.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { ProductCreateInput, ProductUpdateInput } from '../validators/index.js';
import type { Product } from '@prisma/client';

export const productService = {
  async createProduct(input: ProductCreateInput): Promise<Product> {
    return productRepository.create(input);
  },

  async getAllProducts(): Promise<Product[]> {
    return productRepository.findAll();
  },

  async getProductById(id: string): Promise<Product> {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }
    return product;
  },

  async updateProduct(id: string, input: ProductUpdateInput): Promise<Product> {
    await this.getProductById(id); // Ensure product exists first
    const updateData: { name?: string; price?: number | string; stock?: number } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.stock !== undefined) updateData.stock = input.stock;
    return productRepository.update(id, updateData);
  },

  async deleteProduct(id: string): Promise<void> {
    await this.getProductById(id); // Ensure product exists first

    const orderItemCount = await productRepository.countOrderItems(id);
    if (orderItemCount > 0) {
      throw new ConflictError(
        `Cannot delete product '${id}' because it is referenced in existing orders`
      );
    }

    await productRepository.delete(id);
  },

  async getProductStock(id: string): Promise<{ productId: string; stock: number }> {
    const product = await this.getProductById(id);
    return {
      productId: product.id,
      stock: product.stock,
    };
  },
};
