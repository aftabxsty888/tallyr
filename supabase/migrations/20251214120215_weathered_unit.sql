/*
  # Complete Tallyra Database Schema

  1. New Tables
    - `shops` - Store shop information and settings
    - `staff` - Staff members with passcodes
    - `items` - Inventory items with pricing and discount rules
    - `transactions` - All sales transactions
    - `inventory_movements` - Track stock changes

  2. Security
    - Enable RLS on all tables
    - Add policies for shop-based access control

  3. Sample Data
    - Demo shop with sample items and staff
*/

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id text PRIMARY KEY DEFAULT 'demo-shop-123',
  name text NOT NULL DEFAULT 'Demo Shop',
  logo_url text,
  currency text NOT NULL DEFAULT 'INR',
  master_passcode_hash text NOT NULL DEFAULT '1032005',
  upi_qr_url text,
  upi_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  passcode_hash text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_price numeric NOT NULL,
  stock_quantity integer DEFAULT 0,
  min_stock_alert integer DEFAULT 5,
  max_discount_percentage numeric DEFAULT 0,
  max_discount_fixed numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id text NOT NULL,
  entered_amount numeric NOT NULL,
  inferred_item_id uuid REFERENCES items(id),
  base_price numeric NOT NULL,
  discount_amount numeric DEFAULT 0,
  discount_percentage numeric DEFAULT 0,
  payment_mode text NOT NULL CHECK (payment_mode IN ('CASH', 'UPI', 'CREDIT')),
  cash_received numeric,
  change_amount numeric,
  is_discount_override boolean DEFAULT false,
  is_credit_settled boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id),
  movement_type text NOT NULL CHECK (movement_type IN ('SALE', 'RESTOCK', 'ADJUSTMENT')),
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
INSERT INTO shops (id, name, currency, upi_id) VALUES 
('demo-shop-123', 'Tallyra Demo Store', 'INR', 'demo@upi')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  upi_id = EXCLUDED.upi_id;

-- Insert demo staff
INSERT INTO staff (shop_id, name, passcode_hash) VALUES 
('demo-shop-123', 'John Doe', '129'),
('demo-shop-123', 'Jane Smith', '456')
ON CONFLICT DO NOTHING;

-- Insert demo items
INSERT INTO items (shop_id, name, base_price, stock_quantity, min_stock_alert, max_discount_percentage, max_discount_fixed) VALUES 
('demo-shop-123', 'Coffee', 50, 100, 10, 10, 5),
('demo-shop-123', 'Tea', 30, 80, 10, 15, 5),
('demo-shop-123', 'Sandwich', 120, 50, 5, 5, 10),
('demo-shop-123', 'Burger', 180, 30, 5, 8, 15),
('demo-shop-123', 'Pizza Slice', 250, 20, 3, 5, 20),
('demo-shop-123', 'Cold Drink', 40, 60, 10, 12, 5),
('demo-shop-123', 'Pastry', 80, 25, 5, 10, 8),
('demo-shop-123', 'Juice', 60, 40, 8, 15, 10)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_items_shop_id ON items(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_shop_id ON inventory_movements(shop_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_shops_updated_at ON shops;
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();