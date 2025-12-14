import { useState, useEffect } from 'react';
import { BarChart3, Package, Users, Settings, TrendingUp, CreditCard, AlertTriangle, LogOut, Plus, CreditCard as Edit2, Calendar, Download, Eye, EyeOff, Calculator as CalculatorIcon, Save, X, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Item, Staff, Transaction, DailySalesReport } from '../types/database';
import { Calculator } from './Calculator';

export const OwnerDashboard = () => {
  const { shop, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyReport, setDailyReport] = useState<DailySalesReport | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasscodes, setShowPasscodes] = useState<{[key: string]: boolean}>({});
  const [transactionFilter, setTransactionFilter] = useState({
    date: '',
    paymentMode: '',
    staff: ''
  });
  const [shopSettings, setShopSettings] = useState({
    name: shop?.name || '',
    currency: shop?.currency || 'INR',
    upi_id: shop?.upi_id || '',
    upi_qr_url: shop?.upi_qr_url || ''
  });

  useEffect(() => {
    if (shop) {
      loadDashboardData();
      // Set up real-time subscriptions
      setupRealtimeSubscriptions();
    }
  }, [shop]);

  const setupRealtimeSubscriptions = () => {
    if (!shop) return;

    // Subscribe to transactions
    const transactionSubscription = supabase
      .channel('transactions')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'transactions', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadTransactions();
          loadDailyReport();
        }
      )
      .subscribe();

    // Subscribe to items
    const itemSubscription = supabase
      .channel('items')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadItems();
        }
      )
      .subscribe();

    return () => {
      transactionSubscription.unsubscribe();
      itemSubscription.unsubscribe();
    };
  };

  const loadDashboardData = async () => {
    if (!shop) return;
    
    setIsLoading(true);
    try {
      await Promise.all([
        loadItems(),
        loadStaff(),
        loadTransactions(),
        loadDailyReport()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('shop_id', shop!.id)
      .order('name');
    
    if (data) setItems(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('shop_id', shop!.id)
      .order('name');
    
    if (data) setStaff(data);
  };

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select(`
        *,
        staff:staff_id(name),
        inferred_item:inferred_item_id(name)
      `)
      .eq('shop_id', shop!.id)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (data) setTransactions(data as any);
  };

  const loadDailyReport = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayTransactions } = await supabase
      .from('transactions')
      .select(`
        *,
        staff:staff_id(name)
      `)
      .eq('shop_id', shop!.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (todayTransactions) {
      const totalSales = todayTransactions.reduce((sum, t) => sum + t.entered_amount, 0);
      const cashSales = todayTransactions
        .filter(t => t.payment_mode === 'CASH')
        .reduce((sum, t) => sum + t.entered_amount, 0);
      const upiSales = todayTransactions
        .filter(t => t.payment_mode === 'UPI')
        .reduce((sum, t) => sum + t.entered_amount, 0);
      const creditSales = todayTransactions
        .filter(t => t.payment_mode === 'CREDIT')
        .reduce((sum, t) => sum + t.entered_amount, 0);
      const totalDiscounts = todayTransactions.reduce((sum, t) => sum + t.discount_amount, 0);

      const staffPerformance = staff.map(s => {
        const staffTransactions = todayTransactions.filter(t => t.staff_id === s.id);
        return {
          staff_id: s.id,
          staff_name: s.name,
          transaction_count: staffTransactions.length,
          total_amount: staffTransactions.reduce((sum, t) => sum + t.entered_amount, 0)
        };
      });

      setDailyReport({
        date: today,
        total_sales: totalSales,
        cash_sales: cashSales,
        upi_sales: upiSales,
        credit_sales: creditSales,
        total_transactions: todayTransactions.length,
        total_discounts: totalDiscounts,
        staff_performance: staffPerformance
      });
    }
  };

  const handleTransactionComplete = (transaction: Transaction) => {
    loadTransactions();
    loadDailyReport();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'calculator', label: 'Calculator', icon: CalculatorIcon },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const lowStockItems = items.filter(item => item.stock_quantity <= item.min_stock_alert);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {shop?.name} - Owner Dashboard
              </h1>
              <p className="text-gray-600">
                Complete business management and analytics
              </p>
            </div>
            
            <button
              onClick={logout}
              className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-full
                         transition-colors duration-150"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="bg-white rounded-2xl shadow-lg p-4">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl
                                  transition-all duration-150 ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="text-yellow-600" size={20} />
                  <h3 className="font-semibold text-yellow-800">Low Stock Alert</h3>
                </div>
                <div className="space-y-2">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="text-sm text-yellow-700">
                      {item.name}: {item.stock_quantity} left
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <OverviewTab 
                dailyReport={dailyReport} 
                items={items} 
                staff={staff}
                transactions={transactions}
              />
            )}
            {activeTab === 'calculator' && (
              <CalculatorTab onTransactionComplete={handleTransactionComplete} />
            )}
            {activeTab === 'items' && (
              <ItemsTab 
                items={items} 
                onRefresh={loadItems}
                showAdd={showAddItem}
                setShowAdd={setShowAddItem}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                shop={shop}
              />
            )}
            {activeTab === 'staff' && (
              <StaffTab 
                staff={staff} 
                onRefresh={loadStaff}
                showAdd={showAddStaff}
                setShowAdd={setShowAddStaff}
                editingStaff={editingStaff}
                setEditingStaff={setEditingStaff}
                showPasscodes={showPasscodes}
                setShowPasscodes={setShowPasscodes}
                shop={shop}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsTab 
                transactions={transactions} 
                staff={staff}
                filter={transactionFilter}
                setFilter={setTransactionFilter}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab 
                shop={shop} 
                settings={shopSettings}
                setSettings={setShopSettings}
                onSave={() => loadDashboardData()}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Calculator Tab Component
const CalculatorTab = ({ onTransactionComplete }: any) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-900">Owner Calculator</h2>
    <div className="max-w-md mx-auto">
      <Calculator onTransactionComplete={onTransactionComplete} isOwner={true} />
    </div>
  </div>
);

// Overview Tab Component
const OverviewTab = ({ dailyReport, items, staff, transactions }: any) => (
  <div className="space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Today's Sales</p>
            <p className="text-3xl font-bold text-green-600">
              ₹{dailyReport?.total_sales || 0}
            </p>
          </div>
          <TrendingUp className="text-green-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {dailyReport?.total_transactions || 0} transactions
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Items</p>
            <p className="text-3xl font-bold text-blue-600">
              {items.filter((i: Item) => i.is_active).length}
            </p>
          </div>
          <Package className="text-blue-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Total inventory items
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Staff</p>
            <p className="text-3xl font-bold text-purple-600">
              {staff.filter((s: Staff) => s.is_active).length}
            </p>
          </div>
          <Users className="text-purple-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Team members
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending Credits</p>
            <p className="text-3xl font-bold text-orange-600">
              ₹{transactions
                .filter((t: Transaction) => !t.is_credit_settled)
                .reduce((sum: number, t: Transaction) => sum + t.entered_amount, 0)}
            </p>
          </div>
          <CreditCard className="text-orange-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Outstanding amount
        </p>
      </div>
    </div>

    {/* Payment Breakdown */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Today's Payment Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-green-50 rounded-xl">
          <p className="text-sm font-medium text-green-700">Cash</p>
          <p className="text-2xl font-bold text-green-600">₹{dailyReport?.cash_sales || 0}</p>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-xl">
          <p className="text-sm font-medium text-blue-700">UPI</p>
          <p className="text-2xl font-bold text-blue-600">₹{dailyReport?.upi_sales || 0}</p>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-xl">
          <p className="text-sm font-medium text-orange-700">Credit</p>
          <p className="text-2xl font-bold text-orange-600">₹{dailyReport?.credit_sales || 0}</p>
        </div>
      </div>
    </div>

    {/* Staff Performance */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Today's Staff Performance</h2>
      <div className="space-y-4">
        {dailyReport?.staff_performance?.map((performance: any) => (
          <div key={performance.staff_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-semibold text-gray-900">{performance.staff_name}</p>
              <p className="text-sm text-gray-600">{performance.transaction_count} transactions</p>
            </div>
            <p className="text-lg font-bold text-blue-600">₹{performance.total_amount}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Items Tab Component
const ItemsTab = ({ items, onRefresh, showAdd, setShowAdd, editingItem, setEditingItem, shop }: any) => {
  const [newItem, setNewItem] = useState({
    name: '',
    base_price: '',
    stock_quantity: '',
    min_stock_alert: '',
    max_discount_percentage: '',
    max_discount_fixed: ''
  });

  const handleAddItem = async () => {
    if (!shop || !newItem.name || !newItem.base_price) return;

    try {
      await supabase.from('items').insert({
        shop_id: shop.id,
        name: newItem.name,
        base_price: parseFloat(newItem.base_price),
        stock_quantity: parseInt(newItem.stock_quantity) || 0,
        min_stock_alert: parseInt(newItem.min_stock_alert) || 5,
        max_discount_percentage: parseFloat(newItem.max_discount_percentage) || 0,
        max_discount_fixed: parseFloat(newItem.max_discount_fixed) || 0,
        is_active: true
      });

      setShowAdd(false);
      setNewItem({
        name: '',
        base_price: '',
        stock_quantity: '',
        min_stock_alert: '',
        max_discount_percentage: '',
        max_discount_fixed: ''
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      await supabase
        .from('items')
        .update({
          name: editingItem.name,
          base_price: editingItem.base_price,
          stock_quantity: editingItem.stock_quantity,
          min_stock_alert: editingItem.min_stock_alert,
          max_discount_percentage: editingItem.max_discount_percentage,
          max_discount_fixed: editingItem.max_discount_fixed,
          is_active: editingItem.is_active
        })
        .eq('id', editingItem.id);

      setEditingItem(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await supabase.from('items').delete().eq('id', itemId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-xl transition-colors duration-150"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: Item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                <p className="text-2xl font-bold text-blue-600">₹{item.base_price}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingItem(item)}
                  className="p-2 text-gray-400 hover:text-blue-600"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Stock:</span>
                <span className={`font-semibold ${
                  item.stock_quantity <= item.min_stock_alert 
                    ? 'text-red-600' 
                    : 'text-green-600'
                }`}>
                  {item.stock_quantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Min Alert:</span>
                <span className="text-gray-900">{item.min_stock_alert}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Discount:</span>
                <span className="text-gray-900">{item.max_discount_percentage}%</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                item.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Item Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Add New Item</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Base Price"
                value={newItem.base_price}
                onChange={(e) => setNewItem({...newItem, base_price: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={newItem.stock_quantity}
                onChange={(e) => setNewItem({...newItem, stock_quantity: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Min Stock Alert"
                value={newItem.min_stock_alert}
                onChange={(e) => setNewItem({...newItem, min_stock_alert: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Max Discount %"
                value={newItem.max_discount_percentage}
                onChange={(e) => setNewItem({...newItem, max_discount_percentage: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed Amount"
                value={newItem.max_discount_fixed}
                onChange={(e) => setNewItem({...newItem, max_discount_fixed: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Item</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name"
                value={editingItem.name}
                onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Base Price"
                value={editingItem.base_price}
                onChange={(e) => setEditingItem({...editingItem, base_price: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={editingItem.stock_quantity}
                onChange={(e) => setEditingItem({...editingItem, stock_quantity: parseInt(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Min Stock Alert"
                value={editingItem.min_stock_alert}
                onChange={(e) => setEditingItem({...editingItem, min_stock_alert: parseInt(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Max Discount %"
                value={editingItem.max_discount_percentage}
                onChange={(e) => setEditingItem({...editingItem, max_discount_percentage: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed Amount"
                value={editingItem.max_discount_fixed}
                onChange={(e) => setEditingItem({...editingItem, max_discount_fixed: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingItem.is_active}
                  onChange={(e) => setEditingItem({...editingItem, is_active: e.target.checked})}
                />
                <span>Active</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateItem}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Update Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Staff Tab Component  
const StaffTab = ({ staff, onRefresh, showAdd, setShowAdd, editingStaff, setEditingStaff, showPasscodes, setShowPasscodes, shop }: any) => {
  const [newStaff, setNewStaff] = useState({
    name: '',
    passcode: ''
  });

  const togglePasscodeVisibility = (staffId: string) => {
    setShowPasscodes((prev: any) => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  const handleAddStaff = async () => {
    if (!shop || !newStaff.name || !newStaff.passcode) return;

    try {
      await supabase.from('staff').insert({
        shop_id: shop.id,
        name: newStaff.name,
        passcode_hash: newStaff.passcode, // In production, this should be hashed
        is_active: true
      });

      setShowAdd(false);
      setNewStaff({ name: '', passcode: '' });
      onRefresh();
    } catch (error) {
      console.error('Error adding staff:', error);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    try {
      await supabase
        .from('staff')
        .update({
          name: editingStaff.name,
          passcode_hash: editingStaff.passcode_hash,
          is_active: editingStaff.is_active
        })
        .eq('id', editingStaff.id);

      setEditingStaff(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating staff:', error);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      await supabase.from('staff').delete().eq('id', staffId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting staff:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-xl transition-colors duration-150"
        >
          <Plus size={20} />
          Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Members</h3>
          <div className="space-y-4">
            {staff.map((member: Staff) => (
              <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <h4 className="font-semibold text-gray-900">{member.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">Passcode:</span>
                    <span className="text-sm font-mono">
                      {showPasscodes[member.id] ? member.passcode_hash : '****'}
                    </span>
                    <button
                      onClick={() => togglePasscodeVisibility(member.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPasscodes[member.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                  
                  <button 
                    onClick={() => setEditingStaff(member)}
                    className="p-2 text-gray-400 hover:text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteStaff(member.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Add New Staff Member</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Staff Name"
                value={newStaff.name}
                onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Numeric Passcode (e.g., 129)"
                value={newStaff.passcode}
                onChange={(e) => setNewStaff({...newStaff, passcode: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Staff Member</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Staff Name"
                value={editingStaff.name}
                onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Numeric Passcode"
                value={editingStaff.passcode_hash}
                onChange={(e) => setEditingStaff({...editingStaff, passcode_hash: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingStaff.is_active}
                  onChange={(e) => setEditingStaff({...editingStaff, is_active: e.target.checked})}
                />
                <span>Active</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingStaff(null)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStaff}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Update Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Transactions Tab Component
const TransactionsTab = ({ transactions, staff, filter, setFilter }: any) => {
  const exportToPDF = () => {
    // Simple CSV export for now - can be enhanced to PDF
    const csvContent = [
      ['Date', 'Amount', 'Item', 'Staff', 'Payment Mode', 'Discount'].join(','),
      ...transactions.map((t: any) => [
        new Date(t.created_at).toLocaleString(),
        t.entered_amount,
        t.inferred_item?.name || 'Unknown',
        t.staff?.name || 'Unknown',
        t.payment_mode,
        t.discount_amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredTransactions = transactions.filter((t: any) => {
    if (filter.date && !t.created_at.includes(filter.date)) return false;
    if (filter.paymentMode && t.payment_mode !== filter.paymentMode) return false;
    if (filter.staff && t.staff_id !== filter.staff) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
        <div className="flex gap-3">
          <input
            type="date"
            value={filter.date}
            onChange={(e) => setFilter({...filter, date: e.target.value})}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filter.paymentMode}
            onChange={(e) => setFilter({...filter, paymentMode: e.target.value})}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Payment Modes</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CREDIT">Credit</option>
          </select>
          <select
            value={filter.staff}
            onChange={(e) => setFilter({...filter, staff: e.target.value})}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Staff</option>
            {staff.map((s: Staff) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction: any) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₹{transaction.entered_amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.inferred_item?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.staff?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      transaction.payment_mode === 'CASH' 
                        ? 'bg-green-100 text-green-800'
                        : transaction.payment_mode === 'UPI'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {transaction.payment_mode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.discount_amount > 0 ? (
                      <span className="text-yellow-600">
                        ₹{transaction.discount_amount}
                        {transaction.is_discount_override && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Settings Tab Component
const SettingsTab = ({ shop, settings, setSettings, onSave }: any) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleSave = async () => {
    if (!shop) return;

    try {
      await supabase
        .from('shops')
        .update({
          name: settings.name,
          currency: settings.currency,
          upi_id: settings.upi_id,
          upi_qr_url: settings.upi_qr_url
        })
        .eq('id', shop.id);

      onSave();
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // In a real app, you'd upload to a storage service
      // For demo, we'll just create a local URL
      const url = URL.createObjectURL(file);
      setSettings({...settings, upi_qr_url: url});
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Shop Settings</h2>
      
      {/* Shop Information */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({...settings, name: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select 
              value={settings.currency}
              onChange={(e) => setSettings({...settings, currency: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            >
              <option value="INR">Indian Rupee (₹)</option>
              <option value="NPR">Nepalese Rupee (रू)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
            <input
              type="text"
              value={settings.upi_id}
              onChange={(e) => setSettings({...settings, upi_id: e.target.value})}
              placeholder="your-upi@bank"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code</label>
            <div className="space-y-3">
              <input
                type="url"
                value={settings.upi_qr_url}
                onChange={(e) => setSettings({...settings, upi_qr_url: e.target.value})}
                placeholder="https://example.com/qr-code.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Or upload image:</span>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload QR'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
              {settings.upi_qr_url && (
                <div className="mt-3">
                  <img 
                    src={settings.upi_qr_url} 
                    alt="QR Code Preview" 
                    className="w-32 h-32 object-contain border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg"
        >
          <Save size={20} />
          Save Settings
        </button>
      </div>
    </div>
  );
};