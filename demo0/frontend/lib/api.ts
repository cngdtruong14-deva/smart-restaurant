import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// API methods
export const apiClient = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  register: (userData: any) =>
    api.post('/auth/register', userData),
  
  // Products
  getProducts: () => api.get('/products'),
  getProduct: (id: number) => api.get(`/products/${id}`),
  
  // Orders
  createOrder: (orderData: any) => 
    api.post('/orders', orderData),
  
  getOrderHistory: (tableId?: number) =>
    api.get('/orders/history', { params: { tableId } }),
  
  // Tables
  getTables: () => api.get('/tables'),
  updateTableStatus: (id: number, status: string) =>
    api.put(`/tables/${id}/status`, { status }),
  
  // QR Codes
  generateQR: (tableId: number) =>
    api.post('/qr/generate', { tableId }),
  
  // AI Recommendations
  getRecommendations: (customerId?: number) =>
    api.get('/ai/recommendations', { params: { customerId } }),
  
  // Dashboard
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getSalesReport: (startDate: string, endDate: string) =>
    api.get('/admin/dashboard/sales', { params: { startDate, endDate } }),
};

export default api;