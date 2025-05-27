import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Interfaces updated to match API schema
interface DeliveryOrder {
  uid: string;
  order_number: string;
  created_at: string;
  pickup_address: {
    street_address: string;
    apartment_unit?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  delivery_address: {
    street_address: string;
    apartment_unit?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  recipient_name: string;
  status: 'pending' | 'courier_assigned' | 'pickup_in_progress' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  total_amount: number;
  actual_pickup_time?: string;
  actual_delivery_time?: string;
  courier?: {
    uid: string;
    first_name: string;
    last_name: string;
    profile_image_url?: string;
  };
  package: {
    package_type: string;
    size_category: string;
    special_handling_notes?: string;
    delivery_photo_url?: string;
  };
}

interface DeliveryHistoryResponse {
  success: boolean;
  data: {
    orders: DeliveryOrder[];
    pagination: {
      current_page: number;
      total_pages: number;
      total_count: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
}

interface FilterState {
  date_from: string;
  date_to: string;
  status: string[];
  search_query: string;
  price_min: number;
  price_max: number;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

const UV_DeliveryHistory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global state
  const { currentUser, authenticationStatus } = useAppStore(state => ({
    currentUser: state.authenticationState?.currentUser,
    authenticationStatus: state.authenticationState?.authenticationStatus
  }));

  // Local state
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'table'>('table');
  const [showExportModal, setShowExportModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    status: searchParams.get('status')?.split(',').filter(Boolean) || [],
    search_query: searchParams.get('search') || '',
    price_min: 0,
    price_max: 1000,
    sort_by: 'created_at',
    sort_order: 'desc'
  });

  // Authentication check
  useEffect(() => {
    if (!authenticationStatus?.isLoading && !authenticationStatus?.isAuthenticated) {
      navigate('/login?returnUrl=/history');
      return;
    }
    if (currentUser && currentUser.user_type !== 'sender') {
      navigate('/dashboard');
      return;
    }
  }, [authenticationStatus, currentUser, navigate]);

  // Current page from URL
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Get auth token for API requests
  const authToken = useAppStore(state => state.authenticationState?.token);

  // Data fetching functions
  const fetchDeliveryHistory = async (): Promise<DeliveryHistoryResponse> => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: '25',
      ...(filters.date_from && { date_from: filters.date_from }),
      ...(filters.date_to && { date_to: filters.date_to }),
      ...(filters.status.length > 0 && { status: filters.status.join(',') })
    });

    const { data } = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders?${params}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );
    return data;
  };

  // Export mutation (simplified without analytics)
  const exportMutation = useMutation({
    mutationFn: async (exportConfig: { format: string; fields: string[]; order_ids?: string[] }) => {
      // Since export endpoint doesn't exist, we'll create a simple CSV export client-side
      if (!historyData?.data.orders) throw new Error('No data to export');
      
      const ordersToExport = exportConfig.order_ids 
        ? historyData.data.orders.filter(order => exportConfig.order_ids!.includes(order.uid))
        : historyData.data.orders;
      
      const csvContent = [
        'Order Number,Date,Pickup Address,Delivery Address,Status,Amount',
        ...ordersToExport.map(order => [
          order.order_number,
          new Date(order.created_at).toLocaleDateString(),
          `${order.pickup_address.street_address}, ${order.pickup_address.city}`,
          `${order.delivery_address.street_address}, ${order.delivery_address.city}`,
          order.status,
          order.total_amount.toString()
        ].join(','))
      ].join('\n');
      
      return new Blob([csvContent], { type: 'text/csv' });
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'delivery_history.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
    }
  });

  // Helper functions
  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (updatedFilters.date_from) newParams.set('date_from', updatedFilters.date_from);
    else newParams.delete('date_from');
    if (updatedFilters.date_to) newParams.set('date_to', updatedFilters.date_to);
    else newParams.delete('date_to');
    if (updatedFilters.status.length > 0) newParams.set('status', updatedFilters.status.join(','));
    else newParams.delete('status');
    newParams.set('page', '1'); // Reset to first page on filter change
    
    setSearchParams(newParams);
  };

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

  const toggleRowExpansion = (orderId: string) => {
    setExpandedRows(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleDeliverySelection = (orderId: string) => {
    setSelectedDeliveries(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const selectAllDeliveries = () => {
    if (!historyData?.data.orders) return;
    const allIds = historyData.data.orders.map(d => d.uid);
    setSelectedDeliveries(
      selectedDeliveries.length === allIds.length ? [] : allIds
    );
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 'N/A';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_transit':
      case 'pickup_in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAddress = (address: { street_address: string; city: string; state: string }) => 
    `${address.street_address}, ${address.city}, ${address.state}`;

  // Don't render if not authenticated or wrong user type
  if (!currentUser || currentUser.user_type !== 'sender') {
    return null;
  }

  if (historyLoading && !historyData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Delivery History</h1>
                <p className="text-gray-600 mt-1">Comprehensive archive for all your deliveries</p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/request-delivery"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  New Delivery
                </Link>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={selectedDeliveries.length === 0}
                >
                  Export ({selectedDeliveries.length})
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filters Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Search & Filter</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => updateFilters({ date_from: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => updateFilters({ date_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  multiple
                  value={filters.status}
                  onChange={(e) => updateFilters({ 
                    status: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="failed">Failed</option>
                  <option value="in_transit">In Transit</option>
                  <option value="pickup_in_progress">Pickup in Progress</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({
                    date_from: '',
                    date_to: '',
                    status: [],
                    search_query: '',
                    price_min: 0,
                    price_max: 1000,
                    sort_by: 'created_at',
                    sort_order: 'desc'
                  })}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          {historyData?.data && (
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">
                    Showing {((currentPage - 1) * 25) + 1}-{Math.min(currentPage * 25, historyData.data.pagination.total_count)} of {historyData.data.pagination.total_count} deliveries
                  </span>
                  {selectedDeliveries.length > 0 && (
                    <span className="text-blue-600 font-medium">
                      {selectedDeliveries.length} selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Delivery Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedDeliveries.length === historyData?.data.orders.length && historyData?.data.orders.length > 0}
                        onChange={selectAllDeliveries}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Courier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyData?.data.orders.map((order) => (
                    <React.Fragment key={order.uid}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedDeliveries.includes(order.uid)}
                            onChange={() => toggleDeliverySelection(order.uid)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                          <div className="text-sm text-gray-500">{formatDate(order.created_at)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 truncate max-w-xs">
                            <div>{formatAddress(order.pickup_address)}</div>
                            <div className="text-gray-500">→ {formatAddress(order.delivery_address)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(order.status)}`}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatDuration(order.actual_pickup_time, order.actual_delivery_time)}
                        </td>
                        <td className="px-6 py-4">
                          {order.courier ? (
                            <div className="flex items-center">
                              {order.courier.profile_image_url && (
                                <img
                                  src={order.courier.profile_image_url}
                                  alt={`${order.courier.first_name} ${order.courier.last_name}`}
                                  className="w-8 h-8 rounded-full mr-2"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {order.courier.first_name} {order.courier.last_name}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No courier assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => toggleRowExpansion(order.uid)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {expandedRows.includes(order.uid) ? 'Hide' : 'Details'}
                            </button>
                            <Link
                              to={`/orders/${order.uid}/track`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Track
                            </Link>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row Details */}
                      {expandedRows.includes(order.uid) && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Package Details</h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>Type: {order.package.package_type}</div>
                                  <div>Size: {order.package.size_category}</div>
                                  {order.package.special_handling_notes && (
                                    <div>Notes: {order.package.special_handling_notes}</div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Delivery Details</h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>Recipient: {order.recipient_name}</div>
                                  <div>From: {formatAddress(order.pickup_address)}</div>
                                  <div>To: {formatAddress(order.delivery_address)}</div>
                                </div>
                              </div>
                              {order.package.delivery_photo_url && (
                                <div className="md:col-span-2">
                                  <h4 className="font-medium text-gray-900 mb-2">Delivery Photo</h4>
                                  <img
                                    src={order.package.delivery_photo_url}
                                    alt="Delivery confirmation"
                                    className="w-32 h-32 object-cover rounded"
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyData?.data && historyData.data.pagination.total_pages > 1 && (
              <div className="px-6 py-3 bg-gray-50 border-t">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, historyData.data.pagination.total_pages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1 text-sm rounded ${
                            page === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === historyData.data.pagination.total_pages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Export Deliveries</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2">
                    <option value="csv">CSV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Include Fields</label>
                  <div className="space-y-2">
                    {['Date', 'Order Number', 'Addresses', 'Status', 'Amount'].map((field) => (
                      <label key={field} className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 mr-2" />
                        <span className="text-sm text-gray-700">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => exportMutation.mutate({
                    format: 'csv',
                    fields: ['date', 'order_number', 'addresses', 'status', 'amount'],
                    order_ids: selectedDeliveries.length > 0 ? selectedDeliveries : undefined
                  })}
                  disabled={exportMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {exportMutation.isPending ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        )}

        {historyError && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error loading delivery history. Please try again.
          </div>
        )}
      </div>
    </>
  );
};

export default UV_DeliveryHistory;