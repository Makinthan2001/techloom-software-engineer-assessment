import { prisma } from '../config/index.js';
import type { Product } from '@prisma/client';

export const productRepository = {
  async create(data: { name: string; price: number | string; stock: number }): Promise<Product> {
    return prisma.product.create({
      data: {
        name: data.name,
        price: data.price,
        stock: data.stock,
      },
    });
  },

  async findAll(): Promise<Product[]> {
    return prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  },

  async update(
    id: string,
    data: { name?: string; price?: number | string; stock?: number }
  ): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data,
    });
  },

  async countOrderItems(productId: string): Promise<number> {
    return prisma.orderItem.count({
      where: { productId },
    });
  },

  async delete(id: string): Promise<Product> {
    return prisma.product.delete({
      where: { id },
    });
  },
};
