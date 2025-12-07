-- Tạo database
DROP DATABASE IF EXISTS smart_ordering;
CREATE DATABASE smart_ordering;
USE smart_ordering;

-- Bảng bàn ăn
CREATE TABLE tables (
  id INT PRIMARY KEY AUTO_INCREMENT,
  table_number VARCHAR(10) UNIQUE NOT NULL,
  capacity INT NOT NULL,
  qr_code TEXT,
  status ENUM('available', 'occupied', 'reserved') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng người dùng hệ thống (admin/staff)
-- Users table for staff/admin authentication
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT,
    branch_id INT,
    role_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    profile_image TEXT,
    status ENUM('active', 'inactive', 'locked') DEFAULT 'active',
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    INDEX idx_user_restaurant (restaurant_id),
    INDEX idx_user_email (email),
    INDEX idx_user_status (status)
);

-- Roles table for role-based access control
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role_name (name)
);

-- Audit logs for security monitoring
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_date (created_at DESC)
);

-- Sessions for tracking active logins
CREATE TABLE sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_user (user_id),
    INDEX idx_session_token (token_hash),
    INDEX idx_session_expires (expires_at)
);

-- Branches table (if not exists)
CREATE TABLE IF NOT EXISTS branches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    manager_id INT,
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    opening_hours JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_branch_restaurant (restaurant_id),
    INDEX idx_branch_status (status)
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
('admin', 'Quản trị viên hệ thống', 
 '["view_dashboard", "manage_orders", "manage_menu", "manage_tables", "manage_customers", "manage_staff", "manage_inventory", "view_reports", "manage_settings", "manage_promotions", "manage_reservations", "view_analytics", "export_data", "manage_users", "manage_roles"]', 
 TRUE),
('manager', 'Quản lý nhà hàng', 
 '["view_dashboard", "manage_orders", "manage_menu", "manage_tables", "manage_customers", "manage_staff", "manage_inventory", "view_reports", "manage_promotions", "manage_reservations", "view_analytics"]', 
 TRUE),
('cashier', 'Thu ngân', 
 '["manage_orders", "view_reports", "manage_customers"]', 
 TRUE),
('kitchen', 'Nhân viên bếp', 
 '["manage_orders", "view_dashboard"]', 
 TRUE),
('staff', 'Nhân viên phục vụ', 
 '["manage_orders", "manage_tables", "manage_customers"]', 
 TRUE);

-- Create default admin user (password: Admin123!)
INSERT INTO users (restaurant_id, role_id, name, email, password_hash, status) VALUES
(1, 1, 'Quản trị viên', 'admin@restaurant.com', '$2a$10$YourHashedPasswordHere', 'active');

-- Create index for performance
CREATE INDEX idx_customer_phone ON customers(phone);
CREATE INDEX idx_customer_email ON customers(email);
CREATE INDEX idx_order_created ON orders(created_at DESC);
CREATE INDEX idx_order_customer ON orders(customer_id);
CREATE INDEX idx_product_category ON products(category_id);
CREATE INDEX idx_activity_user ON activity_logs(customer_id);

-- Create view for user permissions
CREATE VIEW user_permissions AS
SELECT 
    u.id as user_id,
    u.email,
    r.name as role_name,
    r.permissions
FROM users u
JOIN roles r ON u.role_id = r.id;

-- Stored procedure for user activity report
DELIMITER $$
CREATE PROCEDURE generate_user_activity_report(
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_restaurant_id INT
)
BEGIN
    SELECT 
        u.name,
        u.email,
        u.role_id,
        COUNT(DISTINCT DATE(a.created_at)) as active_days,
        COUNT(a.id) as total_actions,
        MAX(a.created_at) as last_activity
    FROM users u
    LEFT JOIN audit_logs a ON u.id = a.user_id
    WHERE u.restaurant_id = p_restaurant_id
    AND (a.created_at BETWEEN p_start_date AND p_end_date OR a.id IS NULL)
    GROUP BY u.id
    ORDER BY total_actions DESC;
END$$
DELIMITER ;

-- Function to check user permissions
DELIMITER $$
CREATE FUNCTION has_permission(user_id INT, required_permission VARCHAR(50))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE has_permission BOOLEAN DEFAULT FALSE;
    
    SELECT JSON_CONTAINS(r.permissions, JSON_QUOTE(required_permission))
    INTO has_permission
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = user_id
    AND u.status = 'active';
    
    RETURN COALESCE(has_permission, FALSE);
END$$
DELIMITER ;

-- Bảng sản phẩm
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50),
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng khách hàng
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  segment ENUM('new', 'regular', 'vip', 'churned') DEFAULT 'new',
  total_visits INT DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng đơn hàng
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  table_id INT,
  customer_id INT,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'preparing', 'ready', 'served', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Bảng chi tiết đơn hàng
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Bảng logs hoạt động (cho AI)
CREATE TABLE activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(100),
  customer_id INT,
  product_id INT,
  action_type ENUM('view', 'add_to_cart', 'remove_from_cart', 'order'),
  duration INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Bảng QR thanh toán
CREATE TABLE payment_qr (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  qr_content TEXT,
  qr_image_url TEXT,
  bank_code VARCHAR(20),
  amount DECIMAL(10, 2),
  status ENUM('pending', 'paid', 'expired') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 15 MINUTE),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Staff/Admin users
CREATE TABLE staff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'staff', 'cashier', 'kitchen') DEFAULT 'staff',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    INDEX idx_staff_restaurant (restaurant_id),
    INDEX idx_staff_role (role),
    INDEX idx_staff_email (email)
);

-- Insert dữ liệu mẫu
INSERT INTO tables (table_number, capacity) VALUES
('T01', 4),
('T02', 6),
('T03', 2),
('T04', 8);

-- Insert admin user (mật khẩu: Admin123!)
INSERT INTO users (username, email, password_hash, full_name, role) VALUES 
('admin', 'admin@smartrestaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s7fU0Y4X3X6zJY1Lq7JQ8hqJQzY1W2', 'Quản trị viên', 'admin'),
('manager01', 'manager@smartrestaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s7fU0Y4X3X6zJY1Lq7JQ8hqJQzY1W2', 'Quản lý nhà hàng', 'manager'),
('cashier01', 'cashier@smartrestaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s7fU0Y4X3X6zJY1Lq7JQ8hqJQzY1W2', 'Thu ngân 01', 'cashier'),
('kitchen01', 'kitchen@smartrestaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s7fU0Y4X3X6zJY1Lq7JQ8hqJQzY1W2', 'Bếp trưởng', 'kitchen');

INSERT INTO products (name, description, price, category) VALUES
('Phở Bò', 'Phở bò truyền thống', 65000, 'Món chính'),
('Bún Chả', 'Bún chả Hà Nội', 55000, 'Món chính'),
('Gà Rán', 'Gà rán giòn', 75000, 'Món phụ'),
('Coca Cola', 'Nước ngọt có ga', 20000, 'Đồ uống'),
('Bia Tiger', 'Bia lager', 35000, 'Đồ uống');

-- Tạo các index cho performance
CREATE INDEX idx_table_status ON tables(status);
CREATE INDEX idx_product_category ON products(category);
CREATE INDEX idx_product_available ON products(is_available);
CREATE INDEX idx_order_status ON orders(status);
CREATE INDEX idx_order_created ON orders(created_at DESC);
CREATE INDEX idx_customer_phone ON customers(phone);
CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_user_role ON users(role);