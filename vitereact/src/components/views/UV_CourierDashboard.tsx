import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Interfaces matching backend schema
interface CourierProfile {
  uid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  profile_image_url?: string;
  user_type: string;
  is_verified: boolean;
  is_active: boolean;
  total_deliveries: number;
  average_rating: number;
  total_earnings: number;
  created_at: string;
}

interface AvailabilityStatus {
  is_available: boolean;
  availability_status: 'online' | 'offline' | 'on_break' | 'in_delivery';
  break_duration_minutes?: number;
  break_start_time?: string;
  shift_start_time?: string;
  shift_end_time?: string;
  last_update: string;
}

interface EarningsData {
  period_earnings: number;
  total_earnings: number;
  total_deliveries: number;
  average_earning_per_delivery: number;
  earnings_breakdown: Array<{
    order_id: string;
    completed_at: string;
    earnings: number;
  }>;
}

interface DeliveryOrder {
  uid: string;
  order_number: string;
  sender_id: string;
  courier_id?: string;
  status: 'pending' | 'courier_assigned' | 'pickup_in_progress' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  pickup_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude?: number;
    longitude?: number;
  };
  delivery_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude?: number;
    longitude?: number;
  };
  recipient_name: string;
  recipient_phone: string;
  total_amount: number;
  courier_earnings: number;
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  package: {
    package_type: string;
    size_category: string;
    estimated_weight?: number;
    special_handling_notes?: string;
  };
}

interface Assignment {
  assignment_id: string;
  order: DeliveryOrder;
  assignment_status: string;
  offered_at: string;
  response_deadline: string;
  estimated_earnings: number;
  distance_to_pickup: number;
}

interface DashboardStats {
  total_orders: number;
  total_earned: number;
  average_rating: number;
  active_orders_count: number;
  completed_orders_count: number;
}

interface DashboardData {
  user_type: 'courier';
  active_orders: DeliveryOrder[];
  recent_orders: DeliveryOrder[];
  stats: DashboardStats;
}

// Configure axios with auth
const createAuthenticatedAxios = (token: string) => {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return instance;
};

// API Functions
const fetchCourierDashboard = async (token: string): Promise<DashboardData> => {
  const axiosInstance = createAuthenticatedAxios(token);
  const { data } = await axiosInstance.get('/api/dashboard');
  return data.data;
};

const fetchCourierAvailability = async (token: string): Promise<AvailabilityStatus> => {
  const axiosInstance = createAuthenticatedAxios(token);
  const { data } = await axiosInstance.get('/api/couriers/availability');
  return data.data;
};

const fetchCourierEarnings = async (token: string, period: string = 'month'): Promise<EarningsData> => {
  const axiosInstance = createAuthenticatedAxios(token);
  const { data } = await axiosInstance.get(`/api/couriers/earnings?period=${period}`);
  return data.data;
};

const fetchCourierAssignments = async (token: string, activeOnly: boolean = false): Promise<Assignment[]> => {
  const axiosInstance = createAuthenticatedAxios(token);
  const { data } = await axiosInstance.get(`/api/couriers/assignments?active_only=${activeOnly}`);
  return data.data;
};

const updateAvailabilityStatus = async (token: string, status: { is_available: boolean; availability_status: string; break_duration_minutes?: number }): Promise<void> => {
  const axiosInstance = createAuthenticatedAxios(token);
  await axiosInstance.put('/api/couriers/availability', status);
};

const respondToAssignment = async (token: string, assignmentId: string, response: 'accept' | 'decline'): Promise<void> => {
  const axiosInstance = createAuthenticatedAxios(token);
  await axiosInstance.post(`/api/couriers/assignments/${assignmentId}/respond`, { response });
};

const updateOrderStatus = async (token: string, orderId: string, status: string): Promise<void> => {
  const axiosInstance = createAuthenticatedAxios(token);
  await axiosInstance.put(`/api/orders/${orderId}`, { status });
};

const UV_CourierDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  // Global state
  const { authenticationState } = useAppStore();
  const token = authenticationState.token;

  // Local state variables
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [highlightedAssignment, setHighlightedAssignment] = useState(searchParams.get('assignment') || null);
  const [showOnboarding, setShowOnboarding] = useState(searchParams.get('onboarding') === 'true');
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery<DashboardData, Error>({
    queryKey: ['courierDashboard'],
    queryFn: () => fetchCourierDashboard(token),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<AvailabilityStatus, Error>({
    queryKey: ['courierAvailability'],
    queryFn: () => fetchCourierAvailability(token),
    enabled: !!token,
    refetchInterval: 10000,
  });

  const { data: earningsData } = useQuery<EarningsData, Error>({
    queryKey: ['courierEarnings'],
    queryFn: () => fetchCourierEarnings(token),
    enabled: !!token,
  });

  const { data: assignmentsData } = useQuery<Assignment[], Error>({
    queryKey: ['courierAssignments'],
    queryFn: () => fetchCourierAssignments(token),
    enabled: !!token,
    refetchInterval: 15000,
  });

  // Mutations with error handling
  const availabilityMutation = useMutation<void, Error, { is_available: boolean; availability_status: string; break_duration_minutes?: number }>({
    mutationFn: (status) => updateAvailabilityStatus(token, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courierAvailability'] });
      setError(null);
    },
    onError: (error) => {
      setError('Failed to update availability status');
      console.error('Availability update error:', error);
    },
  });

  const assignmentResponseMutation = useMutation<void, Error, { assignmentId: string; response: 'accept' | 'decline' }>({
    mutationFn: ({ assignmentId, response }) => respondToAssignment(token, assignmentId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courierAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['courierDashboard'] });
      setError(null);
    },
    onError: (error) => {
      setError('Failed to respond to assignment');
      console.error('Assignment response error:', error);
    },
  });

  const statusUpdateMutation = useMutation<void, Error, { orderId: string; status: string }>({
    mutationFn: ({ orderId, status }) => updateOrderStatus(token, orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courierDashboard'] });
      setError(null);
    },
    onError: (error) => {
      setError('Failed to update order status');
      console.error('Status update error:', error);
    },
  });

  // Handle availability toggle
  const handleAvailabilityToggle = () => {
    if (availabilityData) {
      const newStatus = availabilityData.is_available ? 'offline' : 'online';
      availabilityMutation.mutate({ 
        is_available: !availabilityData.is_available,
        availability_status: newStatus
      });
    }
  };

  // Handle break scheduling
  const handleBreakSchedule = (duration: number) => {
    availabilityMutation.mutate({ 
      is_available: false, 
      availability_status: 'on_break', 
      break_duration_minutes: duration 
    });
  };

  // Handle assignment responses
  const handleAcceptAssignment = (assignmentId: string) => {
    assignmentResponseMutation.mutate({ assignmentId, response: 'accept' });
  };

  const handleDeclineAssignment = (assignmentId: string) => {
    assignmentResponseMutation.mutate({ assignmentId, response: 'decline' });
  };

  // Handle order status updates
  const handleStatusUpdate = (orderId: string, status: string) => {
    statusUpdateMutation.mutate({ orderId, status });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Check authentication
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access your courier dashboard.</p>
          <Link 
            to="/login"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (dashboardLoading || availabilityLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (dashboardError || !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Unable to load dashboard</h2>
          <p className="text-gray-600 mb-4">Please check your connection and try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-800 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img
                src={authenticationState.user?.profile_image_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                alt="Profile"
                className="h-10 w-10 rounded-full"
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Welcome back, {authenticationState.user?.first_name || 'Courier'}
                </h1>
                <p className="text-sm text-gray-500">
                  Courier Dashboard
                </p>
              </div>
            </div>
            {/* Availability Toggle */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">
                  {availabilityData?.is_available ? 'Online' : 'Offline'}
                </span>
                <button
                  onClick={handleAvailabilityToggle}
                  disabled={availabilityMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    availabilityData?.is_available ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      availabilityData?.is_available ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {/* Break Schedule */}
              {availabilityData?.is_available && (
                <div className="relative">
                  <select
                    onChange={(e) => e.target.value && handleBreakSchedule(parseInt(e.target.value, 10))}
                    className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue=""
                  >
                    <option value="" disabled>Take Break</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Break Timer Banner */}
      {availabilityData?.availability_status === 'on_break' && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-800 font-medium">On Break</span>
              </div>
              <button
                onClick={() => availabilityMutation.mutate({ is_available: true, availability_status: 'online' })}
                className="text-yellow-800 hover:text-yellow-900 font-medium text-sm"
              >
                End Break
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'deliveries', label: 'Active Deliveries' },
              { id: 'offers', label: 'Pending Offers' },
              { id: 'earnings', label: 'Earnings' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
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
      </div>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold">$</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Earned</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(dashboardData.stats.total_earnings || 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">#</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboardData.stats.total_orders || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold">⚡</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Active Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboardData.stats.active_orders_count || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-semibold">★</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Rating</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboardData.stats.average_rating?.toFixed(1) || '0.0'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Active Orders Summary */}
            {dashboardData.active_orders.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Active Orders</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {dashboardData.active_orders.slice(0, 2).map((order) => (
                      <div
                        key={order.uid}
                        className={`border rounded-lg p-4 ${highlightedAssignment === order.uid ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">#{order.order_number}</h4>
                            <p className="text-sm text-gray-500">
                              {order.pickup_address.street_address} → {order.delivery_address.street_address}
                            </p>
                            <p className="text-sm text-green-600 font-medium">
                              {formatCurrency(order.courier_earnings || 0)}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Link
                              to={`/orders/${order.uid}`}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              View Details
                            </Link>
                            <button
                              onClick={() => handleStatusUpdate(order.uid, 'in_transit')}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                            >
                              Update Status
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Pending Assignments */}
            {assignmentsData && assignmentsData.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Pending Assignments</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {assignmentsData.slice(0, 3).map((assignment) => (
                      <div key={assignment.assignment_id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">#{assignment.order.order_number}</h4>
                            <p className="text-sm text-gray-500">
                              {assignment.distance_to_pickup.toFixed(1)} mi away
                            </p>
                            <p className="text-sm text-green-600 font-medium">
                              {formatCurrency(assignment.estimated_earnings)}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAcceptAssignment(assignment.assignment_id)}
                              disabled={assignmentResponseMutation.isPending}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineAssignment(assignment.assignment_id)}
                              disabled={assignmentResponseMutation.isPending}
                              className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Other tabs would be implemented similarly with proper data mapping */}
        {activeTab !== 'overview' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Tab content for {activeTab} is under development.</p>
          </div>
        )}
      </div>
      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Welcome to QuickCourier!</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  You're all set to start earning! Toggle your availability to receive delivery offers.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-600"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_CourierDashboard;