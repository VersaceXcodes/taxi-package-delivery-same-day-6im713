import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Types based on backend API schemas
interface DashboardStats {
  total_orders: number;
  total_spent: number;
  total_earned: number;
  average_rating: number;
  active_orders_count: number;
  completed_orders_count: number;
}

interface DeliveryOrder {
  uid: string;
  order_number: string;
  sender_id: string;
  courier_id: string;
  pickup_address_id: string;
  delivery_address_id: string;
  recipient_name: string;
  recipient_phone: string;
  status: 'pending' | 'courier_assigned' | 'pickup_in_progress' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  urgency_level: 'asap' | '1_hour' | '2_hours' | '4_hours' | 'scheduled';
  total_amount: number;
  pickup_address?: {
    street_address: string;
    city: string;
    state: string;
  };
  delivery_address?: {
    street_address: string;
    city: string;
    state: string;
  };
  package?: {
    package_type: string;
    size_category: string;
    declared_value: number;
  };
  courier?: {
    uid: string;
    first_name: string;
    profile_image_url: string;
  };
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  created_at: string;
  updated_at: string;
}

interface SavedAddress {
  uid: string;
  user_id: string;
  address_id: string;
  label: string;
  is_default_pickup: boolean;
  is_default_delivery: boolean;
  address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
  };
}

interface PaymentMethod {
  uid: string;
  user_id: string;
  payment_type: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay';
  card_last_four: string;
  card_brand: 'visa' | 'mastercard' | 'amex';
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
  is_active: boolean;
}

interface User {
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
  is_verified: boolean;
}

// API functions with proper error handling and backend-compliant endpoints
const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/dashboard/stats`);
  return data.data;
};

const fetchActiveDeliveries = async (): Promise<DeliveryOrder[]> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders?status=pending,courier_assigned,pickup_in_progress,in_transit`);
  return data.data.orders || [];
};

const fetchRecentDeliveries = async (): Promise<DeliveryOrder[]> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders?limit=5&page=1`);
  return data.data.orders || [];
};

const fetchSavedAddresses = async (): Promise<SavedAddress[]> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/addresses`);
  return data.data || [];
};

const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payments/methods`);
  return data.data || [];
};

const SenderDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const highlightOrderId = searchParams.get('order');
  const showWelcome = searchParams.get('welcome') === 'true';
  const queryClient = useQueryClient();

  // Mock current user - replace with actual auth state
  const currentUser: User | null = {
    uid: '1',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    is_verified: true
  };

  const unreadCount = 0;
  const realTimeData = { statusChanges: [] };

  // React Query hooks with proper error handling
  const { data: dashboardStats, isLoading: statsLoading, isError: statsError, error: statsErrorObj } = useQuery<DashboardStats, Error>({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    retry: 2,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const { data: activeDeliveries, isLoading: activeLoading, isError: activeError, error: activeErrorObj } = useQuery<DeliveryOrder[], Error>({
    queryKey: ['activeDeliveries'],
    queryFn: fetchActiveDeliveries,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2
  });

  const { data: recentDeliveries, isLoading: recentLoading, isError: recentError } = useQuery<DeliveryOrder[], Error>({
    queryKey: ['recentDeliveries'],
    queryFn: fetchRecentDeliveries,
    retry: 2
  });

  const { data: savedAddresses, isLoading: addressesLoading, isError: addressesError } = useQuery<SavedAddress[], Error>({
    queryKey: ['savedAddresses'],
    queryFn: fetchSavedAddresses,
    retry: 2
  });

  const { data: paymentMethods, isLoading: paymentLoading, isError: paymentError } = useQuery<PaymentMethod[], Error>({
    queryKey: ['paymentMethods'],
    queryFn: fetchPaymentMethods,
    retry: 2
  });

  // Handle real-time updates
  useEffect(() => {
    if (realTimeData.statusChanges.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['activeDeliveries'] });
    }
  }, [realTimeData.statusChanges, queryClient]);

  // Helper functions
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'courier_assigned':
        return 'bg-blue-100 text-blue-800';
      case 'pickup_in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'in_transit':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Address not available';
    return `${address.street_address}, ${address.city}, ${address.state}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome Banner */}
      {showWelcome && (
        <div className="bg-blue-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Welcome to QuickCourier, {currentUser?.first_name}!</p>
                <p className="text-sm text-blue-100">Your account is set up and ready to go. Start by sending your first delivery.</p>
              </div>
            </div>
            <button
              type="button"
              className="flex-shrink-0 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {currentUser?.first_name || 'User'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your deliveries and track your packages
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {unreadCount > 0 && (
              <div className="relative">
                <button
                  type="button"
                  className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.077 7.077A3 3 0 0115 10v5l2.5 2.5H18.5" />
                  </svg>
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                </button>
              </div>
            )}
            <Link
              to="/request-delivery"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Delivery
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'active', label: 'Active Deliveries' },
              { id: 'history', label: 'History' },
              { id: 'account', label: 'Account' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))
              ) : statsError ? (
                <div className="col-span-full bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800">Failed to load dashboard statistics: {statsErrorObj?.message}</p>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg shadow p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{dashboardStats?.total_orders || 0}</dd>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Spent</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{formatCurrency(dashboardStats?.total_spent || 0)}</dd>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed Orders</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{dashboardStats?.completed_orders_count || 0}</dd>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Deliveries</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{dashboardStats?.active_orders_count || 0}</dd>
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    to="/request-delivery"
                    className="relative group bg-blue-50 p-6 rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors"
                  >
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <h4 className="mt-2 text-sm font-medium text-gray-900">New Delivery</h4>
                      <p className="mt-1 text-sm text-gray-500">Create a new delivery request</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Deliveries Preview */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Active Deliveries</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('active')}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    View all
                  </button>
                </div>
                <div className="p-6">
                  {activeLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : activeError ? (
                    <p className="text-red-600 text-sm">Failed to load active deliveries: {activeErrorObj?.message}</p>
                  ) : activeDeliveries && activeDeliveries.length > 0 ? (
                    <div className="space-y-4">
                      {activeDeliveries.slice(0, 3).map((delivery) => (
                        <div
                          key={delivery.uid}
                          className={`border rounded-lg p-4 ${
                            highlightOrderId === delivery.uid ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">#{delivery.order_number}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(delivery.status)}`}>
                              {formatStatus(delivery.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            From: {formatAddress(delivery.pickup_address)}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            To: {formatAddress(delivery.delivery_address)}
                          </p>
                          {delivery.courier && (
                            <div className="flex items-center mt-2 text-sm text-gray-500">
                              <img
                                src={delivery.courier.profile_image_url || `https://picsum.photos/32/32?random=${delivery.courier.uid}`}
                                alt={delivery.courier.first_name}
                                className="h-6 w-6 rounded-full mr-2"
                              />
                              Courier: {delivery.courier.first_name}
                            </div>
                          )}
                          <div className="mt-2">
                            <Link
                              to={`/track/${delivery.uid}`}
                              className="text-sm text-blue-600 hover:text-blue-500"
                            >
                              Track delivery →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v4m-6 0h6m0 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No active deliveries</h3>
                      <p className="mt-1 text-sm text-gray-500">Get started by creating your first delivery.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Deliveries Preview */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Recent Deliveries</h3>
                  <Link
                    to="/history"
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    View all
                  </Link>
                </div>
                <div className="p-6">
                  {recentLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : recentError ? (
                    <p className="text-red-600 text-sm">Failed to load recent deliveries</p>
                  ) : recentDeliveries && recentDeliveries.length > 0 ? (
                    <div className="space-y-4">
                      {recentDeliveries.map((delivery) => (
                        <div key={delivery.uid} className="border-b border-gray-200 pb-4 last:border-b-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">#{delivery.order_number}</span>
                            <span className="text-sm text-gray-500">{formatCurrency(delivery.total_amount)}</span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {formatAddress(delivery.pickup_address)} → {formatAddress(delivery.delivery_address)}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">
                              {delivery.actual_delivery_time ? new Date(delivery.actual_delivery_time).toLocaleDateString() : 'In Progress'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No recent deliveries</h3>
                      <p className="mt-1 text-sm text-gray-500">Your delivery history will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Deliveries Tab */}
        {activeTab === 'active' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Active Deliveries</h3>
              </div>
              <div className="p-6">
                {activeLoading ? (
                  <div className="space-y-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="border rounded-lg p-6 animate-pulse">
                        <div className="flex justify-between items-start mb-4">
                          <div className="h-6 bg-gray-200 rounded w-32"></div>
                          <div className="h-6 bg-gray-200 rounded w-24"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeError ? (
                  <div className="text-center py-6">
                    <p className="text-red-600">Failed to load active deliveries: {activeErrorObj?.message}</p>
                  </div>
                ) : activeDeliveries && activeDeliveries.length > 0 ? (
                  <div className="space-y-6">
                    {activeDeliveries.map((delivery) => (
                      <div
                        key={delivery.uid}
                        className={`border rounded-lg p-6 ${
                          highlightOrderId === delivery.uid ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">#{delivery.order_number}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(delivery.status)}`}>
                              {formatStatus(delivery.status)}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <Link
                              to={`/track/${delivery.uid}`}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Track
                            </Link>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Delivery Details</h5>
                            <div className="space-y-2 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">From:</span> {formatAddress(delivery.pickup_address)}
                              </div>
                              <div>
                                <span className="font-medium">To:</span> {formatAddress(delivery.delivery_address)}
                              </div>
                              {delivery.package && (
                                <div>
                                  <span className="font-medium">Package:</span> {delivery.package.package_type} ({delivery.package.size_category})
                                </div>
                              )}
                            </div>
                          </div>

                          {delivery.courier && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-2">Courier Information</h5>
                              <div className="flex items-center space-x-3">
                                <img
                                  src={delivery.courier.profile_image_url || `https://picsum.photos/48/48?random=${delivery.courier.uid}`}
                                  alt={delivery.courier.first_name}
                                  className="h-12 w-12 rounded-full"
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{delivery.courier.first_name}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v4m-6 0h6m0 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No active deliveries</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first delivery.</p>
                    <div className="mt-6">
                      <Link
                        to="/request-delivery"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Delivery
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Delivery History</h3>
                <Link
                  to="/history"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Full History
                </Link>
              </div>
              <div className="p-6">
                {recentLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse border-b border-gray-200 pb-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : recentError ? (
                  <div className="text-center py-6">
                    <p className="text-red-600">Failed to load delivery history</p>
                  </div>
                ) : recentDeliveries && recentDeliveries.length > 0 ? (
                  <div className="space-y-4">
                    {recentDeliveries.map((delivery) => (
                      <div key={delivery.uid} className="border-b border-gray-200 pb-4 last:border-b-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">#{delivery.order_number}</h4>
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(delivery.total_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-gray-600">
                            <p className="truncate">{formatAddress(delivery.pickup_address)} → {formatAddress(delivery.delivery_address)}</p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {formatStatus(delivery.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {delivery.actual_delivery_time ? new Date(delivery.actual_delivery_time).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            }) : 'Date not available'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No delivery history</h3>
                    <p className="mt-1 text-sm text-gray-500">Your completed deliveries will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            {/* Profile Summary */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Profile Summary</h3>
              </div>
              <div className="p-6">
                <div className="flex items-center space-x-4">
                  <img
                    src={currentUser?.profile_image_url || `https://picsum.photos/64/64?random=${currentUser?.uid}`}
                    alt={currentUser?.first_name}
                    className="h-16 w-16 rounded-full"
                  />
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900">
                      {currentUser?.first_name} {currentUser?.last_name}
                    </h4>
                    <p className="text-sm text-gray-500">{currentUser?.email}</p>
                    <div className="flex items-center mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentUser?.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {currentUser?.is_verified ? 'Verified' : 'Pending Verification'}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Saved Addresses */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Saved Addresses</h3>
                  <Link
                    to="/profile?section=addresses"
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Manage
                  </Link>
                </div>
                <div className="p-6">
                  {addressesLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-1"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                      ))}
                    </div>
                  ) : addressesError ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-red-600">Failed to load addresses</p>
                    </div>
                  ) : savedAddresses && savedAddresses.length > 0 ? (
                    <div className="space-y-3">
                      {savedAddresses.slice(0, 3).map((address) => (
                        <div key={address.uid} className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 flex items-center">
                              {address.label}
                              {address.is_default_pickup && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Default
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {address.address.street_address}, {address.address.city}, {address.address.state}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No saved addresses</p>
                      <Link
                        to="/profile?section=addresses"
                        className="text-sm text-blue-600 hover:text-blue-500"
                      >
                        Add an address
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
                  <Link
                    to="/profile?section=payment"
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Manage
                  </Link>
                </div>
                <div className="p-6">
                  {paymentLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/3 mb-1"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : paymentError ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-red-600">Failed to load payment methods</p>
                    </div>
                  ) : paymentMethods && paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {paymentMethods.slice(0, 3).map((method) => (
                        <div key={method.uid} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900 flex items-center">
                                {method.card_brand} ****{method.card_last_four}
                                {method.is_default && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Default
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500">
                                Expires {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year.toString().slice(-2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No payment methods</p>
                      <Link
                        to="/profile?section=payment"
                        className="text-sm text-blue-600 hover:text-blue-500"
                      >
                        Add a payment method
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SenderDashboard;