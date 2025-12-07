const Order = require('../models/orderModel');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join room based on table ID
    socket.on('join_table', (tableId) => {
      socket.join(`table_${tableId}`);
      console.log(`Socket ${socket.id} joined table_${tableId}`);
    });

    // Leave table room
    socket.on('leave_table', (tableId) => {
      socket.leave(`table_${tableId}`);
    });

    // New order created
    socket.on('new_order', async (orderData) => {
      try {
        const orderId = await Order.createOrder(orderData);
        const newOrder = await Order.getOrderById(orderId);
        
        // Broadcast to kitchen room
        io.to('kitchen').emit('order_created', newOrder);
        
        // Notify the specific table
        io.to(`table_${orderData.table_id}`).emit('order_status', newOrder);
        
        // Broadcast to admin room
        io.to('admin').emit('order_created', newOrder);
        
        console.log(`Order ${orderId} created and broadcasted`);
      } catch (error) {
        console.error('Error creating order via socket:', error);
        socket.emit('order_error', { message: error.message });
      }
    });

    // Order status updated
    socket.on('update_order_status', async (data) => {
      try {
        const { orderId, status, tableId } = data;
        
        // Update in database
        await Order.updateOrderStatus(orderId, status);
        
        // Get updated order
        const updatedOrder = await Order.getOrderById(orderId);
        
        // Notify kitchen and the table
        io.to('kitchen').emit('order_status_updated', updatedOrder);
        io.to(`table_${tableId}`).emit('order_status_updated', updatedOrder);
        io.to('admin').emit('order_status_updated', updatedOrder);
        
        console.log(`Order ${orderId} status updated to ${status}`);
      } catch (error) {
        console.error('Error updating order status:', error);
      }
    });

    // Kitchen joins
    socket.on('join_kitchen', () => {
      socket.join('kitchen');
      console.log('Kitchen client connected');
    });

    // Admin joins
    socket.on('join_admin', () => {
      socket.join('admin');
      console.log('Admin client connected');
    });

    // Staff calls for help
    socket.on('call_staff', ({ tableId, reason }) => {
      io.to('admin').emit('staff_call', {
        table_id: tableId,
        reason,
        timestamp: new Date().toISOString()
      });
      console.log(`Staff called from table ${tableId}: ${reason}`);
    });

    // Customer calls for service
    socket.on('call_service', ({ tableId }) => {
      io.to('admin').emit('customer_call', {
        table_id: tableId,
        timestamp: new Date().toISOString()
      });
      console.log(`Customer called from table ${tableId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};