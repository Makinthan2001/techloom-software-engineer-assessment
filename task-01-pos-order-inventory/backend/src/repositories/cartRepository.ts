import { prisma } from '../config/index.js';
import type { Cart, CartItem } from '@prisma/client';

export const cartRepository = {
  async createCart(userId: string): Promise<Cart> {
    return prisma.cart.create({
      data: {
        userId,
        status: 'ACTIVE',
      },
    });
  },

  async findById(id: string) {
    return prisma.cart.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });
  },

  async upsertCartItem(
    cartId: string,
    productId: string,
    quantity: number
  ): Promise<CartItem> {
    return prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        cartId,
        productId,
        quantity,
      },
    });
  },

  async updateItemQuantity(itemId: string, quantity: number): Promise<CartItem> {
    return prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  },

  async findItemById(itemId: string): Promise<CartItem | null> {
    return prisma.cartItem.findUnique({
      where: { id: itemId },
    });
  },

  async deleteItem(itemId: string): Promise<CartItem> {
    return prisma.cartItem.delete({
      where: { id: itemId },
    });
  },
};
