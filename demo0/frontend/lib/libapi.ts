import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error.message)
  }
)

// API endpoints
export const apiClient = {
  // Tables
  getTables: () => api.get('/api/tables'),
  getTable: (id: string) => api.get(`/api/tables/${id}`),
  createTable: (data: any) => api.post('/api/tables', data),
  updateTable: (id: string, data: any) => api.put(`/api/tables/${id}`, data),
  generateTableQR: (tableId: string, baseUrl?: string) => 
    api.post(`/api/qr/table/${tableId}`, { baseUrl }),

  // Products
  getProducts: () => api.get('/api/products'),
  getProduct: (id: string) => api.get(`/api/products/${id}`),
  getProductsByCategory: (category: string) => 
    api.get(`/api/products/category/${category}`),
  createProduct: (data: any) => api.post('/api/products', data),

  // Orders
  createOrder: (data: any) => api.post('/api/orders', data),
  getOrders: () => api.get('/api/orders'),
  getOrder: (id: string) => api.get(`/api/orders/${id}`),
  getTableOrders: (tableId: string) => 
    api.get(`/api/orders/table/${tableId}`),
  updateOrderStatus: (id: string, status: string) => 
    api.put(`/api/orders/${id}/status`, { status }),

  // Users
  login: (data: { username: string; password: string }) => 
    api.post('/api/users/login', data),
  register: (data: any) => api.post('/api/users/register', data),
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data: any) => api.put('/api/users/profile', data),

  // QR Code
  generateOrderQR: (orderId: string) => 
    api.post(`/api/qr/order/${orderId}`),
  generatePaymentQR: (orderId: string, bankCode: string) => 
    api.post(`/api/qr/payment/${orderId}`, { bank_code: bankCode }),
}

export default api