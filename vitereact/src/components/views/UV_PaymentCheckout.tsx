import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Define interfaces matching backend schema
interface OrderDetails {
  uid: string;
  order_number: string;
  pickup_address_id: string;
  delivery_address_id: string;
  pickup_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    building_instructions?: string;
  };
  delivery_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    building_instructions?: string;
  };
  recipient_name: string;
  recipient_phone: string;
  package: {
    package_type: string;
    size_category: string;
    estimated_weight: number;
    declared_value?: number;
    is_fragile: boolean;
    special_handling_notes?: string;
  };
  base_price: number;
  urgency_premium: number;
  size_premium: number;
  special_handling_fee: number;
  service_fee: number;
  tax_amount: number;
  total_amount: number;
  urgency_level: string;
  estimated_pickup_time: string;
  estimated_delivery_time: string;
  status: string;
  created_at: string;
}

interface PaymentMethod {
  uid: string;
  payment_type: string;
  card_last_four?: string;
  card_brand?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  is_default: boolean;
}

interface PaymentFormData {
  payment_method_id?: string;
  card_number?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv?: string;
  cardholder_name?: string;
  billing_address?: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
  };
  save_method?: boolean;
}

const UV_PaymentCheckout: React.FC = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Global state with proper null checks
  const authState = useAppStore(state => state.authenticationState || {});
  const currentUser = authState.currentUser;
  const isAuthenticated = authState.authenticationStatus?.isAuthenticated || false;
  const jwtToken = authState.sessionManagement?.jwtToken;
  
  // Local state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [cardErrors, setCardErrors] = useState<{[key: string]: string}>({});

  // URL parameter handling
  const preSelectedMethod = searchParams.get('method');
  const isRetryAttempt = searchParams.get('retry') === 'true';

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname));
    }
  }, [isAuthenticated, navigate]);

  // API functions with proper error handling
  const fetchOrderDetails = async (): Promise<OrderDetails> => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`,
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`
          }
        }
      );
      return data.data; // Extract data from wrapped response
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to fetch order details');
      }
      throw error;
    }
  };

  const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payments/methods`,
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`
          }
        }
      );
      return data.data; // Extract data from wrapped response
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to fetch payment methods');
      }
      throw error;
    }
  };

  const processPayment = async (paymentData: any) => {
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payments/process`,
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`
          }
        }
      );
      return data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Payment processing failed');
      }
      throw error;
    }
  };

  // React Query hooks
  const { data: orderDetails, isLoading: isLoadingOrder, error: orderError } = useQuery<OrderDetails, Error>({
    queryKey: ['order', order_id],
    queryFn: fetchOrderDetails,
    enabled: !!order_id && isAuthenticated && !!jwtToken
  });

  const { data: paymentMethods, isLoading: isLoadingPaymentMethods } = useQuery<PaymentMethod[], Error>({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    enabled: isAuthenticated && !!jwtToken
  });

  const paymentMutation = useMutation({
    mutationFn: processPayment,
    onSuccess: () => {
      navigate(`/track/${order_id}`);
    },
    onError: (error: any) => {
      setPaymentError(error.message || 'Payment processing failed');
      setIsProcessingPayment(false);
    }
  });

  // Form validation
  const validateCardForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!paymentFormData.card_number || paymentFormData.card_number.length < 13) {
      errors.card_number = 'Please enter a valid card number';
    }
    
    if (!paymentFormData.expiry_month || !paymentFormData.expiry_year) {
      errors.expiry = 'Please enter expiry date';
    }
    
    if (!paymentFormData.cvv || paymentFormData.cvv.length < 3) {
      errors.cvv = 'Please enter CVV';
    }
    
    if (!paymentFormData.cardholder_name) {
      errors.cardholder_name = 'Please enter cardholder name';
    }
    
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Event handlers
  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
    setShowNewCardForm(methodId === 'new_card');
    setPaymentError(null);
  };

  const handleCardInputChange = (field: string, value: string | boolean) => {
    setPaymentFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (typeof value === 'string' && cardErrors[field]) {
      setCardErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentMethod) {
      setPaymentError('Please select a payment method');
      return;
    }

    if (showNewCardForm && !validateCardForm()) {
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    const paymentData = {
      order_id,
      payment_method_id: selectedPaymentMethod === 'new_card' ? undefined : selectedPaymentMethod,
      payment_method: showNewCardForm ? {
        type: 'credit_card',
        card_number: paymentFormData.card_number,
        exp_month: parseInt(paymentFormData.expiry_month || '0'),
        exp_year: parseInt(paymentFormData.expiry_year || '0'),
        cvc: paymentFormData.cvv
      } : undefined
    };

    paymentMutation.mutate(paymentData);
  };

  // Set pre-selected payment method
  useEffect(() => {
    if (preSelectedMethod && paymentMethods) {
      const method = paymentMethods.find(m => m.uid === preSelectedMethod);
      if (method) {
        setSelectedPaymentMethod(preSelectedMethod);
      }
    } else if (paymentMethods && paymentMethods.length > 0) {
      const defaultMethod = paymentMethods.find(m => m.is_default);
      if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod.uid);
      }
    }
  }, [preSelectedMethod, paymentMethods]);

  // Loading states
  if (isLoadingOrder || isLoadingPaymentMethods) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 text-center mt-4">Loading payment details...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (orderError || !orderDetails) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
            <div className="text-red-600 text-center mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold">Order Not Found</h2>
              <p className="text-gray-600 mt-2">{orderError?.message || 'The order you\\'re trying to pay for could not be found.'}</p>
            </div>
            <Link to="/dashboard" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-center block">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
              <Link to="/dashboard" className="hover:text-blue-600">Dashboard</Link>
              <span>/</span>
              <span className="text-gray-900">Payment</span>
            </nav>
            <h1 className="text-3xl font-bold text-gray-900">Complete Your Payment</h1>
            <p className="text-gray-600 mt-2">Review your order details and complete your secure payment</p>
            {isRetryAttempt && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-yellow-800 text-sm">Your previous payment attempt was unsuccessful. Please try again.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Summary - Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Details */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-500">Order #</span>
                    <span className="font-medium">{orderDetails.order_number}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500">Delivery Type</span>
                    <span className="font-medium capitalize">{orderDetails.urgency_level}</span>
                  </div>
                </div>

                {/* Addresses */}
                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Pickup Address</h3>
                    <div className="text-sm text-gray-600">
                      <p>{orderDetails.pickup_address.street_address}</p>
                      <p>{orderDetails.pickup_address.city}, {orderDetails.pickup_address.state} {orderDetails.pickup_address.postal_code}</p>
                      {orderDetails.pickup_address.building_instructions && (
                        <p className="text-gray-500 mt-1">Instructions: {orderDetails.pickup_address.building_instructions}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Delivery Address</h3>
                    <div className="text-sm text-gray-600">
                      <p>{orderDetails.delivery_address.street_address}</p>
                      <p>{orderDetails.delivery_address.city}, {orderDetails.delivery_address.state} {orderDetails.delivery_address.postal_code}</p>
                      <p className="text-gray-500">To: {orderDetails.recipient_name}</p>
                      {orderDetails.delivery_address.building_instructions && (
                        <p className="text-gray-500 mt-1">Instructions: {orderDetails.delivery_address.building_instructions}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Package Details */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Package Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2 capitalize">{orderDetails.package.package_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Size:</span>
                      <span className="ml-2 capitalize">{orderDetails.package.size_category}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Weight:</span>
                      <span className="ml-2">{orderDetails.package.estimated_weight} lbs</span>
                    </div>
                    {orderDetails.package.is_fragile && (
                      <div>
                        <span className="text-red-600 font-medium">⚠ Fragile</span>
                      </div>
                    )}
                  </div>
                  {orderDetails.package.special_handling_notes && (
                    <div className="mt-2">
                      <span className="text-gray-500 text-sm">Special Instructions:</span>
                      <p className="text-sm text-gray-600 mt-1">{orderDetails.package.special_handling_notes}</p>
                    </div>
                  )}
                </div>

                {/* Delivery Timeline */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Estimated Timeline</h3>
                  <div className="text-sm text-gray-600">
                    <p>Pickup: {new Date(orderDetails.estimated_pickup_time).toLocaleString()}</p>
                    <p>Delivery: {new Date(orderDetails.estimated_delivery_time).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
                
                {/* Saved Payment Methods */}
                {paymentMethods && paymentMethods.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {paymentMethods.map((method) => (
                      <div key={method.uid} className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => handlePaymentMethodSelect(method.uid)}>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id={method.uid}
                            name="payment_method"
                            checked={selectedPaymentMethod === method.uid}
                            onChange={() => handlePaymentMethodSelect(method.uid)}
                            className="mr-3 text-blue-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="font-medium">{method.payment_type}</span>
                              {method.is_default && (
                                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Default</span>
                              )}
                            </div>
                            {method.card_last_four && (
                              <p className="text-sm text-gray-500">•••• •••• •••• {method.card_last_four}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Card Option */}
                <div className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => handlePaymentMethodSelect('new_card')}>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="new_card"
                      name="payment_method"
                      checked={selectedPaymentMethod === 'new_card'}
                      onChange={() => handlePaymentMethodSelect('new_card')}
                      className="mr-3 text-blue-600"
                    />
                    <span className="font-medium">Add New Card</span>
                  </div>
                </div>

                {/* New Card Form */}
                {showNewCardForm && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-4">Card Information</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                        <input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${cardErrors.card_number ? 'border-red-500' : 'border-gray-300'}`}
                          value={paymentFormData.card_number || ''}
                          onChange={(e) => handleCardInputChange('card_number', e.target.value)}
                        />
                        {cardErrors.card_number && (
                          <p className="text-red-500 text-xs mt-1">{cardErrors.card_number}</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                          <select
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${cardErrors.expiry ? 'border-red-500' : 'border-gray-300'}`}
                            value={paymentFormData.expiry_month || ''}
                            onChange={(e) => handleCardInputChange('expiry_month', e.target.value)}
                          >
                            <option value="">MM</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                              <option key={month} value={month.toString().padStart(2, '0')}>
                                {month.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                          <select
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${cardErrors.expiry ? 'border-red-500' : 'border-gray-300'}`}
                            value={paymentFormData.expiry_year || ''}
                            onChange={(e) => handleCardInputChange('expiry_year', e.target.value)}
                          >
                            <option value="">YYYY</option>
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                              <option key={year} value={year.toString()}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                          <input
                            type="text"
                            placeholder="123"
                            maxLength={4}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${cardErrors.cvv ? 'border-red-500' : 'border-gray-300'}`}
                            value={paymentFormData.cvv || ''}
                            onChange={(e) => handleCardInputChange('cvv', e.target.value)}
                          />
                          {cardErrors.cvv && (
                            <p className="text-red-500 text-xs mt-1">{cardErrors.cvv}</p>
                          )}
                        </div>
                      </div>
                      {cardErrors.expiry && (
                        <p className="text-red-500 text-xs -mt-2">{cardErrors.expiry}</p>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${cardErrors.cardholder_name ? 'border-red-500' : 'border-gray-300'}`}
                          value={paymentFormData.cardholder_name || ''}
                          onChange={(e) => handleCardInputChange('cardholder_name', e.target.value)}
                        />
                        {cardErrors.cardholder_name && (
                          <p className="text-red-500 text-xs mt-1">{cardErrors.cardholder_name}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="save_method"
                          checked={paymentFormData.save_method || false}
                          onChange={(e) => handleCardInputChange('save_method', e.target.checked)}
                          className="mr-2 text-blue-600"
                        />
                        <label htmlFor="save_method" className="text-sm text-gray-700">Save this payment method for future use</label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Digital Wallet Options */}
                <div className="mt-6">
                  <div className="flex items-center mb-4">
                    <hr className="flex-1 border-gray-300" />
                    <span className="px-4 text-sm text-gray-500">Or pay with</span>
                    <hr className="flex-1 border-gray-300" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                      <img src="https://picsum.photos/20/20?random=paypal" alt="PayPal" className="w-5 h-5 mr-2" />
                      PayPal
                    </button>
                    <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                      <img src="https://picsum.photos/20/20?random=apple" alt="Apple Pay" className="w-5 h-5 mr-2" />
                      Apple Pay
                    </button>
                    <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                      <img src="https://picsum.photos/20/20?random=google" alt="Google Pay" className="w-5 h-5 mr-2" />
                      Google Pay
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Summary - Right Column */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Pricing Summary</h2>
                
                {/* Pricing Breakdown */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price</span>
                    <span>${orderDetails.base_price.toFixed(2)}</span>
                  </div>
                  {orderDetails.urgency_premium > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Urgency Premium</span>
                      <span>${orderDetails.urgency_premium.toFixed(2)}</span>
                    </div>
                  )}
                  {orderDetails.size_premium > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Size Premium</span>
                      <span>${orderDetails.size_premium.toFixed(2)}</span>
                    </div>
                  )}
                  {orderDetails.special_handling_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Special Handling</span>
                      <span>${orderDetails.special_handling_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service Fee</span>
                    <span>${orderDetails.service_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span>${orderDetails.tax_amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between text-xl font-semibold">
                    <span>Total</span>
                    <span>${orderDetails.total_amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Button */}
                <button
                  onClick={handlePaymentSubmit}
                  disabled={!selectedPaymentMethod || isProcessingPayment}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isProcessingPayment ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing Payment...
                    </div>
                  ) : (
                    `Pay $${orderDetails.total_amount.toFixed(2)}`
                  )}
                </button>

                {/* Error Message */}
                {paymentError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-red-800 text-sm">{paymentError}</p>
                    </div>
                  </div>
                )}

                {/* Security Notice */}
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.012-3.071l-.867 12.142A2 2 0 0116.138 23H7.862a2 2 0 01-1.995-1.858L5 9h14l-.012.071z" />
                    </svg>
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Secure Payment</p>
                      <p>Your payment information is encrypted and secure. We use industry-standard security measures to protect your data.</p>
                    </div>
                  </div>
                </div>

                {/* Terms Notice */}
                <div className="mt-4 text-xs text-gray-500">
                  <p>By completing this payment, you agree to our <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Footer */}
          <div className="mt-8 flex justify-between items-center">
            <Link to="/request-delivery" className="text-blue-600 hover:underline">
              ← Back to Edit Order
            </Link>
            <div className="text-sm text-gray-500">
              Need help? <Link to="/support" className="text-blue-600 hover:underline">Contact Support</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PaymentCheckout;