// Product Service - Fuel, Oils, and Services Management

import { table } from '@devvai/devv-code-backend';
import { Product } from '../types';

const PRODUCTS_TABLE_ID = 'f4f186q7i03m';

// Get current user ID from localStorage
function getCurrentUserId(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('User not authenticated');
  const parsed = JSON.parse(authStorage);
  return parsed.state?.user?.uid || '';
}

// Get all products
export async function getProducts(filterQuery?: { productType?: string; isActive?: string }): Promise<Product[]> {
  try {
    const result = await table.getItems(PRODUCTS_TABLE_ID, {
      query: filterQuery || {}
    });
    return (result.items || []) as Product[];
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

// Get product by ID
export async function getProductById(productId: string): Promise<Product | null> {
  try {
    const result = await table.getItems(PRODUCTS_TABLE_ID, {
      query: { _id: productId }
    });
    return result.items?.[0] as Product || null;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
}

// Create new product
export async function createProduct(productData: Omit<Product, '_id' | '_uid' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    
    await table.addItem(PRODUCTS_TABLE_ID, {
      ...productData,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      isActive: productData.isActive || 'active'
    });
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}

// Update product
export async function updateProduct(productId: string, uid: string, updates: Partial<Product>): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await table.updateItem(PRODUCTS_TABLE_ID, {
      _uid: uid,
      _id: productId,
      ...updates,
      updatedAt: now
    });
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

// Delete product
export async function deleteProduct(productId: string, uid: string): Promise<void> {
  try {
    await table.deleteItem(PRODUCTS_TABLE_ID, {
      _uid: uid,
      _id: productId
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// Get active fuel products
export async function getActiveFuelProducts(): Promise<Product[]> {
  return getProducts({ productType: 'fuel', isActive: 'active' });
}

// Get active oil products
export async function getActiveOilProducts(): Promise<Product[]> {
  return getProducts({ productType: 'oil', isActive: 'active' });
}

// Get active services
export async function getActiveServices(): Promise<Product[]> {
  return getProducts({ productType: 'service', isActive: 'active' });
}
