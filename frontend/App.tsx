import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  MapPin,
  CreditCard,
  Plus,
  Search,
  FileSpreadsheet,
  LogOut,
  KeyRound,
  ShieldAlert,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  UserPlus,
  PhoneCall,
  Filter,
  DollarSign,
  Activity,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Wifi,
  Lock,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Driver, Order, User, SmsLog } from './types';

// Custom lightweight notification toast
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('dispatcher_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active Tab/Navigation
  const [activeTab, setActiveTab] = useState<'orders' | 'dispatch' | 'customers' | 'drivers' | 'sms' | 'admin'>('orders');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Application Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);

  // Search and Filter States (Orders)
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Form States - Create Customer
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Form States - Create Driver
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [isCreatingDriver, setIsCreatingDriver] = useState(false);

  // Form States - Dispatch Order
  const [customerMode, setCustomerMode] = useState<'WALKIN' | 'REGISTERED'>('WALKIN');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [dispCustomerId, setDispCustomerId] = useState('');
  const [dispDriverId, setDispDriverId] = useState('');
  const [dispPickup, setDispPickup] = useState('');
  const [dispDelivery, setDispDelivery] = useState('');
  const [dispFee, setDispFee] = useState<number>(150.0);
  const [dispPaymentType, setDispPaymentType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [isDispatching, setIsDispatching] = useState(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Custom Settle Balance Modal States
  const [customerToSettle, setCustomerToSettle] = useState<Customer | null>(null);
  const [isSettlingInProgress, setIsSettlingInProgress] = useState(false);

  // SMS Gateway Config States
  const [smsConfig, setSmsConfig] = useState({
    localAddress: '',
    publicAddress: '',
    username: '',
    password: '',
    deviceId: '',
    activeAddressType: 'simulated',
    simNumber: '',
    phoneFormat: 'as_entered'
  });
  const [isSmsConfigSaving, setIsSmsConfigSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isTestSmsSending, setIsTestSmsSending] = useState(false);

  // Show Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Helper: Get headers with JWT
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // 1. Check Authenticated User on mount/token change
  useEffect(() => {
    if (token) {
      fetchCurrentUser();
      fetchDashboardData();
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        // Stale or invalid token
        handleLogout();
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const headers = getAuthHeaders();
      const [ordersRes, custRes, drvRes, smsRes] = await Promise.all([
        fetch('/api/orders', { headers }),
        fetch('/api/customers', { headers }),
        fetch('/api/drivers', { headers }),
        fetch('/api/sms/logs', { headers })
      ]);

      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (drvRes.ok) setDrivers(await drvRes.json());
      if (smsRes.ok) setSmsLogs(await smsRes.json());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      showToast('Network error loading system records.', 'error');
    }
  };

  // Refresh active tab's data
  useEffect(() => {
    if (token) {
      fetchDashboardData();
      if (activeTab === 'sms') {
        fetchSmsConfig();
      }
    }
  }, [activeTab]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setAuthError('Please fill in all credentials.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('dispatcher_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        showToast('Logged in successfully.', 'success');
      } else {
        setAuthError(data.error || 'Login failed.');
      }
    } catch (err) {
      setAuthError('Connection error. Is backend server online?');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dispatcher_token');
    setToken(null);
    setCurrentUser(null);
    showToast('Logged out of session.', 'info');
  };

  // Create Customer Handler
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.username !== 'admin') {
      showToast('Permission Denied: Only the admin user can register customer accounts.', 'error');
      return;
    }
    if (!newCustName || !newCustPhone) {
      showToast('Name and phone are required.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newCustName,
          phone: newCustPhone,
          address: newCustAddress,
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Customer "${data.name}" added successfully.`, 'success');
        setCustomers((prev) => [data, ...prev]);
        // Reset inputs
        setNewCustName('');
        setNewCustPhone('');
        setNewCustAddress('');
        setIsCreatingCustomer(false);
      } else {
        showToast(data.error || 'Could not add customer.', 'error');
      }
    } catch (err) {
      showToast('Error registering profile.', 'error');
    }
  };

  // Create Driver Handler
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.username !== 'admin') {
      showToast('Permission Denied: Only the admin user can register drivers.', 'error');
      return;
    }
    if (!newDriverName || !newDriverPhone) {
      showToast('Name and phone are required.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newDriverName,
          phone: newDriverPhone,
          status: 'AVAILABLE'
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Driver "${data.name}" added to roster.`, 'success');
        setDrivers((prev) => [data, ...prev]);
        setNewDriverName('');
        setNewDriverPhone('');
        setIsCreatingDriver(false);
      } else {
        showToast(data.error || 'Failed to add driver.', 'error');
      }
    } catch (err) {
      showToast('Error registering driver.', 'error');
    }
  };

  // Dispatch Order Handler
  const handleDispatchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (customerMode === 'WALKIN') {
      if (!walkInName || !walkInPhone) {
        showToast('Please fill in customer name and phone number.', 'error');
        return;
      }
    } else {
      if (!dispCustomerId) {
        showToast('Please select a registered customer account.', 'error');
        return;
      }
    }

    if (!dispDriverId || !dispPickup || !dispDelivery) {
      showToast('Please fill in driver, pickup, and delivery details.', 'error');
      return;
    }

    setIsDispatching(true);
    try {
      const bodyPayload = {
        customerId: customerMode === 'REGISTERED' ? dispCustomerId : undefined,
        walkInCustomer: customerMode === 'WALKIN' ? { name: walkInName, phone: walkInPhone } : undefined,
        driverId: dispDriverId,
        pickupAddress: dispPickup,
        deliveryAddress: dispDelivery,
        fee: dispFee,
        paymentType: customerMode === 'WALKIN' ? 'CASH' : dispPaymentType
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Order dispatched successfully! SMS notifications triggered.`, 'success');
        setOrders((prev) => [data, ...prev]);
        // Reset fields
        setDispPickup('');
        setDispDelivery('');
        setDispFee(150.0);
        setDispCustomerId('');
        setWalkInName('');
        setWalkInPhone('');
        setDispDriverId('');
        // Route to order list
        setActiveTab('orders');
      } else {
        showToast(data.error || 'Failed to dispatch order.', 'error');
      }
    } catch (err) {
      showToast('Network error creating dispatch.', 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  // Auto-fill or adjust payment option depending on customer type
  const handleCustomerSelection = (id: string) => {
    setDispCustomerId(id);
    const selected = customers.find((c) => c._id === id);
    if (selected) {
      if (selected.type === 'NORMAL') {
        setDispPaymentType('CASH');
      } else {
        setDispPaymentType('CREDIT');
      }
    }
  };

  // Settle Balance Helper - Trigger Modal
  const handleSettleBalance = (customerId: string) => {
    const customer = customers.find((c) => c._id === customerId);
    if (!customer) return;
    setCustomerToSettle(customer);
  };

  // Perform Settle Balance call
  const executeSettleBalance = async () => {
    if (!customerToSettle) return;
    setIsSettlingInProgress(true);
    try {
      const res = await fetch(`/api/customers/${customerToSettle._id}/settle`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        // Reload all data
        fetchDashboardData();
        setCustomerToSettle(null);
      } else {
        showToast(data.error || 'Failed to settle balance.', 'error');
      }
    } catch (err) {
      showToast('Error communicating with server.', 'error');
    } finally {
      setIsSettlingInProgress(false);
    }
  };

  // Fetch SMS Gateway Settings
  const fetchSmsConfig = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/sms/config', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSmsConfig({
          localAddress: data.localAddress || '',
          publicAddress: data.publicAddress || '',
          username: data.username || '',
          password: data.password || '',
          deviceId: data.deviceId || '',
          activeAddressType: data.activeAddressType || 'simulated',
          simNumber: data.simNumber || '',
          phoneFormat: data.phoneFormat || 'as_entered'
        });
      }
    } catch (err) {
      console.error('Error fetching SMS configuration:', err);
    }
  };

  // Save SMS Gateway Settings
  const handleSaveSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSmsConfigSaving(true);
    try {
      const res = await fetch('/api/sms/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(smsConfig)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('SMS Gateway settings updated successfully!', 'success');
        if (data.config) {
          setSmsConfig({
            localAddress: data.config.localAddress || '',
            publicAddress: data.config.publicAddress || '',
            username: data.config.username || '',
            password: data.config.password || '',
            deviceId: data.config.deviceId || '',
            activeAddressType: data.config.activeAddressType || 'simulated',
            simNumber: data.config.simNumber || '',
            phoneFormat: data.config.phoneFormat || 'as_entered'
          });
        }
      } else {
        showToast(data.error || 'Failed to update configuration.', 'error');
      }
    } catch (err) {
      showToast('Error saving SMS configuration.', 'error');
    } finally {
      setIsSmsConfigSaving(false);
    }
  };

  // Test SMS Route
  const handleTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      showToast('Please enter a recipient phone number.', 'error');
      return;
    }
    setIsTestSmsSending(true);
    try {
      const res = await fetch('/api/sms/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          testPhone,
          testMessage
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        // Refresh SMS logs immediately to show the dispatched log
        fetchDashboardData();
        setTestPhone('');
        setTestMessage('');
      } else {
        showToast(data.error || 'Test SMS transmission failed.', 'error');
      }
    } catch (err) {
      showToast('Error transmitting test SMS.', 'error');
    } finally {
      setIsTestSmsSending(false);
    }
  };

  // Order Status & Payment Status updates
  const handleUpdateOrderStatus = async (orderId: string, orderStatus: string, paymentStatus?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderStatus, paymentStatus })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Order status updated.`, 'success');
        setOrders((prev) => prev.map((o) => (o._id === orderId ? data : o)));
        // Refresh customers lists since balance might update on delivered credit orders
        if (orderStatus === 'DELIVERED') {
          const freshCustRes = await fetch('/api/customers', { headers: getAuthHeaders() });
          if (freshCustRes.ok) setCustomers(await freshCustRes.json());
        }
      } else {
        showToast(data.error || 'Failed to update order.', 'error');
      }
    } catch (err) {
      showToast('Error writing order update.', 'error');
    }
  };

  // Toggle Driver Status
  const handleUpdateDriverStatus = async (driverId: string, status: 'AVAILABLE' | 'BUSY' | 'INACTIVE') => {
    try {
      const res = await fetch(`/api/drivers/${driverId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Driver status set to ${status}.`, 'info');
        setDrivers((prev) => prev.map((d) => (d._id === driverId ? data : d)));
      }
    } catch (err) {
      showToast('Error updating driver status.', 'error');
    }
  };

  // Excel Downloads using JWT Fetching Blobs
  const downloadDailyLogExcel = async () => {
    try {
      let url = '/api/orders/export/daily';
      if (startDate || endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        throw new Error('Could not download daily export');
      }

      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const startTag = startDate || 'All';
      const endTag = endDate || 'Present';
      a.download = `Dispatch_Log_${startTag}_to_${endTag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
      showToast('Daily log downloaded.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Excel export failed.', 'error');
    }
  };

  const downloadAccountStatementExcel = async (customerId: string, name: string) => {
    try {
      const res = await fetch(`/api/orders/export/account/${customerId}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        throw new Error('Could not download statement');
      }

      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `Account_Statement_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
      showToast(`Statement exported for ${name}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Statement export failed.', 'error');
    }
  };

  // Order Filters application
  const filteredOrders = orders.filter((order) => {
    // Search query matches customer name, driver name, pickup, or delivery
    const cust = order.customer && typeof order.customer === 'object' ? order.customer : null;
    const drv = order.driver && typeof order.driver === 'object' ? order.driver : null;
    
    const searchString = `${cust ? cust.name : ''} ${drv ? drv.name : ''} ${order.pickupAddress} ${order.deliveryAddress} ${order.orderNumber}`.toLowerCase();
    const matchesSearch = searchQuery ? searchString.includes(searchQuery.toLowerCase()) : true;

    const matchesStatus = statusFilter ? order.orderStatus === statusFilter : true;
    const matchesPayment = paymentFilter ? order.paymentType === paymentFilter : true;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Render App
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 select-none">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white mb-4 shadow-sm">
            <Truck className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Negadras Dispatch Engine
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Order Management & Delivery Portal
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 border border-slate-200 rounded-xl sm:px-10 shadow-sm space-y-6">
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400"
                    placeholder="e.g. admin"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400"
                    placeholder="e.g. password123"
                  />
                </div>
              </div>

              {authError && (
                <div className="rounded-lg bg-red-50 p-4 border border-red-100">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-semibold text-red-800">{authError}</p>
                    </div>
                  </div>
                </div>
              )}


              <div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex justify-center py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-lg transition-colors duration-150 focus:outline-none disabled:opacity-50"
                >
                  {authLoading ? 'Signing In...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`p-4 rounded-xl shadow-md flex items-start space-x-3 pointer-events-auto border ${
                t.type === 'success'
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : t.type === 'error'
                  ? 'bg-red-50 border-red-100 text-red-800'
                  : 'bg-blue-50 border-blue-100 text-blue-800'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {t.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : t.type === 'error' ? (
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1 text-xs font-semibold">{t.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Corporate Dispatcher Header */}
      <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Truck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900">Negadras Dispatch Engine</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Delivery Control Tower</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline-flex items-center bg-slate-50 border border-slate-200 px-3 py-1 rounded-full text-xs text-slate-600 font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
              Dispatcher: {currentUser?.name} ({currentUser?.role})
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-6 lg:p-8 flex flex-row gap-3 sm:gap-6">
        {/* Left Side: Modular Navigation Sidebar */}
        <aside className={`${isSidebarCollapsed ? 'w-16 sm:w-20' : 'w-56 sm:w-64'} flex-shrink-0 transition-all duration-300 ease-in-out`}>
          <div className={`bg-white border border-slate-200 rounded-xl shadow-sm space-y-4 transition-all duration-300 ${isSidebarCollapsed ? 'p-2 sm:p-3' : 'p-3 sm:p-4'}`}>
            
            {/* Collapse Toggle Button */}
            <div className={`flex items-center justify-between border-b border-slate-100 pb-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Navigation</span>
              )}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
                title={isSidebarCollapsed ? "Expand Navigation" : "Collapse Navigation"}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('orders')}
                title={isSidebarCollapsed ? "Dispatch Board" : undefined}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-medium text-xs transition-colors relative ${
                  activeTab === 'orders'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-4.5 w-4.5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Dispatch Board</span>}
                {isSidebarCollapsed ? (
                  <span className="absolute top-1 right-1 text-[9px] font-bold bg-indigo-100 text-indigo-800 px-1 rounded-full scale-90">
                    {orders.length}
                  </span>
                ) : (
                  <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    activeTab === 'orders' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {orders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('dispatch')}
                title={isSidebarCollapsed ? "Dispatch New Order" : undefined}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-medium text-xs transition-colors ${
                  activeTab === 'dispatch'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Plus className="h-4.5 w-4.5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Dispatch New Order</span>}
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                title={isSidebarCollapsed ? "Account Holders" : undefined}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-medium text-xs transition-colors ${
                  activeTab === 'customers'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="h-4.5 w-4.5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Account Holders</span>}
              </button>

              <button
                onClick={() => setActiveTab('drivers')}
                title={isSidebarCollapsed ? "Drivers Fleet" : undefined}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-medium text-xs transition-colors ${
                  activeTab === 'drivers'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Truck className="h-4.5 w-4.5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>Drivers Fleet</span>}
              </button>

              <button
                onClick={() => setActiveTab('sms')}
                title={isSidebarCollapsed ? "SMS Gateway Feed" : undefined}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-medium text-xs transition-colors relative ${
                  activeTab === 'sms'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Send className="h-4.5 w-4.5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>SMS Gateway Feed</span>}
                {smsLogs.length > 0 && (
                  isSidebarCollapsed ? (
                    <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white" />
                  ) : (
                    <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Live
                    </span>
                  )
                )}
              </button>

              {currentUser?.username === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  title={isSidebarCollapsed ? "Admin Control Panel" : undefined}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-medium text-xs transition-colors relative ${
                    activeTab === 'admin'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <KeyRound className="h-4.5 w-4.5 text-indigo-600 flex-shrink-0" />
                  {!isSidebarCollapsed && <span>Admin Control Panel</span>}
                  {!isSidebarCollapsed && (
                    <span className="ml-auto text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Admin
                    </span>
                  )}
                </button>
              )}
            </nav>

            {/* Android SMS Gateway Widget */}
            <div className="border-t border-slate-100 pt-4">
              <div className={`bg-slate-50 rounded-lg transition-all duration-300 ${isSidebarCollapsed ? 'p-1.5' : 'p-3'}`}>
                {!isSidebarCollapsed ? (
                  <>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Android SMS Gateway</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs text-slate-600 font-mono">Connected: Live</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-center" title="Android SMS Gateway Connected: Live">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side: Tab Contents with responsive enter animation */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Search, Date range, and Filters Panel */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-slate-900 flex items-center">
                        <FileSpreadsheet className="h-5 w-5 mr-2 text-indigo-600" />
                        Active Dispatch Board
                      </h2>
                      {/* Dynamic status pill metrics */}
                      <div className="flex gap-2 flex-wrap pt-1">
                        <span className="text-[10px] px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold border border-amber-100 uppercase tracking-wider">
                          {orders.filter(o => o.orderStatus === 'PENDING').length} Pending
                        </span>
                        <span className="text-[10px] px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold border border-blue-100 uppercase tracking-wider">
                          {orders.filter(o => o.orderStatus === 'DISPATCHED').length} Dispatched
                        </span>
                        <span className="text-[10px] px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-100 uppercase tracking-wider">
                          {orders.filter(o => o.orderStatus === 'DELIVERED').length} Completed
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={downloadDailyLogExcel}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                        <span>Export Dispatch Log (.xlsx)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search filter */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 font-medium"
                        placeholder="Search customer, driver, address..."
                      />
                    </div>

                    {/* Status filter */}
                    <div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      >
                        <option value="">All Fulfillment Statuses</option>
                        <option value="PENDING">PENDING</option>
                        <option value="DISPATCHED">DISPATCHED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>

                    {/* Payment filter */}
                    <div>
                      <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      >
                        <option value="">All Payment Types</option>
                        <option value="CASH">CASH (Normal User)</option>
                        <option value="CREDIT">CREDIT (Account Holder)</option>
                      </select>
                    </div>

                    {/* Reset Filters button */}
                    <div>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('');
                          setPaymentFilter('');
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-sm transition-all"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>

                  {/* Date range selection */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 font-medium">
                    <span className="inline-flex items-center text-slate-600">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                      Dispatch Date Range:
                    </span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs"
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Orders List / Table */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <FileSpreadsheet className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-slate-900">No Orders Match Query</h3>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Try resetting filters or dispatch a new delivery order.</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Order</th>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Addresses</th>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Driver Assigned</th>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Fee & Payment</th>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.map((order) => {
                            const cust = order.customer && typeof order.customer === 'object' ? order.customer : null;
                            const drv = order.driver && typeof order.driver === 'object' ? order.driver : null;

                            return (
                              <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                    #{order.orderNumber || 'PENDING'}
                                  </span>
                                  <div className="text-[10px] text-slate-400 mt-1.5 font-medium">
                                    {new Date(order.createdAt).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-slate-800">{cust ? cust.name : 'Unknown Customer'}</div>
                                  <div className="text-xs text-slate-400 font-medium">{cust ? cust.phone : 'N/A'}</div>
                                  <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1.5 uppercase tracking-tight ${
                                    cust?.type === 'ACCOUNT_HOLDER' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
                                  }`}>
                                    {cust?.type || 'NORMAL'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 max-w-xs">
                                  <div className="text-xs text-slate-700 truncate font-medium" title={order.pickupAddress}>
                                    <span className="font-bold text-slate-400 uppercase tracking-tight text-[10px] mr-1">Pick:</span> {order.pickupAddress}
                                  </div>
                                  <div className="text-xs text-slate-700 truncate mt-1.5 font-medium" title={order.deliveryAddress}>
                                    <span className="font-bold text-slate-400 uppercase tracking-tight text-[10px] mr-1">Drop:</span> {order.deliveryAddress}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-slate-800">{drv ? drv.name : 'Unassigned'}</div>
                                  <div className="text-xs text-slate-400 font-medium">{drv ? drv.phone : 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-black text-slate-800">Br {order.fee.toFixed(2)}</div>
                                  <div className="flex flex-col gap-1.5 mt-1.5">
                                    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide ${
                                      order.paymentType === 'CREDIT' ? 'text-indigo-600' : 'text-amber-600'
                                    }`}>
                                      <CreditCard className="h-3 w-3 mr-1" />
                                      {order.paymentType}
                                    </span>
                                    <span className={`inline-block text-[10px] font-extrabold px-1.5 py-0.2 rounded w-fit ${
                                      order.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : order.paymentStatus === 'SETTLED' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                      {order.paymentStatus}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                    order.orderStatus === 'DELIVERED'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                      : order.orderStatus === 'DISPATCHED'
                                      ? 'bg-blue-50 text-blue-800 border border-blue-100'
                                      : order.orderStatus === 'CANCELLED'
                                      ? 'bg-red-50 text-red-800 border border-red-100'
                                      : 'bg-amber-50 text-amber-800 border border-amber-100'
                                  }`}>
                                    {order.orderStatus === 'PENDING' && <Clock className="h-3.5 w-3.5 mr-1 text-amber-500" />}
                                    {order.orderStatus === 'DISPATCHED' && <Truck className="h-3.5 w-3.5 mr-1 text-blue-500 animate-pulse" />}
                                    {order.orderStatus === 'DELIVERED' && <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />}
                                    {order.orderStatus === 'CANCELLED' && <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />}
                                    {order.orderStatus}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                                  {/* Quick Actions depending on status */}
                                  {order.orderStatus === 'PENDING' && (
                                    <button
                                      onClick={() => handleUpdateOrderStatus(order._id, 'DISPATCHED')}
                                      className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm text-xs transition-colors"
                                    >
                                      Dispatch
                                    </button>
                                  )}

                                  {order.orderStatus === 'DISPATCHED' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateOrderStatus(order._id, 'DELIVERED', order.paymentType === 'CASH' ? 'PAID' : 'UNPAID')}
                                        className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm text-xs transition-colors"
                                      >
                                        Deliver
                                      </button>
                                      <button
                                        onClick={() => handleUpdateOrderStatus(order._id, 'CANCELLED')}
                                        className="inline-flex items-center bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 font-bold px-3 py-1.5 rounded-lg shadow-sm text-xs transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}

                                  {/* Manual Payment Settler if Cash Order is Delivered but not Paid */}
                                  {order.orderStatus === 'DELIVERED' && order.paymentType === 'CASH' && order.paymentStatus === 'UNPAID' && (
                                    <button
                                      onClick={() => handleUpdateOrderStatus(order._id, 'DELIVERED', 'PAID')}
                                      className="inline-flex items-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                                    >
                                      Mark Cash Paid
                                    </button>
                                  )}

                                  {/* Fallback to view statement if completed credit */}
                                  {cust?.type === 'ACCOUNT_HOLDER' && (
                                    <button
                                      onClick={() => downloadAccountStatementExcel(cust._id, cust.name)}
                                      title="Export customer invoice statement"
                                      className="inline-flex items-center bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                                    >
                                      Statement
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'dispatch' && (
              <motion.div
                key="dispatch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Dispatch Order Form */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-black text-slate-900 flex items-center">
                      <PhoneCall className="h-5 w-5 mr-2 text-indigo-600 animate-pulse" />
                      Incoming Call Dispatch Console
                    </h2>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">STEP 1 OF 2</span>
                  </div>

                  <form onSubmit={handleDispatchOrder} className="space-y-5">
                    {/* Customer Classification Selection Toggle */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Customer Type
                      </label>
                      <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerMode('WALKIN');
                            setDispPaymentType('CASH');
                          }}
                          className={`flex-1 text-center py-2 text-xs font-bold rounded-md transition-all ${
                            customerMode === 'WALKIN'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Walk-In Customer (Cash)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerMode('REGISTERED');
                            setDispPaymentType('CREDIT');
                          }}
                          className={`flex-1 text-center py-2 text-xs font-bold rounded-md transition-all ${
                            customerMode === 'REGISTERED'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Registered Account Holder (Credit)
                        </button>
                      </div>
                    </div>

                    {/* Customer Input Fields / Selection */}
                    <div>
                      {customerMode === 'WALKIN' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Walk-In Name
                            </label>
                            <input
                              type="text"
                              required={customerMode === 'WALKIN'}
                              value={walkInName}
                              onChange={(e) => setWalkInName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                              placeholder="e.g. John Walkin"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Walk-In Phone Number
                            </label>
                            <input
                              type="text"
                              required={customerMode === 'WALKIN'}
                              value={walkInPhone}
                              onChange={(e) => setWalkInPhone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                              placeholder="e.g. 555-0199"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Select Customer Account
                          </label>
                          <select
                            required={customerMode === 'REGISTERED'}
                            value={dispCustomerId}
                            onChange={(e) => handleCustomerSelection(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                          >
                            <option value="">-- Choose corporate account profile --</option>
                            {customers
                              .filter((c) => c.type === 'ACCOUNT_HOLDER')
                              .map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name} ({c.phone}) - Balance: Br {c.creditBalance.toFixed(2)}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Driver Selection */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Assign Available Driver
                      </label>
                      <select
                        required
                        value={dispDriverId}
                        onChange={(e) => setDispDriverId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                      >
                        <option value="">-- Assign dispatcher's driver --</option>
                        {drivers
                          .filter((d) => d.status !== 'INACTIVE')
                          .map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.name} ({d.phone}) - {d.status}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Addresses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                          <MapPin className="h-4 w-4 mr-1 text-indigo-500" />
                          Pickup Address
                        </label>
                        <input
                          type="text"
                          required
                          value={dispPickup}
                          onChange={(e) => setDispPickup(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="Store, Pharmacy, or Warehouse"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                          <MapPin className="h-4 w-4 mr-1 text-indigo-500" />
                          Delivery Address
                        </label>
                        <input
                          type="text"
                          required
                          value={dispDelivery}
                          onChange={(e) => setDispDelivery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="Client's home address"
                        />
                      </div>
                    </div>

                    {/* Pricing and Payment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                          <DollarSign className="h-4 w-4 mr-1 text-indigo-500" />
                          Delivery Fee (ETB)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          min="1"
                          value={dispFee}
                          onChange={(e) => setDispFee(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono font-bold"
                          placeholder="150.00"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                          <CreditCard className="h-4 w-4 mr-1 text-indigo-500" />
                          Billing Option
                        </label>
                        <select
                          value={dispPaymentType}
                          onChange={(e) => setDispPaymentType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                        >
                          <option value="CASH">Cash on Delivery (CASH)</option>
                          <option value="CREDIT">Charge to Account (CREDIT)</option>
                        </select>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          * Normal customers must pay CASH. Account Holders can accumulate credit.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex gap-3.5 items-start">
                      <div className="flex-shrink-0 mt-0.5">
                        <Send className="h-5 w-5 text-indigo-600" />
                      </div>

                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isDispatching}
                        className="w-full flex justify-center py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg shadow-md transition-colors focus:outline-none"
                      >
                        {isDispatching ? 'Initiating Dispatch Systems...' : '⚡ Dispatch & Alert Driver'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Inline forms sidebar / Help card */}
                <div className="space-y-6">
                  {/* Register Customer inline */}
                  {isCreatingCustomer && currentUser?.username === 'admin' && (
                    <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 shadow-md border border-slate-800">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest flex items-center">
                          <UserPlus className="h-4 w-4 mr-1.5 text-indigo-400" />
                          Register Customer Profile
                        </h3>
                        <button
                          onClick={() => setIsCreatingCustomer(false)}
                          className="text-slate-400 hover:text-white font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer Full Name</label>
                          <input
                            type="text"
                            required
                            value={newCustName}
                            onChange={(e) => setNewCustName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                          <input
                            type="text"
                            required
                            value={newCustPhone}
                            onChange={(e) => setNewCustPhone(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. 555-0199"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Address</label>
                          <input
                            type="text"
                            value={newCustAddress}
                            onChange={(e) => setNewCustAddress(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="Street, City"
                          />
                        </div>
                        {/* All registered customer profiles are corporate account holders with credit lines */}
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs transition"
                        >
                          Save Profile
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Register Driver inline */}
                  {isCreatingDriver && currentUser?.username === 'admin' && (
                    <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 shadow-md border border-slate-800">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest flex items-center">
                          <Truck className="h-4 w-4 mr-1.5 text-indigo-400" />
                          Register Driver
                        </h3>
                        <button
                          onClick={() => setIsCreatingDriver(false)}
                          className="text-slate-400 hover:text-white font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      <form onSubmit={handleCreateDriver} className="space-y-3.5 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Driver Name</label>
                          <input
                            type="text"
                            required
                            value={newDriverName}
                            onChange={(e) => setNewDriverName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. Liam Smith"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                          <input
                            type="text"
                            required
                            value={newDriverPhone}
                            onChange={(e) => setNewDriverPhone(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. 555-2233"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs transition-colors"
                        >
                          Register Driver
                        </button>
                      </form>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {activeTab === 'customers' && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header card with create button */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900"> Account Holders </h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">Manage delivery client directory and corporate accounts credit limits.</p>
                  </div>
                  {currentUser?.username === 'admin' && (
                    <button
                      onClick={() => {
                        setIsCreatingCustomer(true);
                        showToast('Use register client form under dispatch tab.', 'info');
                        setActiveTab('dispatch');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm self-start"
                    >
                      <UserPlus className="h-4 w-4 text-indigo-600" />
                      <span>Add New Customer</span>
                    </button>
                  )}
                </div>

                {/* Customer Table */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Phone</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Billing/Delivery Address</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Credit Balance</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Accounting Tools</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customers
                          .filter((c) => c.type === 'ACCOUNT_HOLDER')
                          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                          .map((c) => (
                          <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-800">{c.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-mono text-xs text-slate-600 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md">
                                {c.phone}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-slate-600 max-w-sm truncate font-medium" title={c.address}>
                                {c.address || 'No Address registered'}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight ${
                                c.type === 'ACCOUNT_HOLDER' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
                              }`}>
                                {c.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {c.type === 'ACCOUNT_HOLDER' ? (
                                <div className="text-sm font-black text-slate-800">
                                  Br {c.creditBalance.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400 font-mono">N/A (Cash customer)</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                              {c.type === 'ACCOUNT_HOLDER' && (
                                <>
                                  {c.creditBalance > 0 && (
                                    <button
                                      onClick={() => handleSettleBalance(c._id)}
                                      className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm"
                                    >
                                      Settle Balance
                                    </button>
                                  )}
                                  <button
                                    onClick={() => downloadAccountStatementExcel(c._id, c.name)}
                                    className="inline-flex items-center bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                                  >
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                                    Download Invoice (.xlsx)
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'drivers' && (
              <motion.div
                key="drivers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header card with create button */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Fleet Roster</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">Configure dispatcher's driver roster and toggle real-time availability.</p>
                  </div>
                  {currentUser?.username === 'admin' && (
                    <button
                      onClick={() => {
                        setIsCreatingDriver(true);
                        showToast('Use driver registration module under Dispatch tab.', 'info');
                        setActiveTab('dispatch');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm self-start"
                    >
                      <Plus className="h-4 w-4 text-indigo-600" />
                      <span>Add Driver</span>
                    </button>
                  )}
                </div>

                {/* Fleet Directory Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drivers
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                    .map((driver) => (
                    <div key={driver._id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">{driver.name}</h3>
                          <p className="text-xs font-mono text-slate-400 mt-1 font-medium">{driver.phone}</p>
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          driver.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : driver.status === 'BUSY'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-slate-50 text-slate-600 border border-slate-100'
                        }`}>
                          {driver.status}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Set Dispatcher Status:</p>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            onClick={() => handleUpdateDriverStatus(driver._id, 'AVAILABLE')}
                            className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-colors ${
                              driver.status === 'AVAILABLE'
                                ? 'bg-emerald-600 text-white shadow-sm font-black'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold'
                            }`}
                          >
                            Available
                          </button>
                          <button
                            onClick={() => handleUpdateDriverStatus(driver._id, 'BUSY')}
                            className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-colors ${
                              driver.status === 'BUSY'
                                ? 'bg-amber-600 text-white shadow-sm font-black'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold'
                            }`}
                          >
                            Busy
                          </button>
                          <button
                            onClick={() => handleUpdateDriverStatus(driver._id, 'INACTIVE')}
                            className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-colors ${
                              driver.status === 'INACTIVE'
                                ? 'bg-slate-600 text-white shadow-sm font-black'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold'
                            }`}
                          >
                            Inactive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'sms' && (
              <motion.div
                key="sms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header Widget */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <Send className="h-5 w-5 text-indigo-600" />
                      Android SMS Gateway Integration Hub
                    </h2>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Configure your local Android SMS Gateway to dispatch real SMS notifications to customers and dispatchers. 
                      Since Negadras Dispatch is hosted in the Cloud, you must provide a public address (e.g., ngrok tunnel or port forwarded static IP) for live automated dispatch triggers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      smsConfig.activeAddressType === 'simulated'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${smsConfig.activeAddressType === 'simulated' ? 'bg-blue-500' : 'bg-emerald-500 animate-pulse'}`} />
                      Mode: {smsConfig.activeAddressType === 'simulated' ? 'Simulation (Sandbox)' : smsConfig.activeAddressType === 'public' ? 'Public Gateway' : 'Local Gateway'}
                    </span>
                    <button
                      onClick={fetchDashboardData}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-700 hover:text-indigo-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Main Config & Logger Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Panel: Gateway Settings & Test Utility */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Settings Form Card */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Smartphone className="h-5 w-5 text-indigo-500" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Gateway Configuration</h3>
                          <p className="text-[10px] text-slate-400 font-medium">Link your android-gateway APK credentials</p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveSmsConfig} className="space-y-4">
                        {/* Radio select for Active Mode */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gateway Operation Mode</label>
                          <div className="grid grid-cols-3 gap-2">
                            <label className={`flex flex-col items-center justify-center p-2.5 border rounded-lg cursor-pointer transition-colors text-center ${
                              smsConfig.activeAddressType === 'simulated'
                                ? 'bg-indigo-50/50 border-indigo-500 text-indigo-700 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}>
                              <input
                                type="radio"
                                name="activeAddressType"
                                value="simulated"
                                checked={smsConfig.activeAddressType === 'simulated'}
                                onChange={(e) => setSmsConfig({ ...smsConfig, activeAddressType: e.target.value })}
                                className="sr-only"
                              />
                              <span className="text-[10px] font-bold block uppercase tracking-tight">Sandbox</span>
                              <span className="text-[8px] text-slate-400 mt-0.5">Simulated logs only</span>
                            </label>

                            <label className={`flex flex-col items-center justify-center p-2.5 border rounded-lg cursor-pointer transition-colors text-center ${
                              smsConfig.activeAddressType === 'public'
                                ? 'bg-indigo-50/50 border-indigo-500 text-indigo-700 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}>
                              <input
                                type="radio"
                                name="activeAddressType"
                                value="public"
                                checked={smsConfig.activeAddressType === 'public'}
                                onChange={(e) => setSmsConfig({ ...smsConfig, activeAddressType: e.target.value })}
                                className="sr-only"
                              />
                              <span className="text-[10px] font-bold block uppercase tracking-tight">Public URL</span>
                              <span className="text-[8px] text-slate-400 mt-0.5">Internet Tunnel (Cloud)</span>
                            </label>

                            <label className={`flex flex-col items-center justify-center p-2.5 border rounded-lg cursor-pointer transition-colors text-center ${
                              smsConfig.activeAddressType === 'local'
                                ? 'bg-indigo-50/50 border-indigo-500 text-indigo-700 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}>
                              <input
                                type="radio"
                                name="activeAddressType"
                                value="local"
                                checked={smsConfig.activeAddressType === 'local'}
                                onChange={(e) => setSmsConfig({ ...smsConfig, activeAddressType: e.target.value })}
                                className="sr-only"
                              />
                              <span className="text-[10px] font-bold block uppercase tracking-tight">Local IP</span>
                              <span className="text-[8px] text-slate-400 mt-0.5">Wi-Fi (Host-Only)</span>
                            </label>
                          </div>
                        </div>

                        {/* Public Address */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                            <span>Public Address / Tunnel</span>
                            <span className="text-indigo-600 font-bold text-[9px] uppercase">Recommended for Cloud Run</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <Wifi className="h-3.5 w-3.5" />
                            </div>
                            <input
                              type="text"
                              value={smsConfig.publicAddress}
                              onChange={(e) => setSmsConfig({ ...smsConfig, publicAddress: e.target.value })}
                              placeholder="https://your-tunnel-subdomain.ngrok-free.app"
                              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                        </div>

                        {/* Local Address */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Local Network Address</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <Smartphone className="h-3.5 w-3.5" />
                            </div>
                            <input
                              type="text"
                              value={smsConfig.localAddress}
                              onChange={(e) => setSmsConfig({ ...smsConfig, localAddress: e.target.value })}
                              placeholder="http://192.168.1.15:8080"
                              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                        </div>

                        {/* Basic Auth Username & Password */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Username</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Users className="h-3.5 w-3.5" />
                              </div>
                              <input
                                type="text"
                                value={smsConfig.username}
                                onChange={(e) => setSmsConfig({ ...smsConfig, username: e.target.value })}
                                placeholder="Gateway Login"
                                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Password</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Lock className="h-3.5 w-3.5" />
                              </div>
                              <input
                                type="password"
                                value={smsConfig.password}
                                onChange={(e) => setSmsConfig({ ...smsConfig, password: e.target.value })}
                                placeholder="••••••••"
                                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Device ID target */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Device ID (Optional)</label>
                            <input
                              type="text"
                              value={smsConfig.deviceId}
                              onChange={(e) => setSmsConfig({ ...smsConfig, deviceId: e.target.value })}
                              placeholder="e.g. VKcoNgx..."
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SIM Card Slot</label>
                            <select
                              value={smsConfig.simNumber}
                              onChange={(e) => setSmsConfig({ ...smsConfig, simNumber: e.target.value })}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">Default SIM (Auto)</option>
                              <option value="1">SIM 1</option>
                              <option value="2">SIM 2</option>
                              <option value="3">SIM 3</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Carrier Phone Format</label>
                            <select
                              value={smsConfig.phoneFormat}
                              onChange={(e) => setSmsConfig({ ...smsConfig, phoneFormat: e.target.value })}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="as_entered">Unmodified (As Entered)</option>
                              <option value="with_plus">With Plus Sign (+2519...)</option>
                              <option value="no_plus">Without Plus (2519...)</option>
                              <option value="local">Local Format (09...)</option>
                            </select>
                          </div>
                        </div>

                        {/* Save Trigger */}
                        <button
                          type="submit"
                          disabled={isSmsConfigSaving}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-55"
                        >
                          {isSmsConfigSaving ? (
                            <>
                              <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                              <span>Saving Settings...</span>
                            </>
                          ) : (
                            <span>Commit Gateway Credentials</span>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Test Terminal Card */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Send className="h-5 w-5 text-indigo-500" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Line Verification Tool</h3>
                          <p className="text-[10px] text-slate-400 font-medium">Verify direct outbound gateway transport</p>
                        </div>
                      </div>

                      <form onSubmit={handleTestSms} className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Recipient Mobile Number</label>
                          <input
                            type="tel"
                            required
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="e.g., +251911XXXXXX"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Custom Test Text</label>
                          <textarea
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder="Negadras Dispatch test alert. Operational check."
                            rows={2}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isTestSmsSending}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-55"
                        >
                          {isTestSmsSending ? (
                            <>
                              <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                              <span>Dispatching SMS...</span>
                            </>
                          ) : (
                            <span>Transmit Live Test Packet</span>
                          )}
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Right Panel: Sent Messages Logs Auditor */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-sm font-bold text-slate-800">Gateway Outbound Audit Log</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                        {smsLogs.length} Records
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1">
                      {smsLogs.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 font-medium">
                          <Send className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm font-bold text-slate-700">No telemetry logs logged</p>
                          <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                            No dispatch messages have been transmitted during this runtime session. Triggering new delivery dispatches or using the Line Verification Tool will populate real-time entries.
                          </p>
                        </div>
                      ) : (
                        smsLogs.map((log) => (
                          <div
                            key={log.id}
                            className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                          >
                            <div className="space-y-1.5 w-full sm:w-auto flex-1">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="text-sm font-bold text-slate-800">{log.recipientName}</span>
                                <span className="font-mono text-xs text-slate-400 font-bold">({log.recipientPhone})</span>
                                <span className={`inline-block text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                  log.role === 'DRIVER' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {log.role}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 font-mono bg-slate-50 p-3 rounded-lg border border-slate-100/70 whitespace-pre-line leading-relaxed">
                                {log.message}
                              </p>
                              {log.error && (
                                <div className="text-[10px] text-red-600 font-semibold bg-red-50 p-2 rounded-md border border-red-100 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                  <span>Error: {log.error}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 font-mono font-medium">
                                Timestamp: {new Date(log.timestamp).toLocaleString()}
                              </div>
                            </div>

                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${
                              log.status === 'SIMULATED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : log.status === 'SENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-red-50 text-red-700 border border-red-100 animate-pulse'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {activeTab === 'admin' && currentUser?.username === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Admin Header Banner */}
                <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-md relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 opacity-10">
                    <KeyRound className="h-40 w-40" />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
                      System Administration
                    </div>
                    <h2 className="text-2xl font-black mt-2 flex items-center">
                      <KeyRound className="h-6 w-6 mr-2 text-indigo-400" />
                      Negadras Admin Control Center
                    </h2>
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      Privileged actions only. Securely register new client corporate accounts, manage driver rosters, and adjust balances.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Register Customer Form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center">
                        <UserPlus className="h-5 w-5 mr-2 text-indigo-600" />
                        Onboard Corporate Customer
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Add a new corporate partner or account holder to the dispatch database.</p>
                    </div>

                    <form onSubmit={handleCreateCustomer} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="e.g. Acme Corporation"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          required
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="e.g. 555-0100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Primary Delivery Address
                        </label>
                        <input
                          type="text"
                          required
                          value={newCustAddress}
                          onChange={(e) => setNewCustAddress(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="e.g. 102 Broadway, Suite 4B"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Account Profile Type
                        </label>
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium">
                          REGISTERED CORPORATE (Credit Terms Enabled)
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors duration-150 focus:outline-none"
                      >
                        Create Customer Profile
                      </button>
                    </form>
                  </div>

                  {/* Register Driver Form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center">
                        <Truck className="h-5 w-5 mr-2 text-indigo-600" />
                        Hire & Register Fleet Driver
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Hire a new driver for standard or priority dispatcher delivery tasks.</p>
                    </div>

                    <form onSubmit={handleCreateDriver} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Driver's Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newDriverName}
                          onChange={(e) => setNewDriverName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="e.g. Alexander Green"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Driver's Phone Number
                        </label>
                        <input
                          type="text"
                          required
                          value={newDriverPhone}
                          onChange={(e) => setNewDriverPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                          placeholder="e.g. 555-0155"
                        />
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-500 leading-relaxed font-medium">
                        💡 <strong className="text-slate-700">Roster Integration Note:</strong> Newly registered drivers are automatically marked as <span className="text-emerald-600 font-extrabold">AVAILABLE</span> on the Dispatcher Board. Outbound dispatch notification triggers will immediately listen for status logs on this line.
                      </div>

                      <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors duration-150 focus:outline-none"
                      >
                        Register Roster Driver
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mini informational Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-[10px] text-slate-400 font-bold tracking-wider uppercase">
        Negadras Dispatch System v1.0.0
      </footer>

      {/* Settle Balance Custom Confirmation Dialog */}
      <AnimatePresence>
        {customerToSettle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden"
            >
              <div className="p-6 space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Settle Statement Balance</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Are you sure you want to settle the outstanding balance for <strong className="text-slate-800">{customerToSettle.name}</strong>?
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="text-slate-800 font-bold">{customerToSettle.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Phone number:</span>
                    <span className="text-slate-800 font-mono font-medium">{customerToSettle.phone}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500 font-bold">Outstanding Balance:</span>
                    <span className="text-indigo-600 font-black text-sm">Br {customerToSettle.creditBalance.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  ⚠️ This action will immediately reset the client's credit ledger balance to <strong className="text-slate-600">Br 0.00</strong> and mark all unpaid orders assigned to this account statement as <strong className="text-slate-600">SETTLED</strong> on the database.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    disabled={isSettlingInProgress}
                    onClick={() => setCustomerToSettle(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isSettlingInProgress}
                    onClick={executeSettleBalance}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSettlingInProgress ? (
                      <>
                        <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1" />
                        <span>Settling...</span>
                      </>
                    ) : (
                      <span>Confirm Settlement</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
