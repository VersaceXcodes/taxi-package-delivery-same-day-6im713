import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Type definitions matching backend API
interface User {
  uid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  profile_image_url?: string;
  user_type: 'sender' | 'courier';
  marketing_opt_in: boolean;
  is_verified: boolean;
  is_active: boolean;
}

interface PaymentMethod {
  uid: string;
  user_id: string;
  payment_type: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay';
  card_last_four?: string;
  card_brand?: 'visa' | 'mastercard' | 'amex';
  card_exp_month?: number;
  card_exp_year?: number;
  is_default: boolean;
  is_active: boolean;
}

interface NotificationPreferences {
  notification_type: string;
  in_app_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
}

interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  profile_image_url?: string;
  marketing_opt_in?: boolean;
}

interface AddPaymentMethodPayload {
  payment_type: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay';
  card_number?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  card_cvc?: string;
  billing_address?: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
  };
  is_default?: boolean;
}

interface NotificationUpdatePayload {
  preferences: {
    notification_type: string;
    in_app_enabled?: boolean;
    sms_enabled?: boolean;
    email_enabled?: boolean;
    push_enabled?: boolean;
  }[];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone?: string;
}

const UV_ProfileSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Mock current user - replace with actual auth context
  const currentUser = {
    uid: 'mock-user-id',
    user_type: 'sender' as const,
    email: 'user@example.com'
  };
  
  // Toast function mock - replace with actual toast implementation
  const addToast = (toast: { type: string; message: string }) => {
    console.log(`${toast.type}: ${toast.message}`);
  };
  
  // Local state
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'profile');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState<ProfileUpdatePayload>({});
  const [paymentFormData, setPaymentFormData] = useState<AddPaymentMethodPayload>({ payment_type: 'credit_card' });
  const [notificationFormData, setNotificationFormData] = useState<NotificationUpdatePayload>({ preferences: [] });
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Create axios instance with auth header
  const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
      'Content-Type': 'application/json'
    }
  });

  // API Functions
  const fetchProfile = async (): Promise<User> => {
    const { data } = await apiClient.get('/api/profile');
    return data.data;
  };

  const fetchNotificationPreferences = async (): Promise<NotificationPreferences[]> => {
    const { data } = await apiClient.get('/api/notifications/preferences');
    return data.data;
  };

  const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const { data } = await apiClient.get('/api/payments/methods');
    return data.data;
  };

  const updateProfile = async (payload: ProfileUpdatePayload): Promise<User> => {
    const { data } = await apiClient.put('/api/profile', payload);
    return data.data;
  };

  const updateNotifications = async (payload: NotificationUpdatePayload): Promise<NotificationPreferences[]> => {
    const { data } = await apiClient.put('/api/notifications/preferences', payload);
    return data.data;
  };

  const addPaymentMethod = async (payload: AddPaymentMethodPayload): Promise<PaymentMethod> => {
    const { data } = await apiClient.post('/api/payments/methods', payload);
    return data.data;
  };

  const removePaymentMethod = async (id: string): Promise<void> => {
    await apiClient.delete(`/api/payments/methods/${id}`);
  };

  // React Query hooks
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile
  });

  const notificationsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    enabled: currentUser?.user_type === 'sender'
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      addToast({ type: 'success', message: 'Profile updated successfully' });
    },
    onError: (error: any) => {
      addToast({ type: 'error', message: error.response?.data?.message || 'Failed to update profile' });
    }
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: updateNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      addToast({ type: 'success', message: 'Notification preferences updated successfully' });
    },
    onError: (error: any) => {
      addToast({ type: 'error', message: error.response?.data?.message || 'Failed to update notification preferences' });
    }
  });

  const addPaymentMutation = useMutation({
    mutationFn: addPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      addToast({ type: 'success', message: 'Payment method added successfully' });
      setShowAddPaymentModal(false);
      setPaymentFormData({ payment_type: 'credit_card' });
    },
    onError: (error: any) => {
      addToast({ type: 'error', message: error.response?.data?.message || 'Failed to add payment method' });
    }
  });

  const removePaymentMutation = useMutation({
    mutationFn: removePaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      addToast({ type: 'success', message: 'Payment method removed successfully' });
    },
    onError: (error: any) => {
      addToast({ type: 'error', message: error.response?.data?.message || 'Failed to remove payment method' });
    }
  });

  // Effects
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) setActiveSection(section);
  }, [searchParams]);

  useEffect(() => {
    if (profileQuery.data) {
      setProfileFormData({
        first_name: profileQuery.data.first_name,
        last_name: profileQuery.data.last_name,
        phone_number: profileQuery.data.phone_number,
        profile_image_url: profileQuery.data.profile_image_url,
        marketing_opt_in: profileQuery.data.marketing_opt_in
      });
    }
  }, [profileQuery.data]);

  // Handlers
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('section', section);
      return newParams;
    });
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\\+?[\\d\\s\\-\\(\\)]{10,}$/;
    return phoneRegex.test(phone);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: {[key: string]: string} = {};

    if (profileFormData.phone_number && !validatePhone(profileFormData.phone_number)) {
      errors.phone_number = 'Please enter a valid phone number';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    updateProfileMutation.mutate(profileFormData);
  };

  const handleNotificationsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateNotificationsMutation.mutate(notificationFormData);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: {[key: string]: string} = {};

    if (paymentFormData.payment_type === 'credit_card' || paymentFormData.payment_type === 'debit_card') {
      if (!paymentFormData.card_number || paymentFormData.card_number.length < 16) {
        errors.card_number = 'Please enter a valid card number';
      }
      if (!paymentFormData.card_exp_month || !paymentFormData.card_exp_year) {
        errors.expiry = 'Please enter a valid expiry date';
      }
      if (!paymentFormData.card_cvc || paymentFormData.card_cvc.length < 3) {
        errors.card_cvc = 'Please enter a valid CVV';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    addPaymentMutation.mutate(paymentFormData);
  };

  const isLoading = profileQuery.isLoading || notificationsQuery.isLoading || paymentMethodsQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
            <div className="w-32"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => handleSectionChange('profile')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                      activeSection === 'profile' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Profile Information
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSectionChange('notifications')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                      activeSection === 'notifications' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Notifications
                  </button>
                </li>
                {currentUser?.user_type === 'sender' && (
                  <li>
                    <button
                      onClick={() => handleSectionChange('payment')}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeSection === 'payment' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Payment & Billing
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {isLoading ? (
              <div className="bg-white rounded-lg shadow p-8">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Profile Information Section */}
                {activeSection === 'profile' && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
                      <p className="text-sm text-gray-600">Manage your personal information and account settings.</p>
                    </div>
                    <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
                      {/* Profile Photo */}
                      <div className="flex items-center space-x-6">
                        <div className="flex-shrink-0">
                          <img
                            className="h-16 w-16 rounded-full object-cover bg-gray-200"
                            src={profileFormData.profile_image_url || `https://picsum.photos/seed/${currentUser?.uid}/64/64`}
                            alt="Profile"
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            className="bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Change Photo
                          </button>
                          <p className="text-xs text-gray-500 mt-1">JPG, GIF or PNG. 1MB max.</p>
                        </div>
                      </div>

                      {/* Name Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                            First Name
                          </label>
                          <input
                            type="text"
                            id="first_name"
                            value={profileFormData.first_name || ''}
                            onChange={(e) => setProfileFormData(prev => ({ ...prev, first_name: e.target.value }))}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                            Last Name
                          </label>
                          <input
                            type="text"
                            id="last_name"
                            value={profileFormData.last_name || ''}
                            onChange={(e) => setProfileFormData(prev => ({ ...prev, last_name: e.target.value }))}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      {/* Email (read-only) */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={profileQuery.data?.email || ''}
                          disabled
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed. Contact support if needed.</p>
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          id="phone_number"
                          value={profileFormData.phone_number || ''}
                          onChange={(e) => setProfileFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                          className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                            validationErrors.phone_number ? 'border-red-300' : ''
                          }`}
                        />
                        {validationErrors.phone_number && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.phone_number}</p>
                        )}
                      </div>

                      {/* Marketing Opt-in */}
                      <div className="flex items-center">
                        <input
                          id="marketing_opt_in"
                          type="checkbox"
                          checked={profileFormData.marketing_opt_in || false}
                          onChange={(e) => setProfileFormData(prev => ({ ...prev, marketing_opt_in: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="marketing_opt_in" className="ml-2 block text-sm text-gray-900">
                          I want to receive marketing communications
                        </label>
                      </div>

                      {/* Submit Button */}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={updateProfileMutation.isPending}
                          className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Notifications Section */}
                {activeSection === 'notifications' && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Notification Preferences</h2>
                      <p className="text-sm text-gray-600">Choose how you want to receive notifications.</p>
                    </div>
                    <form onSubmit={handleNotificationsSubmit} className="p-6 space-y-6">
                      {/* Notification Types */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-4">Notification Types</h3>
                        <div className="space-y-4">
                          {['order_updates', 'messages', 'marketing', 'security'].map((type) => (
                            <div key={type} className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-700 capitalize">
                                {type.replace('_', ' ')}
                              </h4>
                              <div className="grid grid-cols-4 gap-4">
                                {['in_app_enabled', 'sms_enabled', 'email_enabled', 'push_enabled'].map((channel) => (
                                  <div key={channel} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      id={`${type}_${channel}`}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor={`${type}_${channel}`} className="ml-2 text-xs text-gray-600">
                                      {channel.replace('_enabled', '').replace('_', ' ')}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={updateNotificationsMutation.isPending}
                          className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {updateNotificationsMutation.isPending ? 'Saving...' : 'Save Preferences'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Payment & Billing Section */}
                {activeSection === 'payment' && currentUser?.user_type === 'sender' && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-gray-900">Payment Methods</h2>
                        <p className="text-sm text-gray-600">Manage your saved payment methods.</p>
                      </div>
                      <button
                        onClick={() => setShowAddPaymentModal(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Add Payment Method
                      </button>
                    </div>
                    <div className="p-6">
                      {paymentMethodsQuery.data?.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No payment methods added yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {paymentMethodsQuery.data?.map((method) => (
                            <div key={method.uid} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {method.card_brand} ****{method.card_last_four}
                                    {method.is_default && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Default</span>}
                                  </p>
                                  {method.card_exp_month && method.card_exp_year && (
                                    <p className="text-xs text-gray-500">Expires {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => removePaymentMutation.mutate(method.uid)}
                                  disabled={removePaymentMutation.isPending}
                                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 text-center">Add Payment Method</h3>
              <form onSubmit={handlePaymentSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                  <select
                    value={paymentFormData.payment_type}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, payment_type: e.target.value as any }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="apple_pay">Apple Pay</option>
                    <option value="google_pay">Google Pay</option>
                  </select>
                </div>
                
                {(paymentFormData.payment_type === 'credit_card' || paymentFormData.payment_type === 'debit_card') && (
                  <>
                    <div>
                      <label htmlFor="card_number" className="block text-sm font-medium text-gray-700">
                        Card Number
                      </label>
                      <input
                        type="text"
                        id="card_number"
                        placeholder="1234 5678 9012 3456"
                        value={paymentFormData.card_number || ''}
                        onChange={(e) => setPaymentFormData(prev => ({ ...prev, card_number: e.target.value }))}
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          validationErrors.card_number ? 'border-red-300' : ''
                        }`}
                      />
                      {validationErrors.card_number && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.card_number}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="card_exp_month" className="block text-sm font-medium text-gray-700">
                          Expiry Month
                        </label>
                        <select
                          id="card_exp_month"
                          value={paymentFormData.card_exp_month || ''}
                          onChange={(e) => setPaymentFormData(prev => ({ ...prev, card_exp_month: parseInt(e.target.value) }))}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="">Month</option>
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {(i + 1).toString().padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="card_exp_year" className="block text-sm font-medium text-gray-700">
                          Expiry Year
                        </label>
                        <select
                          id="card_exp_year"
                          value={paymentFormData.card_exp_year || ''}
                          onChange={(e) => setPaymentFormData(prev => ({ ...prev, card_exp_year: parseInt(e.target.value) }))}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() + i;
                            return (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    {validationErrors.expiry && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.expiry}</p>
                    )}
                    <div>
                      <label htmlFor="card_cvc" className="block text-sm font-medium text-gray-700">
                        CVV
                      </label>
                      <input
                        type="text"
                        id="card_cvc"
                        placeholder="123"
                        maxLength={4}
                        value={paymentFormData.card_cvc || ''}
                        onChange={(e) => setPaymentFormData(prev => ({ ...prev, card_cvc: e.target.value }))}
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          validationErrors.card_cvc ? 'border-red-300' : ''
                        }`}
                      />
                      {validationErrors.card_cvc && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.card_cvc}</p>
                      )}
                    </div>
                  </>
                )}
                
                <div className="flex items-center">
                  <input
                    id="is_default"
                    type="checkbox"
                    checked={paymentFormData.is_default || false}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                    Set as default payment method
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPaymentModal(false);
                      setPaymentFormData({ payment_type: 'credit_card' });
                      setValidationErrors({});
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addPaymentMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                  >
                    {addPaymentMutation.isPending ? 'Adding...' : 'Add Payment Method'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_ProfileSettings;