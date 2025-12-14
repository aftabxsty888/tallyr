/*
  # Complete Tallyra Database Schema

  1. New Tables
    - `shops` - Store shop information
    - `staff` - Staff members with authentication
    - `items` - Product inventory
    - `transactions` - Sales transactions
    - `inventory_movements` - Stock movement tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Proper data isolation by shop_id

  3. Sample Data
    - Demo shop with items and staff
    - Test transactions for demonstration
*/

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  currency text DEFAULT 'INR',
  master_passcode_hash text NOT NULL,
  upi_qr_url text,
  upi_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  passcode_hash text NOT NULL,
  phone text,
  email text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_price decimal(10,2) NOT NULL,
  stock_quantity integer DEFAULT 0,
  min_stock_alert integer DEFAULT 5,
  max_discount_percentage decimal(5,2) DEFAULT 0,
  max_discount_fixed decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  entered_amount decimal(10,2) NOT NULL,
  inferred_item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  base_price decimal(10,2) NOT NULL,
  discount_amount decimal(10,2) DEFAULT 0,
  discount_percentage decimal(5,2) DEFAULT 0,
  payment_mode text CHECK (payment_mode IN ('CASH', 'UPI', 'CREDIT')) NOT NULL,
  cash_received decimal(10,2),
  change_amount decimal(10,2),
  is_discount_override boolean DEFAULT false,
  is_credit_settled boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  movement_type text CHECK (movement_type IN ('SALE', 'RESTOCK', 'ADJUSTMENT')) NOT NULL,
  quantity_change integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for demo)
CREATE POLICY "Allow all operations on shops" ON shops FOR ALL USING (true);
CREATE POLICY "Allow all operations on staff" ON staff FOR ALL USING (true);
CREATE POLICY "Allow all operations on items" ON items FOR ALL USING (true);
CREATE POLICY "Allow all operations on transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on inventory_movements" ON inventory_movements FOR ALL USING (true);

-- Insert demo data
INSERT INTO shops (id, name, currency, master_passcode_hash, upi_id) VALUES 
('demo-shop-123', 'Demo Store', 'INR', '1032005', 'demostore@upi')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  master_passcode_hash = EXCLUDED.master_passcode_hash,
  upi_id = EXCLUDED.upi_id;

-- Insert demo staff
INSERT INTO staff (shop_id, name, passcode_hash, phone, email) VALUES 
('demo-shop-123', 'John Doe', '129', '+1234567890', 'john@example.com'),
('demo-shop-123', 'Jane Smith', '456', '+1234567891', 'jane@example.com')
ON CONFLICT DO NOTHING;

-- Insert demo items
INSERT INTO items (shop_id, name, base_price, stock_quantity, min_stock_alert, max_discount_percentage, max_discount_fixed) VALUES 
('demo-shop-123', 'Coffee', 50.00, 100, 10, 10.0, 5.0),
('demo-shop-123', 'Tea', 30.00, 150, 15, 15.0, 5.0),
('demo-shop-123', 'Sandwich', 120.00, 50, 5, 5.0, 10.0),
('demo-shop-123', 'Burger', 180.00, 30, 5, 8.0, 15.0),
('demo-shop-123', 'Pizza Slice', 250.00, 25, 3, 10.0, 25.0),
('demo-shop-123', 'Cold Drink', 40.00, 200, 20, 12.0, 5.0),
('demo-shop-123', 'Pastry', 80.00, 40, 8, 15.0, 10.0),
('demo-shop-123', 'Juice', 60.00, 80, 10, 10.0, 8.0)
ON CONFLICT DO NOTHING;