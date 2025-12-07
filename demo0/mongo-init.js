// mongo-init.js
db.createUser({
  user: 'admin',
  pwd: 'admin123',
  roles: [
    {
      role: 'readWrite',
      db: 'smart_restaurant'
    }
  ]
});

db.createCollection('restaurants');
db.createCollection('users');
db.createCollection('orders');

// Create indexes
db.restaurants.createIndex({ location: '2dsphere' });
db.restaurants.createIndex({ name: 'text', description: 'text' });
db.orders.createIndex({ userId: 1, createdAt: -1 });