import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types and Interfaces matching backend API
interface CourierEarningsData {
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

interface AvailabilityUpdatePayload {
  is_available: boolean;
  availability_status: 'online' | 'offline' | 'on_break' | 'in_delivery';
}

// API Functions
const fetchCourierEarnings = async (): Promise<CourierEarningsData> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/couriers/earnings?period=today`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('jwt_token')}`
    }
  });
  return data.data;
};

const updateCourierAvailability = async (payload: AvailabilityUpdatePayload): Promise<void> => {
  await axios.put(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/couriers/availability`, payload, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('jwt_token')}`
    }
  });
};

const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/notifications/${notificationId}/read`, {}, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('jwt_token')}`
    }
  });
};

const logoutUser = async (): Promise<void> => {
  await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/logout`, {}, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('jwt_token')}`
    }
  });
};

const GV_TopNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Global state with safe access
  const authenticationState = useAppStore(state => state.authenticationState || {});
  const notificationSystemState = useAppStore(state => state.notificationSystemState || {});
  const { clearAuthenticationState } = useAppStore();
  
  // Local state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [courierOnline, setCourierOnline] = useState(false);

  // Extract current user data with safe access
  const { currentUser = null, authenticationStatus = {} } = authenticationState;
  const { notificationCenter = { notifications: [], unreadCount: 0 } } = notificationSystemState;
  const isAuthenticated = authenticationStatus.isAuthenticated && currentUser;
  const isSender = currentUser?.userType === 'sender' || currentUser?.user_type === 'sender';
  const isCourier = currentUser?.userType === 'courier' || currentUser?.user_type === 'courier';

  // Fetch courier earnings if user is a courier
  const { data: courierEarnings } = useQuery<CourierEarningsData, Error>({
    queryKey: ['courierEarnings'],
    queryFn: fetchCourierEarnings,
    enabled: isAuthenticated && isCourier,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Availability toggle mutation with error handling
  const availabilityMutation = useMutation<void, Error, AvailabilityUpdatePayload>({
    mutationFn: updateCourierAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courierEarnings'] });
    },
    onError: (error) => {
      console.error('Failed to update availability:', error);
      // Reset the toggle state on error
      setCourierOnline(prev => !prev);
    }
  });

  // Mark notification as read mutation with error handling
  const markNotificationReadMutation = useMutation<void, Error, string>({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      console.error('Failed to mark notification as read:', error);
    }
  });

  // Logout mutation with error handling
  const logoutMutation = useMutation<void, Error>({
    mutationFn: logoutUser,
    onSuccess: () => {
      clearAuthenticationState();
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      navigate('/');
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      // Still clear local state even if API call fails
      clearAuthenticationState();
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      navigate('/');
    }
  });

  // Handle logo click
  const handleLogoClick = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  // Handle availability toggle
  const handleAvailabilityToggle = () => {
    const newStatus = !courierOnline;
    setCourierOnline(newStatus);
    availabilityMutation.mutate({
      is_available: newStatus,
      availability_status: newStatus ? 'online' : 'offline'
    });
  };

  // Handle notification click
  const handleNotificationClick = (notificationId: string) => {
    markNotificationReadMutation.mutate(notificationId);
    setNotificationDropdownOpen(false);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/history?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchFocused(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
    setUserDropdownOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.notification-dropdown')) {
        setNotificationDropdownOpen(false);
      }
      if (!target.closest('.user-dropdown')) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Main Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left Section - Logo and Primary Nav */}
            <div className="flex items-center">
              {/* Logo */}
              <button
                onClick={handleLogoClick}
                className="flex-shrink-0 flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                type="button"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">QC</span>
                </div>
                <span className="hidden sm:block text-xl font-bold">QuickCourier</span>
              </button>

              {/* Desktop Navigation Menu */}
              <nav className="hidden lg:ml-8 lg:flex lg:space-x-8">
                {!isAuthenticated && (
                  <>
                    <Link 
                      to="/#how-it-works" 
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                    >
                      How It Works
                    </Link>
                    <Link 
                      to="/#pricing" 
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                    >
                      Pricing
                    </Link>
                  </>
                )}
                {isAuthenticated && isSender && (
                  <Link
                    to="/history"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    History
                  </Link>
                )}
              </nav>
            </div>

            {/* Center Section - Search (for authenticated users) */}
            {isAuthenticated && (
              <div className="hidden md:block flex-1 max-w-md mx-8">
                <form onSubmit={handleSearch} className="relative">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder="Search orders, addresses..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </form>
              </div>
            )}

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              
              {/* Unauthenticated Actions */}
              {!isAuthenticated && (
                <>
                  <Link
                    to="/login"
                    className="hidden sm:block text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Login
                  </Link>
                  <div className="hidden sm:block relative">
                    <Link
                      to="/register/sender"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Sign Up
                    </Link>
                  </div>
                </>
              )}

              {/* Authenticated Sender Actions */}
              {isAuthenticated && isSender && (
                <>
                  <Link
                    to="/request-delivery"
                    className="hidden sm:block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    New Delivery
                  </Link>
                </>
              )}

              {/* Authenticated Courier Actions */}
              {isAuthenticated && isCourier && (
                <>
                  {/* Availability Toggle */}
                  <div className="hidden sm:flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      {courierOnline ? 'Online' : 'Offline'}
                    </span>
                    <button
                      onClick={handleAvailabilityToggle}
                      disabled={availabilityMutation.isPending}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        courierOnline ? 'bg-green-600' : 'bg-gray-200'
                      } ${availabilityMutation.isPending ? 'opacity-50' : ''}`}
                      type="button"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          courierOnline ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Earnings Display */}
                  {courierEarnings && (
                    <div className="hidden sm:block text-sm">
                      <span className="text-gray-600">Today: </span>
                      <span className="font-semibold text-green-600">
                        ${courierEarnings.period_earnings.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Notification Bell */}
              {isAuthenticated && (
                <div className="relative notification-dropdown">
                  <button
                    onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                    className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
                    type="button"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notificationCenter.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {notificationCenter.unreadCount > 99 ? '99+' : notificationCenter.unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {notificationDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                      <div className="py-1 max-h-96 overflow-y-auto">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                        </div>
                        {notificationCenter.notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            No notifications
                          </div>
                        ) : (
                          notificationCenter.notifications.slice(0, 5).map((notification) => (
                            <button
                              key={notification.id || notification.uid}
                              onClick={() => handleNotificationClick(notification.id || notification.uid)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              type="button"
                            >
                              <div className="flex items-start space-x-3">
                                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${notification.isRead || notification.is_read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {notification.title}
                                  </p>
                                  <p className="text-sm text-gray-500 truncate">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(notification.timestamp || notification.sent_at).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Avatar Dropdown */}
              {isAuthenticated && currentUser && (
                <div className="relative user-dropdown">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    type="button"
                  >
                    <img
                      src={currentUser.profileImageUrl || currentUser.profile_image_url || `https://picsum.photos/32/32?random=${currentUser.uid}`}
                      alt={`${currentUser.firstName || currentUser.first_name} ${currentUser.lastName || currentUser.last_name}`}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {currentUser.firstName || currentUser.first_name}
                    </span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* User Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                      <div className="py-1">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">
                            {currentUser.firstName || currentUser.first_name} {currentUser.lastName || currentUser.last_name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{currentUser.userType || currentUser.user_type}</p>
                        </div>
                        <Link
                          to="/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          Dashboard
                        </Link>
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          Profile
                        </Link>
                        {isSender && (
                          <Link
                            to="/history"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setUserDropdownOpen(false)}
                          >
                            History
                          </Link>
                        )}
                        {isCourier && courierEarnings && (
                          <div className="px-4 py-2 text-sm text-gray-700 border-t border-gray-100">
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span>Today:</span>
                                <span className="font-medium">${courierEarnings.period_earnings.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total:</span>
                                <span className="font-medium">${courierEarnings.total_earnings.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <Link
                          to="/support"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          Support
                        </Link>
                        <button
                          onClick={handleLogout}
                          disabled={logoutMutation.isPending}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          type="button"
                        >
                          {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 hover:text-blue-600 transition-colors"
                type="button"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Mobile Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">QC</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">QuickCourier</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-600 hover:text-blue-600"
                  type="button"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="space-y-4">
                {!isAuthenticated ? (
                  <>
                    <Link
                      to="/#how-it-works"
                      className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                    >
                      How It Works
                    </Link>
                    <Link
                      to="/#pricing"
                      className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                    >
                      Pricing
                    </Link>
                    <Link
                      to="/login"
                      className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register/sender"
                      className="block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-base font-medium text-center"
                    >
                      Sign Up
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/dashboard"
                      className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                    >
                      Dashboard
                    </Link>
                    {isSender && (
                      <>
                        <Link
                          to="/request-delivery"
                          className="block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-base font-medium text-center"
                        >
                          New Delivery
                        </Link>
                        <Link
                          to="/history"
                          className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                        >
                          History
                        </Link>
                      </>
                    )}
                    {isCourier && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2">
                          <span className="text-base font-medium text-gray-700">Availability</span>
                          <button
                            onClick={handleAvailabilityToggle}
                            disabled={availabilityMutation.isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              courierOnline ? 'bg-green-600' : 'bg-gray-200'
                            } ${availabilityMutation.isPending ? 'opacity-50' : ''}`}
                            type="button"
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                courierOnline ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        {courierEarnings && (
                          <div className="py-2 border-t border-gray-200">
                            <h4 className="text-base font-medium text-gray-700 mb-2">Earnings</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Today:</span>
                                <span className="font-medium">${courierEarnings.period_earnings.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total:</span>
                                <span className="font-medium">${courierEarnings.total_earnings.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <Link
                      to="/profile"
                      className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/support"
                      className="block text-gray-700 hover:text-blue-600 py-2 text-base font-medium"
                    >
                      Support
                    </Link>
                    <button
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                      className="block w-full text-left text-gray-700 hover:text-blue-600 py-2 text-base font-medium disabled:opacity-50"
                      type="button"
                    >
                      {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                    </button>
                  </>
                )}
              </nav>

              {/* Mobile Search */}
              {isAuthenticated && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <form onSubmit={handleSearch}>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search orders..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
};

export default GV_TopNav;