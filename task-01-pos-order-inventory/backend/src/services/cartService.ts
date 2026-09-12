import { cartRepository } from '../repositories/cartRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import type { CartItemInput } from '../validators/index.js';

export interface CartWithTotals {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    cartId: string;
    productId: string;
    quantity: number;
    subtotal: number;
    product: {
      id: string;
      name: string;
      price: string;
      stock: number;
    };
  }>;
  totalAmount: number;
}

export const cartService = {
  async createCart(userId: string) {
    return cartRepository.createCart(userId);
  },

  async getCartById(cartId: string, requestingUserId: string): Promise<CartWithTotals> {
    const cart = await cartRepository.findById(cartId);
    if (!cart) {
      throw new NotFoundError(`Cart with ID '${cartId}' not found`);
    }

    if (cart.userId !== requestingUserId) {
      throw new ForbiddenError('You are not authorized to access this cart');
    }

    let totalAmount = 0;
    const formattedItems = cart.items.map((item) => {
      const price = Number(item.product.price);
      const subtotal = price * item.quantity;
      totalAmount += subtotal;
      return {
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        quantity: item.quantity,
        subtotal: Number(subtotal.toFixed(2)),
        product: {
          id: item.product.id,
          name: item.product.name,
          price: item.product.price.toString(),
          stock: item.product.stock,
        },
      };
    });

    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      items: formattedItems,
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  },

  async addItemToCart(cartId: string, requestingUserId: string, input: CartItemInput) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) {
      throw new NotFoundError(`Cart with ID '${cartId}' not found`);
    }

    if (cart.userId !== requestingUserId) {
      throw new ForbiddenError('You are not authorized to modify this cart');
    }

    if (cart.status !== 'ACTIVE') {
      throw new ConflictError('Cannot add items to a converted or inactive cart');
    }

    const product = await productRepository.findById(input.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID '${input.productId}' not found`);
    }

    return cartRepository.upsertCartItem(cartId, input.productId, input.quantity);
  },

  async updateCartItem(
    cartId: string,
    itemId: string,
    requestingUserId: string,
    quantity: number
  ) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) {
      throw new NotFoundError(`Cart with ID '${cartId}' not found`);
    }

    if (cart.userId !== requestingUserId) {
      throw new ForbiddenError('You are not authorized to modify this cart');
    }

    if (cart.status !== 'ACTIVE') {
      throw new ConflictError('Cannot modify items in a converted or inactive cart');
    }

    const item = await cartRepository.findItemById(itemId);
    if (!item || item.cartId !== cartId) {
      throw new NotFoundError(`Cart item with ID '${itemId}' not found in this cart`);
    }

    return cartRepository.updateItemQuantity(itemId, quantity);
  },

  async removeCartItem(cartId: string, itemId: string, requestingUserId: string) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) {
      throw new NotFoundError(`Cart with ID '${cartId}' not found`);
    }

    if (cart.userId !== requestingUserId) {
      throw new ForbiddenError('You are not authorized to modify this cart');
    }

    if (cart.status !== 'ACTIVE') {
      throw new ConflictError('Cannot remove items from a converted or inactive cart');
    }

    const item = await cartRepository.findItemById(itemId);
    if (!item || item.cartId !== cartId) {
      throw new NotFoundError(`Cart item with ID '${itemId}' not found in this cart`);
    }

    await cartRepository.deleteItem(itemId);
  },
};
