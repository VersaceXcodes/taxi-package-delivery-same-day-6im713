-- QuickCourier Database Schema Creation and Seeding

-- Create all tables with proper constraints and relationships

-- 1. Users table (core authentication and user management)
CREATE TABLE users (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('sender', 'courier')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    is_verified INTEGER DEFAULT 0 CHECK (is_verified IN (0, 1)),
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    profile_image_url TEXT,
    marketing_opt_in INTEGER DEFAULT 0 CHECK (marketing_opt_in IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- 2. Addresses table (centralized address storage)
CREATE TABLE addresses (
    uid VARCHAR(255) PRIMARY KEY,
    street_address TEXT NOT NULL,
    apartment_unit VARCHAR(50),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(50) NOT NULL DEFAULT 'USA',
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    building_instructions TEXT,
    access_code VARCHAR(50),
    is_residential INTEGER DEFAULT 1 CHECK (is_residential IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Courier profiles table (extended courier information)
CREATE TABLE courier_profiles (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    drivers_license_number VARCHAR(50) NOT NULL,
    drivers_license_image_url TEXT,
    background_check_status VARCHAR(50) DEFAULT 'pending' CHECK (background_check_status IN ('pending', 'approved', 'rejected')),
    background_check_date TIMESTAMP,
    bank_account_number VARCHAR(50),
    bank_routing_number VARCHAR(20),
    verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_notes TEXT,
    approval_date TIMESTAMP,
    total_deliveries INTEGER DEFAULT 0,
    average_rating NUMERIC(3, 2) DEFAULT 0.0,
    total_earnings NUMERIC(10, 2) DEFAULT 0.0,
    is_available INTEGER DEFAULT 0 CHECK (is_available IN (0, 1)),
    current_location_lat NUMERIC(10, 8),
    current_location_lng NUMERIC(11, 8),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Vehicles table (courier vehicle information)
CREATE TABLE vehicles (
    uid VARCHAR(255) PRIMARY KEY,
    courier_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('car', 'motorcycle', 'bicycle', 'scooter')),
    make VARCHAR(50),
    model VARCHAR(50),
    year INTEGER,
    color VARCHAR(30),
    license_plate VARCHAR(20) NOT NULL,
    insurance_policy_number VARCHAR(50),
    insurance_expiry_date DATE,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Saved addresses table (user frequently used addresses)
CREATE TABLE saved_addresses (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    address_id VARCHAR(255) NOT NULL REFERENCES addresses(uid) ON DELETE CASCADE,
    label VARCHAR(100),
    is_default_pickup INTEGER DEFAULT 0 CHECK (is_default_pickup IN (0, 1)),
    is_default_delivery INTEGER DEFAULT 0 CHECK (is_default_delivery IN (0, 1)),
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Delivery orders table (main orders entity)
CREATE TABLE delivery_orders (
    uid VARCHAR(255) PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    sender_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    courier_id VARCHAR(255) REFERENCES users(uid) ON DELETE SET NULL,
    pickup_address_id VARCHAR(255) NOT NULL REFERENCES addresses(uid),
    delivery_address_id VARCHAR(255) NOT NULL REFERENCES addresses(uid),
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'courier_assigned', 'pickup_in_progress', 'in_transit', 'delivered', 'cancelled', 'failed')),
    urgency_level VARCHAR(50) NOT NULL CHECK (urgency_level IN ('asap', '1_hour', '2_hours', '4_hours', 'scheduled')),
    scheduled_pickup_date DATE,
    scheduled_pickup_time TIME,
    pickup_instructions TEXT,
    delivery_instructions TEXT,
    leave_at_door INTEGER DEFAULT 0 CHECK (leave_at_door IN (0, 1)),
    estimated_pickup_time TIMESTAMP,
    estimated_delivery_time TIMESTAMP,
    actual_pickup_time TIMESTAMP,
    actual_delivery_time TIMESTAMP,
    base_price NUMERIC(8, 2) NOT NULL,
    urgency_premium NUMERIC(8, 2) DEFAULT 0,
    size_premium NUMERIC(8, 2) DEFAULT 0,
    special_handling_fee NUMERIC(8, 2) DEFAULT 0,
    service_fee NUMERIC(8, 2) DEFAULT 0,
    tax_amount NUMERIC(8, 2) DEFAULT 0,
    total_amount NUMERIC(8, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'paid', 'refunded', 'failed')),
    courier_earnings NUMERIC(8, 2) DEFAULT 0,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('sender', 'courier', 'system', 'admin')),
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Packages table (package details for orders)
CREATE TABLE packages (
    uid VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES delivery_orders(uid) ON DELETE CASCADE,
    package_type VARCHAR(50) NOT NULL CHECK (package_type IN ('documents', 'electronics', 'clothing', 'food', 'fragile', 'other')),
    size_category VARCHAR(20) NOT NULL CHECK (size_category IN ('small', 'medium', 'large', 'extra_large')),
    estimated_weight NUMERIC(6, 2),
    declared_value NUMERIC(10, 2),
    is_fragile INTEGER DEFAULT 0 CHECK (is_fragile IN (0, 1)),
    special_handling_notes TEXT,
    package_description TEXT,
    pickup_photo_url TEXT,
    delivery_photo_url TEXT,
    package_condition_pickup VARCHAR(20) CHECK (package_condition_pickup IN ('good', 'damaged', 'opened')),
    package_condition_delivery VARCHAR(20) CHECK (package_condition_delivery IN ('good', 'damaged', 'opened')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Order status history table (audit trail for status changes)
CREATE TABLE order_status_history (
    uid VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES delivery_orders(uid) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),
    change_reason TEXT,
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    timestamp TIMESTAMP NOT NULL,
    additional_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Location tracking table (courier location history)
CREATE TABLE location_tracking (
    uid VARCHAR(255) PRIMARY KEY,
    courier_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    order_id VARCHAR(255) REFERENCES delivery_orders(uid) ON DELETE SET NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy NUMERIC(6, 2),
    speed NUMERIC(6, 2),
    heading NUMERIC(5, 2),
    timestamp TIMESTAMP NOT NULL,
    battery_level INTEGER,
    is_active_delivery INTEGER DEFAULT 0 CHECK (is_active_delivery IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Courier availability table (availability status)
CREATE TABLE courier_availability (
    uid VARCHAR(255) PRIMARY KEY,
    courier_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    is_available INTEGER NOT NULL CHECK (is_available IN (0, 1)),
    availability_status VARCHAR(20) NOT NULL CHECK (availability_status IN ('online', 'offline', 'on_break', 'in_delivery')),
    break_duration_minutes INTEGER,
    break_start_time TIMESTAMP,
    shift_start_time TIMESTAMP,
    shift_end_time TIMESTAMP,
    max_concurrent_orders INTEGER DEFAULT 1,
    current_active_orders INTEGER DEFAULT 0,
    last_location_lat NUMERIC(10, 8),
    last_location_lng NUMERIC(11, 8),
    last_update TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Payment methods table (stored payment methods)
CREATE TABLE payment_methods (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    payment_type VARCHAR(30) NOT NULL CHECK (payment_type IN ('credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay')),
    card_last_four VARCHAR(4),
    card_brand VARCHAR(20) CHECK (card_brand IN ('visa', 'mastercard', 'amex', 'discover')),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    billing_address_id VARCHAR(255) REFERENCES addresses(uid),
    gateway_customer_id VARCHAR(100),
    gateway_payment_method_id VARCHAR(100),
    is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Payments table (payment transaction records)
CREATE TABLE payments (
    uid VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES delivery_orders(uid) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    payment_method_id VARCHAR(255) REFERENCES payment_methods(uid) ON DELETE SET NULL,
    transaction_id VARCHAR(100) UNIQUE,
    payment_gateway VARCHAR(30) NOT NULL CHECK (payment_gateway IN ('stripe', 'paypal', 'square')),
    payment_type VARCHAR(30) NOT NULL CHECK (payment_type IN ('card', 'digital_wallet', 'corporate_account')),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    gateway_response JSONB,
    failure_reason TEXT,
    processed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    refund_amount NUMERIC(10, 2) DEFAULT 0,
    refund_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Corporate accounts table (business billing accounts)
CREATE TABLE corporate_accounts (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    company_name VARCHAR(200) NOT NULL,
    billing_address_id VARCHAR(255) NOT NULL REFERENCES addresses(uid),
    tax_id VARCHAR(50),
    billing_contact_name VARCHAR(100),
    billing_contact_email VARCHAR(255),
    billing_contact_phone VARCHAR(20),
    payment_terms VARCHAR(20) DEFAULT 'net_30' CHECK (payment_terms IN ('net_15', 'net_30', 'net_45')),
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    current_balance NUMERIC(12, 2) DEFAULT 0,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Messages table (in-app messaging)
CREATE TABLE messages (
    uid VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES delivery_orders(uid) ON DELETE CASCADE,
    sender_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    recipient_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'image', 'quick_template', 'system')),
    message_content TEXT NOT NULL,
    image_url TEXT,
    template_type VARCHAR(30) CHECK (template_type IN ('im_here', 'running_late', 'please_call')),
    is_read INTEGER DEFAULT 0 CHECK (is_read IN (0, 1)),
    read_at TIMESTAMP,
    sent_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Notifications table (system notifications)
CREATE TABLE notifications (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    order_id VARCHAR(255) REFERENCES delivery_orders(uid) ON DELETE SET NULL,
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('order_update', 'message', 'payment', 'system', 'marketing')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'sms', 'email', 'push')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read INTEGER DEFAULT 0 CHECK (is_read IN (0, 1)),
    read_at TIMESTAMP,
    sent_at TIMESTAMP NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    delivery_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. Notification preferences table (user notification settings)
CREATE TABLE notification_preferences (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('order_updates', 'messages', 'marketing', 'security')),
    in_app_enabled INTEGER DEFAULT 1 CHECK (in_app_enabled IN (0, 1)),
    sms_enabled INTEGER DEFAULT 1 CHECK (sms_enabled IN (0, 1)),
    email_enabled INTEGER DEFAULT 1 CHECK (email_enabled IN (0, 1)),
    push_enabled INTEGER DEFAULT 1 CHECK (push_enabled IN (0, 1)),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. Ratings table (rating and review system)
CREATE TABLE ratings (
    uid VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES delivery_orders(uid) ON DELETE CASCADE,
    rater_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    rated_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    rating_type VARCHAR(30) NOT NULL CHECK (rating_type IN ('sender_to_courier', 'courier_to_sender')),
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    professionalism_rating INTEGER CHECK (professionalism_rating BETWEEN 1 AND 5),
    speed_rating INTEGER CHECK (speed_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    package_handling_rating INTEGER CHECK (package_handling_rating BETWEEN 1 AND 5),
    written_feedback TEXT,
    is_anonymous INTEGER DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
    is_public INTEGER DEFAULT 1 CHECK (is_public IN (0, 1)),
    helpful_votes INTEGER DEFAULT 0,
    reported_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. Rating images table (images attached to ratings)
CREATE TABLE rating_images (
    uid VARCHAR(255) PRIMARY KEY,
    rating_id VARCHAR(255) NOT NULL REFERENCES ratings(uid) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(20) NOT NULL CHECK (image_type IN ('damage', 'delivery_proof', 'general')),
    caption TEXT,
    uploaded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. Pricing rules table (dynamic pricing configuration)
CREATE TABLE pricing_rules (
    uid VARCHAR(255) PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('base_rate', 'distance_multiplier', 'size_premium', 'urgency_premium', 'surge_pricing')),
    service_area VARCHAR(100),
    base_amount NUMERIC(8, 2),
    per_km_rate NUMERIC(6, 2),
    size_multipliers JSONB,
    urgency_multipliers JSONB,
    time_based_multipliers JSONB,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    effective_from TIMESTAMP NOT NULL,
    effective_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. Service areas table (operational boundaries)
CREATE TABLE service_areas (
    uid VARCHAR(255) PRIMARY KEY,
    area_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    country VARCHAR(50) NOT NULL,
    boundary_coordinates JSONB,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    max_delivery_distance_km INTEGER DEFAULT 50,
    estimated_delivery_time_minutes INTEGER DEFAULT 60,
    surge_pricing_enabled INTEGER DEFAULT 1 CHECK (surge_pricing_enabled IN (0, 1)),
    operating_hours_start TIME,
    operating_hours_end TIME,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. Order assignments table (courier assignment tracking)
CREATE TABLE order_assignments (
    uid VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES delivery_orders(uid) ON DELETE CASCADE,
    courier_id VARCHAR(255) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    assignment_type VARCHAR(30) NOT NULL CHECK (assignment_type IN ('auto_match', 'manual_assign', 'courier_accepted', 'reassigned')),
    assignment_status VARCHAR(20) DEFAULT 'pending' CHECK (assignment_status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    offered_at TIMESTAMP NOT NULL,
    response_deadline TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    declined_at TIMESTAMP,
    decline_reason TEXT,
    courier_distance_km NUMERIC(6, 2),
    estimated_pickup_time INTEGER,
    assignment_priority INTEGER DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. System settings table (global configuration)
CREATE TABLE system_settings (
    uid VARCHAR(255) PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public INTEGER DEFAULT 0 CHECK (is_public IN (0, 1)),
    updated_by VARCHAR(255) REFERENCES users(uid),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. Audit logs table (system activity audit trail)
CREATE TABLE audit_logs (
    uid VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(uid) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('order', 'user', 'payment', 'system')),
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_courier_profiles_user_id ON courier_profiles(user_id);
CREATE INDEX idx_courier_profiles_available ON courier_profiles(is_available);
CREATE INDEX idx_delivery_orders_sender ON delivery_orders(sender_id);
CREATE INDEX idx_delivery_orders_courier ON delivery_orders(courier_id);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX idx_delivery_orders_created ON delivery_orders(created_at);
CREATE INDEX idx_location_tracking_courier ON location_tracking(courier_id, timestamp);
CREATE INDEX idx_messages_order ON messages(order_id, sent_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_ratings_order ON ratings(order_id);

-- SEED DATA
-- Insert seed users (both senders and couriers)
INSERT INTO users (uid, email, password_hash, user_type, first_name, last_name, phone_number, is_verified, is_active, profile_image_url, marketing_opt_in, created_at, updated_at) VALUES
('user_001', 'john.sender@example.com', '$2b$10$hashedpassword1', 'sender', 'John', 'Smith', '+1234567890', 1, 1, 'https://picsum.photos/seed/user001/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_002', 'sarah.sender@example.com', '$2b$10$hashedpassword2', 'sender', 'Sarah', 'Johnson', '+1234567891', 1, 1, 'https://picsum.photos/seed/user002/200/200', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_003', 'mike.courier@example.com', '$2b$10$hashedpassword3', 'courier', 'Mike', 'Wilson', '+1234567892', 1, 1, 'https://picsum.photos/seed/user003/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_004', 'anna.courier@example.com', '$2b$10$hashedpassword4', 'courier', 'Anna', 'Davis', '+1234567893', 1, 1, 'https://picsum.photos/seed/user004/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_005', 'david.sender@example.com', '$2b$10$hashedpassword5', 'sender', 'David', 'Brown', '+1234567894', 1, 1, 'https://picsum.photos/seed/user005/200/200', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_006', 'lisa.courier@example.com', '$2b$10$hashedpassword6', 'courier', 'Lisa', 'Garcia', '+1234567895', 1, 1, 'https://picsum.photos/seed/user006/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_007', 'robert.sender@example.com', '$2b$10$hashedpassword7', 'sender', 'Robert', 'Miller', '+1234567896', 1, 1, 'https://picsum.photos/seed/user007/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_008', 'emily.courier@example.com', '$2b$10$hashedpassword8', 'courier', 'Emily', 'Martinez', '+1234567897', 1, 1, 'https://picsum.photos/seed/user008/200/200', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_009', 'james.sender@example.com', '$2b$10$hashedpassword9', 'sender', 'James', 'Anderson', '+1234567898', 1, 1, 'https://picsum.photos/seed/user009/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_010', 'alex.courier@example.com', '$2b$10$hashedpassword10', 'courier', 'Alex', 'Thompson', '+1234567899', 1, 1, 'https://picsum.photos/seed/user010/200/200', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert addresses
INSERT INTO addresses (uid, street_address, apartment_unit, city, state, postal_code, country, latitude, longitude, building_instructions, access_code, is_residential) VALUES
('addr_001', '123 Main Street', 'Apt 4B', 'New York', 'NY', '10001', 'USA', 40.7589, -73.9851, 'Blue building with red door', '1234', 1),
('addr_002', '456 Broadway', 'Suite 12', 'New York', 'NY', '10013', 'USA', 40.7205, -74.0089, 'Glass office building', NULL, 0),
('addr_003', '789 Central Park West', NULL, 'New York', 'NY', '10024', 'USA', 40.7812, -73.9665, 'Doorman building', NULL, 1),
('addr_004', '321 Wall Street', 'Floor 15', 'New York', 'NY', '10005', 'USA', 40.7074, -74.0113, 'Financial district tower', '9876', 0),
('addr_005', '654 5th Avenue', NULL, 'New York', 'NY', '10019', 'USA', 40.7527, -73.9772, 'Corner building near park', NULL, 1),
('addr_006', '987 Houston Street', 'Apt 2A', 'New York', 'NY', '10012', 'USA', 40.7255, -73.9940, 'Red brick building', '5555', 1),
('addr_007', '147 Madison Avenue', 'Suite 8', 'New York', 'NY', '10016', 'USA', 40.7452, -73.9843, 'Modern office complex', NULL, 0),
('addr_008', '258 Park Avenue', NULL, 'New York', 'NY', '10017', 'USA', 40.7516, -73.9755, 'Luxury residential tower', NULL, 1),
('addr_009', '369 Lexington Avenue', 'Unit 3C', 'New York', 'NY', '10017', 'USA', 40.7505, -73.9751, 'Historic brownstone', '7777', 1),
('addr_010', '741 Broadway', 'Floor 2', 'New York', 'NY', '10003', 'USA', 40.7306, -73.9912, 'Creative district loft', NULL, 0);

-- Insert courier profiles
INSERT INTO courier_profiles (uid, user_id, drivers_license_number, drivers_license_image_url, background_check_status, background_check_date, bank_account_number, bank_routing_number, verification_status, approval_date, total_deliveries, average_rating, total_earnings, is_available, current_location_lat, current_location_lng, last_location_update, created_at, updated_at) VALUES
('cp_001', 'user_003', 'DL123456789', 'https://picsum.photos/seed/license001/400/300', 'approved', CURRENT_TIMESTAMP - INTERVAL '30 days', '1234567890', '021000021', 'verified', CURRENT_TIMESTAMP - INTERVAL '25 days', 47, 4.8, 2350.75, 1, 40.7589, -73.9851, CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP),
('cp_002', 'user_004', 'DL987654321', 'https://picsum.photos/seed/license002/400/300', 'approved', CURRENT_TIMESTAMP - INTERVAL '25 days', '0987654321', '021000021', 'verified', CURRENT_TIMESTAMP - INTERVAL '20 days', 32, 4.6, 1680.50, 1, 40.7205, -74.0089, CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP),
('cp_003', 'user_006', 'DL555666777', 'https://picsum.photos/seed/license003/400/300', 'approved', CURRENT_TIMESTAMP - INTERVAL '20 days', '5555666777', '021000021', 'verified', CURRENT_TIMESTAMP - INTERVAL '15 days', 28, 4.9, 1540.25, 0, 40.7812, -73.9665, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP),
('cp_004', 'user_008', 'DL888999000', 'https://picsum.photos/seed/license004/400/300', 'approved', CURRENT_TIMESTAMP - INTERVAL '15 days', '8889990000', '021000021', 'verified', CURRENT_TIMESTAMP - INTERVAL '10 days', 15, 4.7, 825.00, 1, 40.7074, -74.0113, CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP),
('cp_005', 'user_010', 'DL111222333', 'https://picsum.photos/seed/license005/400/300', 'approved', CURRENT_TIMESTAMP - INTERVAL '10 days', '1112223333', '021000021', 'verified', CURRENT_TIMESTAMP - INTERVAL '5 days', 8, 4.5, 440.00, 1, 40.7527, -73.9772, CURRENT_TIMESTAMP - INTERVAL '7 minutes', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP);

-- Insert vehicles
INSERT INTO vehicles (uid, courier_id, vehicle_type, make, model, year, color, license_plate, insurance_policy_number, insurance_expiry_date, is_active, created_at, updated_at) VALUES
('veh_001', 'user_003', 'car', 'Honda', 'Civic', 2020, 'Blue', 'ABC123', 'INS001234567', '2024-12-31', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('veh_002', 'user_004', 'motorcycle', 'Yamaha', 'MT-07', 2021, 'Black', 'DEF456', 'INS002345678', '2024-11-30', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('veh_003', 'user_006', 'car', 'Toyota', 'Camry', 2019, 'White', 'GHI789', 'INS003456789', '2024-10-31', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('veh_004', 'user_008', 'scooter', 'Vespa', 'Primavera', 2022, 'Red', 'JKL012', 'INS004567890', '2025-01-31', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('veh_005', 'user_010', 'bicycle', 'Trek', 'FX 3', 2023, 'Green', 'MNO345', NULL, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert saved addresses
INSERT INTO saved_addresses (uid, user_id, address_id, label, is_default_pickup, is_default_delivery, use_count, created_at, updated_at) VALUES
('sa_001', 'user_001', 'addr_001', 'Home', 1, 1, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sa_002', 'user_001', 'addr_002', 'Office', 1, 0, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sa_003', 'user_002', 'addr_003', 'Home', 1, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sa_004', 'user_005', 'addr_004', 'Work', 1, 0, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sa_005', 'user_007', 'addr_005', 'Home', 1, 1, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sa_006', 'user_009', 'addr_006', 'Apartment', 1, 1, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert delivery orders
INSERT INTO delivery_orders (uid, order_number, sender_id, courier_id, pickup_address_id, delivery_address_id, recipient_name, recipient_phone, status, urgency_level, pickup_instructions, delivery_instructions, leave_at_door, base_price, urgency_premium, size_premium, service_fee, tax_amount, total_amount, payment_status, courier_earnings, created_at, updated_at) VALUES
('order_001', 'QC202401001', 'user_001', 'user_003', 'addr_001', 'addr_002', 'John Doe', '+1555123456', 'delivered', 'asap', 'Ring doorbell twice', 'Leave with reception', 0, 25.00, 12.50, 0.00, 3.75, 3.29, 44.54, 'paid', 18.75, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('order_002', 'QC202401002', 'user_002', 'user_004', 'addr_003', 'addr_004', 'Jane Smith', '+1555234567', 'in_transit', '1_hour', 'Call when arrived', 'Security desk on 15th floor', 0, 18.00, 4.50, 2.00, 2.70, 2.14, 29.34, 'paid', 12.15, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
('order_003', 'QC202401003', 'user_005', 'user_006', 'addr_004', 'addr_005', 'Bob Johnson', '+1555345678', 'delivered', '2_hours', 'Use service elevator', 'Doorman will accept', 0, 22.00, 2.20, 5.00, 3.30, 2.59, 35.09, 'paid', 15.75, CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP),
('order_004', 'QC202401004', 'user_007', 'user_008', 'addr_005', 'addr_006', 'Alice Wilson', '+1555456789', 'pickup_in_progress', 'asap', 'Apartment 2A buzzer', 'Leave if no answer', 1, 20.00, 10.00, 0.00, 3.00, 2.64, 35.64, 'paid', 16.50, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP),
('order_005', 'QC202401005', 'user_009', 'user_010', 'addr_006', 'addr_007', 'Tom Brown', '+1555567890', 'courier_assigned', '4_hours', 'Building entrance on side', 'Suite 8, ask for Tom', 0, 15.00, 0.00, 0.00, 2.25, 1.38, 18.63, 'paid', 9.00, CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP),
('order_006', 'QC202401006', 'user_001', NULL, 'addr_001', 'addr_008', 'Sarah Davis', '+1555678901', 'pending', 'asap', 'Ring bell three times', 'Concierge will sign', 0, 28.00, 14.00, 3.00, 4.20, 3.94, 53.14, 'pending', 0.00, CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP),
('order_007', 'QC202401007', 'user_002', 'user_003', 'addr_003', 'addr_009', 'Mike Garcia', '+1555789012', 'delivered', 'scheduled', 'Morning delivery only', 'Unit 3C, use access code', 0, 16.00, 0.00, 1.00, 2.40, 1.55, 20.95, 'paid', 10.80, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP),
('order_008', 'QC202401008', 'user_005', 'user_004', 'addr_004', 'addr_010', 'Lisa Miller', '+1555890123', 'delivered', '1_hour', 'Financial district pickup', 'Creative loft, Floor 2', 0, 24.00, 6.00, 0.00, 3.60, 2.69, 36.29, 'paid', 16.20, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP);

-- Insert packages
INSERT INTO packages (uid, order_id, package_type, size_category, estimated_weight, declared_value, is_fragile, special_handling_notes, package_description, pickup_photo_url, delivery_photo_url, package_condition_pickup, package_condition_delivery, created_at, updated_at) VALUES
('pkg_001', 'order_001', 'documents', 'small', 0.5, 100.00, 0, 'Keep dry', 'Legal documents in envelope', 'https://picsum.photos/seed/pickup001/400/300', 'https://picsum.photos/seed/delivery001/400/300', 'good', 'good', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('pkg_002', 'order_002', 'electronics', 'medium', 2.5, 500.00, 1, 'Handle with care', 'Laptop computer in original box', 'https://picsum.photos/seed/pickup002/400/300', NULL, 'good', NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
('pkg_003', 'order_003', 'clothing', 'large', 1.8, 200.00, 0, NULL, 'Designer dress in garment bag', 'https://picsum.photos/seed/pickup003/400/300', 'https://picsum.photos/seed/delivery003/400/300', 'good', 'good', CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP),
('pkg_004', 'order_004', 'food', 'small', 1.2, 50.00, 0, 'Keep upright', 'Birthday cake from bakery', 'https://picsum.photos/seed/pickup004/400/300', NULL, 'good', NULL, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP),
('pkg_005', 'order_005', 'other', 'medium', 3.0, 150.00, 0, NULL, 'Art supplies and canvases', 'https://picsum.photos/seed/pickup005/400/300', NULL, 'good', NULL, CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP),
('pkg_006', 'order_006', 'fragile', 'small', 0.8, 300.00, 1, 'Extremely fragile - antique', 'Vintage crystal vase', 'https://picsum.photos/seed/pickup006/400/300', NULL, 'good', NULL, CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP),
('pkg_007', 'order_007', 'documents', 'small', 0.3, 25.00, 0, NULL, 'Contract papers', 'https://picsum.photos/seed/pickup007/400/300', 'https://picsum.photos/seed/delivery007/400/300', 'good', 'good', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP),
('pkg_008', 'order_008', 'electronics', 'medium', 1.5, 800.00, 1, 'New smartphone', 'iPhone in sealed box', 'https://picsum.photos/seed/pickup008/400/300', 'https://picsum.photos/seed/delivery008/400/300', 'good', 'good', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP);

-- Insert courier availability
INSERT INTO courier_availability (uid, courier_id, is_available, availability_status, max_concurrent_orders, current_active_orders, last_location_lat, last_location_lng, last_update, created_at, updated_at) VALUES
('ca_001', 'user_003', 1, 'in_delivery', 2, 1, 40.7589, -73.9851, CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ca_002', 'user_004', 1, 'in_delivery', 1, 1, 40.7205, -74.0089, CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ca_003', 'user_006', 0, 'offline', 1, 0, 40.7812, -73.9665, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ca_004', 'user_008', 1, 'in_delivery', 1, 1, 40.7074, -74.0113, CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ca_005', 'user_010', 1, 'in_delivery', 1, 1, 40.7527, -73.9772, CURRENT_TIMESTAMP - INTERVAL '7 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert payment methods
INSERT INTO payment_methods (uid, user_id, payment_type, card_last_four, card_brand, card_exp_month, card_exp_year, billing_address_id, gateway_customer_id, gateway_payment_method_id, is_default, is_active, created_at, updated_at) VALUES
('pm_001', 'user_001', 'credit_card', '1234', 'visa', 12, 2026, 'addr_001', 'cus_stripe001', 'pm_stripe001', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_002', 'user_002', 'credit_card', '5678', 'mastercard', 6, 2025, 'addr_003', 'cus_stripe002', 'pm_stripe002', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_003', 'user_005', 'debit_card', '9012', 'visa', 3, 2027, 'addr_004', 'cus_stripe003', 'pm_stripe003', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_004', 'user_007', 'credit_card', '3456', 'amex', 9, 2025, 'addr_005', 'cus_stripe004', 'pm_stripe004', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_005', 'user_009', 'credit_card', '7890', 'mastercard', 11, 2026, 'addr_006', 'cus_stripe005', 'pm_stripe005', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert payments
INSERT INTO payments (uid, order_id, user_id, payment_method_id, transaction_id, payment_gateway, payment_type, amount, currency, status, gateway_response, processed_at, created_at, updated_at) VALUES
('pay_001', 'order_001', 'user_001', 'pm_001', 'txn_stripe001', 'stripe', 'card', 44.54, 'USD', 'completed', '{"charge_id": "ch_stripe001", "status": "succeeded"}', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('pay_002', 'order_002', 'user_002', 'pm_002', 'txn_stripe002', 'stripe', 'card', 29.34, 'USD', 'completed', '{"charge_id": "ch_stripe002", "status": "succeeded"}', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
('pay_003', 'order_003', 'user_005', 'pm_003', 'txn_stripe003', 'stripe', 'card', 35.09, 'USD', 'completed', '{"charge_id": "ch_stripe003", "status": "succeeded"}', CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP),
('pay_004', 'order_004', 'user_007', 'pm_004', 'txn_stripe004', 'stripe', 'card', 35.64, 'USD', 'completed', '{"charge_id": "ch_stripe004", "status": "succeeded"}', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP),
('pay_005', 'order_005', 'user_009', 'pm_005', 'txn_stripe005', 'stripe', 'card', 18.63, 'USD', 'completed', '{"charge_id": "ch_stripe005", "status": "succeeded"}', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP);

-- Insert order status history
INSERT INTO order_status_history (uid, order_id, previous_status, new_status, changed_by, change_reason, location_lat, location_lng, timestamp, additional_notes, created_at) VALUES
('osh_001', 'order_001', NULL, 'pending', 'user_001', 'Order created', 40.7589, -73.9851, CURRENT_TIMESTAMP - INTERVAL '2 days', 'Customer placed order', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('osh_002', 'order_001', 'pending', 'courier_assigned', 'system', 'Auto-assigned to courier', 40.7589, -73.9851, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '5 minutes', 'Matched with available courier', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('osh_003', 'order_001', 'courier_assigned', 'pickup_in_progress', 'user_003', 'Courier en route to pickup', 40.7589, -73.9851, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 minutes', 'Courier started pickup', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('osh_004', 'order_001', 'pickup_in_progress', 'in_transit', 'user_003', 'Package picked up', 40.7589, -73.9851, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '25 minutes', 'Package secured and in transit', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('osh_005', 'order_001', 'in_transit', 'delivered', 'user_003', 'Package delivered successfully', 40.7205, -74.0089, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '45 minutes', 'Delivered to reception desk', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('osh_006', 'order_002', NULL, 'pending', 'user_002', 'Order created', 40.7812, -73.9665, CURRENT_TIMESTAMP - INTERVAL '1 day', 'Urgent laptop delivery', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('osh_007', 'order_002', 'pending', 'courier_assigned', 'system', 'Auto-assigned to courier', 40.7812, -73.9665, CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '3 minutes', 'Courier accepted assignment', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('osh_008', 'order_002', 'courier_assigned', 'pickup_in_progress', 'user_004', 'Courier heading to pickup', 40.7812, -73.9665, CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '10 minutes', 'On motorcycle for faster delivery', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('osh_009', 'order_002', 'pickup_in_progress', 'in_transit', 'user_004', 'Electronics package secured', 40.7812, -73.9665, CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '20 minutes', 'Special handling for fragile item', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Insert location tracking data
INSERT INTO location_tracking (uid, courier_id, order_id, latitude, longitude, accuracy, speed, heading, timestamp, battery_level, is_active_delivery, created_at) VALUES
('lt_001', 'user_003', 'order_004', 40.7580, -73.9840, 5.0, 25.5, 45.0, CURRENT_TIMESTAMP - INTERVAL '5 minutes', 85, 1, CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
('lt_002', 'user_003', 'order_004', 40.7570, -73.9830, 4.8, 30.2, 50.0, CURRENT_TIMESTAMP - INTERVAL '4 minutes', 84, 1, CURRENT_TIMESTAMP - INTERVAL '4 minutes'),
('lt_003', 'user_004', 'order_002', 40.7200, -74.0080, 3.2, 45.8, 120.0, CURRENT_TIMESTAMP - INTERVAL '3 minutes', 92, 1, CURRENT_TIMESTAMP - INTERVAL '3 minutes'),
('lt_004', 'user_004', 'order_002', 40.7190, -74.0070, 3.5, 40.1, 115.0, CURRENT_TIMESTAMP - INTERVAL '2 minutes', 91, 1, CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
('lt_005', 'user_008', 'order_004', 40.7520, -73.9760, 6.1, 15.3, 90.0, CURRENT_TIMESTAMP - INTERVAL '1 minute', 78, 1, CURRENT_TIMESTAMP - INTERVAL '1 minute'),
('lt_006', 'user_010', 'order_005', 40.7300, -73.9900, 8.2, 18.7, 180.0, CURRENT_TIMESTAMP - INTERVAL '7 minutes', 65, 1, CURRENT_TIMESTAMP - INTERVAL '7 minutes'),
('lt_007', 'user_010', 'order_005', 40.7310, -73.9890, 7.8, 20.1, 175.0, CURRENT_TIMESTAMP - INTERVAL '6 minutes', 64, 1, CURRENT_TIMESTAMP - INTERVAL '6 minutes');

-- Insert messages
INSERT INTO messages (uid, order_id, sender_id, recipient_id, message_type, message_content, template_type, is_read, read_at, sent_at, created_at) VALUES
('msg_001', 'order_002', 'user_004', 'user_002', 'quick_template', 'I''m here for pickup!', 'im_here', 1, CURRENT_TIMESTAMP - INTERVAL '55 minutes', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('msg_002', 'order_002', 'user_002', 'user_004', 'text', 'Great! I''ll be right down with the laptop.', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '50 minutes', CURRENT_TIMESTAMP - INTERVAL '58 minutes', CURRENT_TIMESTAMP - INTERVAL '58 minutes'),
('msg_003', 'order_004', 'user_008', 'user_007', 'quick_template', 'Running 5 minutes late due to traffic', 'running_late', 1, CURRENT_TIMESTAMP - INTERVAL '25 minutes', CURRENT_TIMESTAMP - INTERVAL '35 minutes', CURRENT_TIMESTAMP - INTERVAL '35 minutes'),
('msg_004', 'order_004', 'user_007', 'user_008', 'text', 'No problem, I''ll wait. The cake is ready.', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '33 minutes', CURRENT_TIMESTAMP - INTERVAL '33 minutes'),
('msg_005', 'order_005', 'user_010', 'user_009', 'text', 'Hi! I''m your courier Alex. On my way to pickup your art supplies.', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '15 minutes');

-- Insert notifications
INSERT INTO notifications (uid, user_id, order_id, notification_type, channel, title, message, is_read, read_at, sent_at, delivery_status, created_at, updated_at) VALUES
('not_001', 'user_001', 'order_001', 'order_update', 'push', 'Order Delivered!', 'Your order #QC202401001 has been successfully delivered.', 1, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '45 minutes', 'delivered', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('not_002', 'user_002', 'order_002', 'order_update', 'in_app', 'Courier Assigned', 'Anna has been assigned to your order and is on the way!', 1, CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '3 minutes', 'delivered', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
('not_003', 'user_003', 'order_001', 'payment', 'sms', 'Payment Received', 'You''ve earned $18.75 for order #QC202401001. Payment processed.', 1, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', 'delivered', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('not_004', 'user_007', 'order_004', 'message', 'push', 'New Message', 'Your courier sent you a message about your delivery.', 0, NULL, CURRENT_TIMESTAMP - INTERVAL '35 minutes', 'delivered', CURRENT_TIMESTAMP - INTERVAL '35 minutes', CURRENT_TIMESTAMP),
('not_005', 'user_009', 'order_005', 'order_update', 'email', 'Courier En Route', 'Alex is on the way to pick up your package.', 1, CURRENT_TIMESTAMP - INTERVAL '12 minutes', CURRENT_TIMESTAMP - INTERVAL '15 minutes', 'delivered', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP);

-- Insert notification preferences
INSERT INTO notification_preferences (uid, user_id, notification_type, in_app_enabled, sms_enabled, email_enabled, push_enabled, quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at) VALUES
('np_001', 'user_001', 'order_updates', 1, 1, 1, 1, '22:00:00', '07:00:00', 'America/New_York', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('np_002', 'user_001', 'messages', 1, 1, 0, 1, '22:00:00', '07:00:00', 'America/New_York', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('np_003', 'user_002', 'order_updates', 1, 0, 1, 1, '23:00:00', '06:00:00', 'America/New_York', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('np_004', 'user_003', 'order_updates', 1, 1, 1, 1, NULL, NULL, 'America/New_York', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('np_005', 'user_005', 'marketing', 0, 0, 0, 0, '21:00:00', '08:00:00', 'America/New_York', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert ratings
INSERT INTO ratings (uid, order_id, rater_id, rated_id, rating_type, overall_rating, professionalism_rating, speed_rating, communication_rating, package_handling_rating, written_feedback, is_anonymous, is_public, helpful_votes, created_at, updated_at) VALUES
('rat_001', 'order_001', 'user_001', 'user_003', 'sender_to_courier', 5, 5, 5, 5, 5, 'Mike was absolutely fantastic! Super professional, communicated well, and delivered exactly on time. Highly recommend!', 0, 1, 12, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 hours', CURRENT_TIMESTAMP),
('rat_002', 'order_001', 'user_003', 'user_001', 'courier_to_sender', 5, 5, 5, 5, 5, 'Great customer! Clear instructions, package ready on time, very polite. Pleasure to work with.', 0, 1, 3, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 hours', CURRENT_TIMESTAMP),
('rat_003', 'order_003', 'user_005', 'user_006', 'sender_to_courier', 5, 5, 4, 5, 5, 'Lisa did an excellent job with the dress delivery. Very careful handling and great communication throughout.', 0, 1, 8, CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP),
('rat_004', 'order_003', 'user_006', 'user_005', 'courier_to_sender', 4, 4, 4, 4, 4, 'Nice customer, package was well prepared. Address was a bit hard to find but overall good experience.', 0, 1, 2, CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP),
('rat_005', 'order_007', 'user_002', 'user_003', 'sender_to_courier', 4, 4, 5, 4, 4, 'Mike is reliable and fast. Documents arrived safely and on time. Minor communication delay but otherwise great service.', 0, 1, 5, CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 hours', CURRENT_TIMESTAMP);

-- Insert rating images
INSERT INTO rating_images (uid, rating_id, image_url, image_type, caption, uploaded_at, created_at) VALUES
('ri_001', 'rat_001', 'https://picsum.photos/seed/rating001/400/300', 'delivery_proof', 'Package delivered safely to reception desk', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 hours'),
('ri_002', 'rat_003', 'https://picsum.photos/seed/rating002/400/300', 'delivery_proof', 'Dress delivered in perfect condition', CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '5 hours');

-- Insert pricing rules
INSERT INTO pricing_rules (uid, rule_name, rule_type, service_area, base_amount, per_km_rate, size_multipliers, urgency_multipliers, time_based_multipliers, is_active, effective_from, effective_until, created_at, updated_at) VALUES
('pr_001', 'Base NYC Rate', 'base_rate', 'New York City', 15.00, 2.50, '{"small": 1.0, "medium": 1.2, "large": 1.5, "extra_large": 2.0}', '{"asap": 2.0, "1_hour": 1.5, "2_hours": 1.2, "4_hours": 1.0, "scheduled": 0.9}', '{"peak_hours": 1.3, "weekend": 1.1}', 1, CURRENT_TIMESTAMP - INTERVAL '30 days', NULL, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP),
('pr_002', 'Holiday Surge', 'surge_pricing', 'New York City', 0.00, 0.00, '{}', '{}', '{"holiday": 1.8, "peak_hours": 1.5}', 0, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP);

-- Insert service areas
INSERT INTO service_areas (uid, area_name, city, state, country, boundary_coordinates, is_active, max_delivery_distance_km, estimated_delivery_time_minutes, surge_pricing_enabled, operating_hours_start, operating_hours_end, created_at, updated_at) VALUES
('sa_001', 'Manhattan Core', 'New York', 'NY', 'USA', '{"type": "polygon", "coordinates": [[[40.7589, -73.9851], [40.7812, -73.9665], [40.7074, -74.0113], [40.7205, -74.0089]]]}', 1, 25, 45, 1, '06:00:00', '23:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sa_002', 'Brooklyn Heights', 'Brooklyn', 'NY', 'USA', '{"type": "polygon", "coordinates": [[[40.6962, -73.9961], [40.7081, -73.9936], [40.6911, -74.0084], [40.6892, -74.0018]]]}', 1, 30, 60, 1, '07:00:00', '22:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert order assignments
INSERT INTO order_assignments (uid, order_id, courier_id, assignment_type, assignment_status, offered_at, response_deadline, accepted_at, courier_distance_km, estimated_pickup_time, assignment_priority, created_at, updated_at) VALUES
('oa_001', 'order_001', 'user_003', 'auto_match', 'accepted', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 minutes', 1.2, 8, 1, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('oa_002', 'order_002', 'user_004', 'auto_match', 'accepted', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '1 minute', 0.8, 5, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
('oa_003', 'order_003', 'user_006', 'courier_accepted', 'accepted', CURRENT_TIMESTAMP - INTERVAL '6 hours' + INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '6 hours' + INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '6 hours' + INTERVAL '7 minutes', 2.1, 12, 1, CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP),
('oa_004', 'order_004', 'user_008', 'auto_match', 'accepted', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '20 minutes', CURRENT_TIMESTAMP - INTERVAL '28 minutes', 1.5, 10, 3, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP),
('oa_005', 'order_005', 'user_010', 'manual_assign', 'accepted', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '13 minutes', 0.5, 6, 1, CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP);

-- Insert system settings
INSERT INTO system_settings (uid, setting_key, setting_value, setting_type, description, is_public, created_at, updated_at) VALUES
('ss_001', 'max_delivery_distance', '50', 'number', 'Maximum delivery distance in kilometers', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ss_002', 'base_delivery_fee', '15.00', 'number', 'Base delivery fee in USD', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ss_003', 'surge_pricing_enabled', 'true', 'boolean', 'Enable surge pricing during peak times', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ss_004', 'courier_timeout_minutes', '10', 'number', 'Minutes to wait for courier response', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ss_005', 'app_version', '1.2.3', 'string', 'Current mobile app version', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ss_006', 'maintenance_mode', 'false', 'boolean', 'Application maintenance mode status', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ss_007', 'supported_payment_methods', '{"credit_card": true, "debit_card": true, "paypal": true, "apple_pay": true, "google_pay": false}', 'json', 'Available payment methods configuration', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert audit logs
INSERT INTO audit_logs (uid, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, session_id, timestamp, created_at) VALUES
('al_001', 'user_001', 'CREATE_ORDER', 'order', 'order_001', NULL, '{"order_number": "QC202401001", "status": "pending", "total_amount": 44.54}', '192.168.1.100', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'sess_001', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('al_002', 'user_003', 'ACCEPT_ORDER', 'order', 'order_001', '{"status": "pending", "courier_id": null}', '{"status": "courier_assigned", "courier_id": "user_003"}', '192.168.1.101', 'Mozilla/5.0 (Android 13; Mobile)', 'sess_003', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('al_003', 'user_002', 'CREATE_ORDER', 'order', 'order_002', NULL, '{"order_number": "QC202401002", "status": "pending", "total_amount": 29.34}', '192.168.1.102', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)', 'sess_002', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('al_004', 'user_003', 'UPDATE_LOCATION', 'user', 'user_003', '{"current_location_lat": 40.7580, "current_location_lng": -73.9840}', '{"current_location_lat": 40.7589, "current_location_lng": -73.9851}', '192.168.1.101', 'Mozilla/5.0 (Android 13; Mobile)', 'sess_003', CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
('al_005', NULL, 'AUTO_ASSIGN', 'order', 'order_006', '{"status": "pending", "courier_id": null}', '{"status": "pending", "courier_id": null}', NULL, 'QuickCourier-System/1.0', 'system', CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes');

-- Insert corporate accounts
INSERT INTO corporate_accounts (uid, user_id, company_name, billing_address_id, tax_id, billing_contact_name, billing_contact_email, billing_contact_phone, payment_terms, credit_limit, current_balance, is_active, created_at, updated_at) VALUES
('ca_001', 'user_005', 'TechCorp Solutions LLC', 'addr_004', '12-3456789', 'David Brown', 'accounting@techcorp.com', '+1234567894', 'net_30', 5000.00, 127.45, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ca_002', 'user_007', 'Madison Marketing Group', 'addr_005', '98-7654321', 'Robert Miller', 'billing@madisonmg.com', '+1234567896', 'net_15', 2500.00, 0.00, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);