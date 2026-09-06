// Order Service - Fuel Order Management and Dispatch

import { table } from '@devvai/devv-code-backend';
import { Order } from '../types';
import { awardFuelPurchasePoints } from '../../loyalty/services/loyalty-account-service';
import { notificationService } from '@/features/notifications/services/notification-service';
import { generateQRCode, createOrderQRData } from './qr-service';
import { encodeOrderQR } from '@/lib/qr-utils';
import { sendFuelOrderReceipt } from '@/services/email-receipt-service';
import type { FuelOrderReceiptData } from '@/services/receipt-pdf-service';

const ORDERS_TABLE_ID = 'f4f186q7i03l';

// Get current user ID from localStorage
function getCurrentUserId(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('User not authenticated');
  const parsed = JSON.parse(authStorage);
  return parsed.state?.user?.uid || '';
}

// Generate unique order number
function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${dateStr}-${random}`;
}

// Generate 4-digit validation code
function generateValidationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Get all orders
export async function getOrders(filters?: { 
  customerId?: string; 
  stationId?: string; 
  status?: string;
}): Promise<Order[]> {
  try {
    const result = await table.getItems(ORDERS_TABLE_ID, {
      query: filters || {}
    });
    
    // Sort by creation date descending
    const orders = (result.items || []) as Order[];
    return orders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

// Get order by ID
export async function getOrderById(orderId: string): Promise<Order | null> {
  try {
    const result = await table.getItems(ORDERS_TABLE_ID, {
      query: { _id: orderId }
    });
    return result.items?.[0] as Order || null;
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
}

// Create new order
export async function createOrder(orderData: {
  vehicleId: string;
  vehicleRegistration: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const orderNumber = generateOrderNumber();
    const validationCode = generateValidationCode(); // Generate validation code
    const totalAmount = orderData.quantity * orderData.unitPrice;
    
    // Get customer name from localStorage
    const authStorage = localStorage.getItem('auth-storage');
    const parsed = JSON.parse(authStorage);
    const user = parsed.state?.user;
    const customerName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
    
    // Generate QR Code
    const qrData = {
      orderNumber,
      validationCode,
      amount: totalAmount,
      productName: orderData.productName,
      vehicleRegistration: orderData.vehicleRegistration,
      customerId: userId,
      timestamp: now,
    };
    
    const qrCode = await generateQRCode(qrData);
    const qrCodeData = await encodeOrderQR(qrData);
    
    await table.addItem(ORDERS_TABLE_ID, {
      orderNumber,
      customerId: userId,
      customerName,
      vehicleId: orderData.vehicleId,
      vehicleRegistration: orderData.vehicleRegistration,
      productId: orderData.productId,
      productName: orderData.productName,
      quantity: orderData.quantity,
      unitPrice: orderData.unitPrice,
      totalAmount,
      validationCode,
      qrCode,          // 🆕 Store QR Code base64
      qrCodeData,      // 🆕 Store QR data JSON
      status: 'pending',
      notes: orderData.notes || '',
      createdAt: now,
      updatedAt: now
    });
    
    // 🆕 Send receipt email automatically (non-blocking)
    try {
      const receiptData: FuelOrderReceiptData = {
        orderNumber,
        orderDate: new Date(now),
        driverName: customerName,
        driverPhone: user?.phone,
        vehicleRegistration: orderData.vehicleRegistration,
        fuelType: orderData.productName,
        quantity: orderData.quantity,
        unitPrice: orderData.unitPrice,
        totalAmount,
        validationCode,
        qrCodeData,
        paymentMethod: 'prepaid',
      };
      
      // Send email asynchronously (don't wait for it)
      sendFuelOrderReceipt(user?.email || '', receiptData).catch((err) => {
        console.warn('⚠️ Failed to send order receipt email:', err);
        // Don't throw - order creation should succeed even if email fails
      });
    } catch (err) {
      console.warn('⚠️ Failed to prepare receipt email:', err);
      // Don't throw - order creation should succeed even if email fails
    }
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

// Dispatch order to station
export async function dispatchOrder(
  orderId: string,
  orderUid: string,
  stationId: string, 
  stationName: string
): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const validationCode = generateValidationCode();
    
    await table.updateItem(ORDERS_TABLE_ID, {
      _uid: orderUid,
      _id: orderId,
      status: 'dispatched',
      stationId,
      stationName,
      dispatchedBy: userId,
      dispatchedAt: now,
      validationCode,
      updatedAt: now
    });
  } catch (error) {
    console.error('Error dispatching order:', error);
    throw error;
  }
}

// Start order fulfillment (at station)
export async function startOrder(orderId: string, orderUid: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await table.updateItem(ORDERS_TABLE_ID, {
      _uid: orderUid,
      _id: orderId,
      status: 'in_progress',
      updatedAt: now
    });
  } catch (error) {
    console.error('Error starting order:', error);
    throw error;
  }
}

// Complete order
export async function completeOrder(orderId: string, orderUid: string, ticketUrl?: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Get order details to award points
    const order = await getOrderById(orderId);
    
    await table.updateItem(ORDERS_TABLE_ID, {
      _uid: orderUid,
      _id: orderId,
      status: 'completed',
      completedAt: now,
      ticketUrl: ticketUrl || '',
      updatedAt: now
    });

    // Award loyalty points for fuel purchase
    if (order) {
      try {
        await awardFuelPurchasePoints(order.customerId, order.totalAmount, orderId);
        // Send notification
        await notificationService.notifyOrderCompleted(order.customerId, orderId, order.totalAmount);
        
        // 🆕 Send completion receipt email (non-blocking)
        try {
          // Get user email from profile
          const USER_PROFILES_TABLE_ID = 'f4eyoj561clc';
          const profileResult = await table.getItems(USER_PROFILES_TABLE_ID, {
            query: { _uid: order.customerId },
            limit: 1
          });
          
          const profile = profileResult?.items?.[0];
          if (profile?.email) {
            const receiptData: FuelOrderReceiptData = {
              orderNumber: order.orderNumber,
              orderDate: new Date(order.createdAt),
              driverName: order.customerName,
              driverPhone: profile.phone,
              vehicleRegistration: order.vehicleRegistration,
              fuelType: order.productName,
              quantity: order.quantity,
              unitPrice: order.unitPrice,
              totalAmount: order.totalAmount,
              validationCode: order.validationCode,
              qrCodeData: order.qrCodeData,
              paymentMethod: 'prepaid',
              stationName: order.stationName,
            };
            
            // Send email asynchronously
            sendFuelOrderReceipt(profile.email, receiptData).catch((err) => {
              console.warn('⚠️ Failed to send completion receipt email:', err);
            });
          }
        } catch (err) {
          console.warn('⚠️ Failed to prepare completion receipt email:', err);
        }
      } catch (error) {
        console.error('Error awarding loyalty points:', error);
        // Don't fail the order completion if points award fails
      }
    }
  } catch (error) {
    console.error('Error completing order:', error);
    throw error;
  }
}

// Cancel order
export async function cancelOrder(orderId: string, orderUid: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await table.updateItem(ORDERS_TABLE_ID, {
      _uid: orderUid,
      _id: orderId,
      status: 'cancelled',
      updatedAt: now
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
}

// Get customer orders
export async function getCustomerOrders(customerId?: string): Promise<Order[]> {
  const userId = customerId || getCurrentUserId();
  return getOrders({ customerId: userId });
}

// Get station orders
export async function getStationOrders(stationId: string): Promise<Order[]> {
  return getOrders({ stationId });
}

// Get pending orders (for dispatch)
export async function getPendingOrders(): Promise<Order[]> {
  return getOrders({ status: 'pending' });
}

// Validate order with code
export async function validateOrderCode(orderId: string, code: string): Promise<boolean> {
  try {
    const order = await getOrderById(orderId);
    return order?.validationCode === code;
  } catch (error) {
    console.error('Error validating order code:', error);
    return false;
  }
}
