import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Backend-compliant interfaces matching OpenAPI spec
interface Notification {
  uid: string;
  user_id: string;
  order_id?: string;
  notification_type: 'order_update' | 'message' | 'payment' | 'system' | 'marketing';
  channel: 'in_app' | 'sms' | 'email' | 'push';
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  read_at?: string;
  sent_at: string;
}

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    unread_count: number;
    pagination: {
      current_page: number;
      total_pages: number;
      total_count: number;
    };
  };
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

// Configure axios with auth interceptor
const createAuthenticatedAxios = () => {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  });

  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('authToken'); // Adjust based on your auth storage
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return instance;
};

const apiClient = createAuthenticatedAxios();

// API Functions with correct endpoints and response handling
const fetchNotifications = async (): Promise<{
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
}> => {
  const response = await apiClient.get<NotificationsResponse>('/api/notifications', {
    params: { limit: 10 }
  });

  if (!response.data.success) {
    throw new Error('Failed to fetch notifications');
  }

  return {
    notifications: response.data.data.notifications,
    unreadCount: response.data.data.unread_count,
    hasMore: response.data.data.pagination.current_page < response.data.data.pagination.total_pages
  };
};

const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(`/api/notifications/${notificationId}/read`);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to mark notification as read');
  }
};

const markAllAsRead = async (): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/api/notifications/mark-all-read');
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to mark all notifications as read');
  }
};

const GV_NotificationPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Global state
  const { 
    notificationCenter, 
    isAuthenticated, 
    websocketConnection,
    updateNotificationCenter 
  } = useAppStore();

  // React Query hooks with proper error handling
  const { data: notificationData, isLoading, error, refetch } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: fetchNotifications,
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds as fallback
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      console.error('Error marking notification as read:', error.message);
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      console.error('Error marking all notifications as read:', error.message);
    }
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update global state when API data changes
  useEffect(() => {
    if (notificationData && updateNotificationCenter) {
      updateNotificationCenter({
        unreadCount: notificationData.unreadCount,
        notifications: notificationData.notifications,
        notificationTypes: ['order_update', 'message', 'payment', 'system'],
        lastChecked: new Date().toISOString()
      });
    }
  }, [notificationData, updateNotificationCenter]);

  // Real-time WebSocket notification handling
  useEffect(() => {
    if (websocketConnection?.connectionStatus === 'connected') {
      refetch();
    }
  }, [websocketConnection?.connectionStatus, refetch]);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.uid);
    }
    setIsOpen(false);
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_update':
        return '📦';
      case 'message':
        return '💬';
      case 'payment':
        return '💳';
      case 'system':
        return '⚙️';
      case 'marketing':
        return '📢';
      default:
        return '🔔';
    }
  };

  const getNotificationLink = (notification: Notification): string => {
    if (notification.order_id) {
      if (notification.notification_type === 'order_update') {
        return `/orders/${notification.order_id}`;
      }
      if (notification.notification_type === 'message') {
        return `/orders/${notification.order_id}`;
      }
    }
    if (notification.notification_type === 'payment') {
      return '/profile?section=billing';
    }
    if (notification.notification_type === 'system') {
      return '/support';
    }
    return '/dashboard';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Get notifications from API data or global state as fallback
  const notifications = notificationData?.notifications || notificationCenter?.notifications || [];
  const unreadCount = notificationData?.unreadCount || notificationCenter?.unreadCount || 0;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Icon */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors duration-200"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          type="button"
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
            />
          </svg>

          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[20px] animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markAllAsReadMutation.isPending}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                    type="button"
                  >
                    Mark all read
                  </button>
                )}
                <Link
                  to="/profile?section=notifications"
                  className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  Settings
                </Link>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading notifications...</p>
                </div>
              ) : error ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-red-600">Failed to load notifications</p>
                  <button
                    onClick={() => refetch()}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm text-gray-600">No notifications yet</p>
                  <p className="text-xs text-gray-500 mt-1">We'll notify you when something happens</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div key={notification.uid} className="border-l-4 border-gray-300 bg-white">
                      <Link
                        to={getNotificationLink(notification)}
                        onClick={() => handleNotificationClick(notification)}
                        className="block px-4 py-3 hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className="flex items-start space-x-3">
                          {/* Notification Icon */}
                          <div className="flex-shrink-0 mt-1">
                            <span className="text-lg" role="img" aria-label={notification.notification_type}>
                              {getNotificationIcon(notification.notification_type)}
                            </span>
                          </div>

                          {/* Notification Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full ml-2 flex-shrink-0"></div>
                              )}
                            </div>
                            <p className={`text-sm mt-1 ${notification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-gray-500">
                                {formatTimestamp(notification.sent_at)}
                              </p>
                            </div>
                          </div>

                          {/* Mark as Read Button */}
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMarkAsRead(notification.uid);
                              }}
                              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                              aria-label="Mark as read"
                              type="button"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all in dashboard
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsOpen(false);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close notification panel"
        />
      )}
    </>
  );
};

export default GV_NotificationPanel;