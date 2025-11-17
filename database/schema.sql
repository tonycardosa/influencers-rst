CREATE TABLE IF NOT EXISTS psrst_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'influencer') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS psrst_discount_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    prestashop_code VARCHAR(100) NOT NULL UNIQUE,
    FOREIGN KEY (user_id) REFERENCES psrst_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS psrst_brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prestashop_brand_id INT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS psrst_commission_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    brand_id INT NULL,
    commission_first DECIMAL(5,2) NOT NULL,
    commission_subsequent DECIMAL(5,2) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES psrst_users(id) ON DELETE CASCADE,
    FOREIGN KEY (brand_id) REFERENCES psrst_brands(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_rule (user_id, brand_id)
);

CREATE TABLE IF NOT EXISTS psrst_customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prestashop_customer_id INT NOT NULL UNIQUE,
    email VARCHAR(255),
    current_influencer_id INT NOT NULL,
    FOREIGN KEY (current_influencer_id) REFERENCES psrst_users(id)
);

CREATE TABLE IF NOT EXISTS psrst_commissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prestashop_order_id INT NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    influencer_id INT NOT NULL,
    order_total_with_vat DECIMAL(10,2) NOT NULL,
    commission_earned DECIMAL(10,2) NOT NULL,
    is_first_purchase_commission BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
    order_created_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES psrst_customers(id),
    FOREIGN KEY (influencer_id) REFERENCES psrst_users(id)
);

CREATE TABLE IF NOT EXISTS psrst_otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS psrst_settings (
    id INT PRIMARY KEY DEFAULT 1,
    smtp_host VARCHAR(255),
    smtp_port INT,
    smtp_user VARCHAR(255),
    smtp_pass VARCHAR(255),
    prestashop_api_url VARCHAR(255),
    prestashop_api_key VARCHAR(255)
);
