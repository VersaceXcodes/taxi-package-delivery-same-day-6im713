import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Interfaces for type safety
interface Address {
  uid?: string;
  street_address: string;
  apartment_unit?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
  building_instructions?: string;
  access_code?: string;
  is_residential?: boolean;
}

interface AddressSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PackageDetails {
  package_type: 'documents' | 'electronics' | 'clothing' | 'food' | 'fragile' | 'other';
  size_category: 'small' | 'medium' | 'large' | 'extra_large';
  estimated_weight: number;
  declared_value?: number;
  is_fragile: boolean;
  special_handling_notes?: string;
  package_description?: string;
}

interface DeliveryPreferences {
  urgency_level: 'asap' | '1_hour' | '2_hours' | '4_hours' | 'scheduled';
  scheduled_pickup_date?: string;
  scheduled_pickup_time?: string;
  pickup_instructions?: string;
  delivery_instructions?: string;
  leave_at_door: boolean;
}

interface PricingEstimate {
  base_price: number;
  urgency_premium: number;
  size_premium: number;
  special_handling_fee: number;
  service_fee: number;
  tax_amount: number;
  total_amount: number;
  estimated_pickup_time: string;
  estimated_delivery_time: string;
}

interface DeliveryOrderPayload {
  pickup_address: Address;
  delivery_address: Address;
  recipient_name: string;
  recipient_phone: string;
  package: PackageDetails;
  urgency_level: string;
  scheduled_pickup_date?: string;
  scheduled_pickup_time?: string;
  pickup_instructions?: string;
  delivery_instructions?: string;
  leave_at_door: boolean;
  payment_method_id?: string;
}

interface SavedAddress {
  uid: string;
  label: string;
  address: Address;
  is_default_pickup: boolean;
  is_default_delivery: boolean;
}

interface ValidationError {
  field: string;
  message: string;
}

interface User {
  uid: string;
  email: string;
  user_type: 'sender' | 'courier';
  first_name: string;
  last_name: string;
}

const UV_DeliveryRequest: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Mock user state (replace with actual Redux/context implementation)
  const [currentUser] = useState<User | null>(null);
  const [savedAddresses] = useState<SavedAddress[]>([]);
  const [apiError, setApiError] = useState<string>('');

  // Local form state
  const [pickupAddress, setPickupAddress] = useState<Address>({
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'USA',
  });

  const [deliveryAddress, setDeliveryAddress] = useState<Address>({
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'USA',
  });

  const [recipientInfo, setRecipientInfo] = useState({
    name: '',
    phone: ''
  });

  const [packageDetails, setPackageDetails] = useState<PackageDetails>({
    package_type: 'documents',
    size_category: 'small',
    estimated_weight: 0.5,
    is_fragile: false
  });

  const [deliveryPreferences, setDeliveryPreferences] = useState<DeliveryPreferences>({
    urgency_level: 'asap',
    leave_at_door: false
  });

  const [pickupQuery, setPickupQuery] = useState('');
  const [deliveryQuery, setDeliveryQuery] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isFormValid, setIsFormValid] = useState(false);
  const [shouldCalculatePricing, setShouldCalculatePricing] = useState(false);

  // URL parameter handling
  useEffect(() => {
    const urgent = searchParams.get('urgent');
    const repeat = searchParams.get('repeat');
    const pickupId = searchParams.get('pickup');
    const deliveryId = searchParams.get('delivery');

    if (urgent === 'true') {
      setDeliveryPreferences(prev => ({ ...prev, urgency_level: 'asap' }));
    }

    if (pickupId && savedAddresses) {
      const savedPickup = savedAddresses.find(addr => addr.uid === pickupId);
      if (savedPickup) {
        setPickupAddress(savedPickup.address);
        setPickupQuery(`${savedPickup.address.street_address}, ${savedPickup.address.city}, ${savedPickup.address.state}`);
      }
    }

    if (deliveryId && savedAddresses) {
      const savedDelivery = savedAddresses.find(addr => addr.uid === deliveryId);
      if (savedDelivery) {
        setDeliveryAddress(savedDelivery.address);
        setDeliveryQuery(`${savedDelivery.address.street_address}, ${savedDelivery.address.city}, ${savedDelivery.address.state}`);
      }
    }

    if (repeat) {
      fetchRepeatOrder(repeat);
    }
  }, [searchParams, savedAddresses]);

  // Fetch repeat order data
  const fetchRepeatOrder = async (orderId: string) => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser?.token || ''}`
        }
      });
      if (data.success && data.data) {
        const order = data.data;
        setPickupAddress(order.pickup_address);
        setDeliveryAddress(order.delivery_address);
        setRecipientInfo({
          name: order.recipient_name,
          phone: order.recipient_phone
        });
        setPackageDetails(order.package);
        setDeliveryPreferences({
          urgency_level: order.urgency_level,
          scheduled_pickup_date: order.scheduled_pickup_date,
          scheduled_pickup_time: order.scheduled_pickup_time,
          pickup_instructions: order.pickup_instructions,
          delivery_instructions: order.delivery_instructions,
          leave_at_door: order.leave_at_door
        });
        setPickupQuery(`${order.pickup_address.street_address}, ${order.pickup_address.city}, ${order.pickup_address.state}`);
        setDeliveryQuery(`${order.delivery_address.street_address}, ${order.delivery_address.city}, ${order.delivery_address.state}`);
      }
    } catch (error) {
      console.error('Failed to load repeat order:', error);
      setApiError('Failed to load previous order data. Please try again.');
    }
  };

  // Address autocomplete API calls
  const fetchAddressSuggestions = async (query: string): Promise<AddressSuggestion[]> => {
    if (!query || query.length < 3) return [];
    
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/addresses/autocomplete`, {
        params: { query, limit: 10 }
      });
      return data.data || [];
    } catch (error) {
      console.error('Address autocomplete failed:', error);
      return [];
    }
  };

  const { data: pickupSuggestions = [], isLoading: pickupLoading } = useQuery({
    queryKey: ['address-suggestions', 'pickup', pickupQuery],
    queryFn: () => fetchAddressSuggestions(pickupQuery),
    enabled: pickupQuery.length >= 3,
    staleTime: 5000
  });

  const { data: deliverySuggestions = [], isLoading: deliveryLoading } = useQuery({
    queryKey: ['address-suggestions', 'delivery', deliveryQuery],
    queryFn: () => fetchAddressSuggestions(deliveryQuery),
    enabled: deliveryQuery.length >= 3,
    staleTime: 5000
  });

  // Pricing calculation with debouncing
  const calculatePricing = async (): Promise<PricingEstimate> => {
    const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/pricing/estimate`, {
      pickup_address: {
        latitude: pickupAddress.latitude,
        longitude: pickupAddress.longitude
      },
      delivery_address: {
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude
      },
      package: {
        size_category: packageDetails.size_category,
        estimated_weight: packageDetails.estimated_weight,
        is_fragile: packageDetails.is_fragile,
        declared_value: packageDetails.declared_value
      },
      urgency_level: deliveryPreferences.urgency_level
    });
    return data.data;
  };

  const { data: pricingData, isLoading: pricingLoading, error: pricingError } = useQuery({
    queryKey: ['pricing', pickupAddress.latitude, deliveryAddress.latitude, packageDetails.size_category, packageDetails.estimated_weight, packageDetails.is_fragile, deliveryPreferences.urgency_level],
    queryFn: calculatePricing,
    enabled: shouldCalculatePricing && !!(pickupAddress.latitude && deliveryAddress.latitude),
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  // Trigger pricing calculation when both addresses are complete
  useEffect(() => {
    const hasCompleteAddresses = pickupAddress.latitude && deliveryAddress.latitude;
    setShouldCalculatePricing(!!hasCompleteAddresses);
  }, [pickupAddress.latitude, deliveryAddress.latitude]);

  // Address selection handlers with simplified geocoding
  const selectPickupAddress = (suggestion: AddressSuggestion) => {
    setPickupQuery(suggestion.description);
    // Parse address components from suggestion
    const parts = suggestion.description.split(', ');
    const address: Address = {
      street_address: suggestion.structured_formatting.main_text,
      city: parts[parts.length - 3] || '',
      state: parts[parts.length - 2] || '',
      postal_code: parts[parts.length - 1] || '',
      country: 'USA',
      // Note: Real implementation would need geocoding service for lat/lng
      latitude: 0,
      longitude: 0
    };
    setPickupAddress(address);
  };

  const selectDeliveryAddress = (suggestion: AddressSuggestion) => {
    setDeliveryQuery(suggestion.description);
    // Parse address components from suggestion
    const parts = suggestion.description.split(', ');
    const address: Address = {
      street_address: suggestion.structured_formatting.main_text,
      city: parts[parts.length - 3] || '',
      state: parts[parts.length - 2] || '',
      postal_code: parts[parts.length - 1] || '',
      country: 'USA',
      // Note: Real implementation would need geocoding service for lat/lng
      latitude: 0,
      longitude: 0
    };
    setDeliveryAddress(address);
  };

  // Form validation
  const validateForm = useCallback(() => {
    const errors: ValidationError[] = [];

    if (!pickupAddress.street_address) {
      errors.push({ field: 'pickup_address', message: 'Pickup address is required' });
    }

    if (!deliveryAddress.street_address) {
      errors.push({ field: 'delivery_address', message: 'Delivery address is required' });
    }

    if (!recipientInfo.name.trim()) {
      errors.push({ field: 'recipient_name', message: 'Recipient name is required' });
    }

    if (!recipientInfo.phone.trim()) {
      errors.push({ field: 'recipient_phone', message: 'Recipient phone is required' });
    }

    // Phone number validation
    const phoneRegex = /^[\\+]?[1-9][\\d]{0,15}$/;
    if (recipientInfo.phone.trim() && !phoneRegex.test(recipientInfo.phone.replace(/[\\s\\-\\(\\)]/g, ''))) {
      errors.push({ field: 'recipient_phone', message: 'Please enter a valid phone number' });
    }

    if (packageDetails.estimated_weight <= 0) {
      errors.push({ field: 'weight', message: 'Package weight must be greater than 0' });
    }

    if (deliveryPreferences.urgency_level === 'scheduled' && !deliveryPreferences.scheduled_pickup_date) {
      errors.push({ field: 'scheduled_date', message: 'Scheduled date is required' });
    }

    setValidationErrors(errors);
    setIsFormValid(errors.length === 0);
    return errors.length === 0;
  }, [pickupAddress, deliveryAddress, recipientInfo, packageDetails, deliveryPreferences]);

  useEffect(() => {
    validateForm();
  }, [validateForm]);

  // Form submission
  const submitDeliveryRequest = async (requestData: DeliveryOrderPayload): Promise<{ order_id: string }> => {
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders`, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token || ''}`
        }
      });
      return { order_id: data.data.uid };
    } catch (error) {
      console.error('Order submission failed:', error);
      throw new Error('Failed to submit order. Please try again.');
    }
  };

  const submitMutation = useMutation({
    mutationFn: submitDeliveryRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/checkout/${data.order_id}`);
    },
    onError: (error: Error) => {
      console.error('Order submission failed:', error);
      setValidationErrors([{ field: 'submit', message: error.message }]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const requestData: DeliveryOrderPayload = {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      recipient_name: recipientInfo.name,
      recipient_phone: recipientInfo.phone,
      package: packageDetails,
      urgency_level: deliveryPreferences.urgency_level,
      scheduled_pickup_date: deliveryPreferences.scheduled_pickup_date,
      scheduled_pickup_time: deliveryPreferences.scheduled_pickup_time,
      pickup_instructions: deliveryPreferences.pickup_instructions,
      delivery_instructions: deliveryPreferences.delivery_instructions,
      leave_at_door: deliveryPreferences.leave_at_door,
      payment_method_id: 'default' // This should come from payment method selection
    };

    submitMutation.mutate(requestData);
  };

  // Package type options
  const packageTypes = [
    { value: 'documents', label: 'Documents', icon: '📄', description: 'Papers, contracts, letters' },
    { value: 'electronics', label: 'Electronics', icon: '📱', description: 'Phones, tablets, gadgets' },
    { value: 'clothing', label: 'Clothing', icon: '👕', description: 'Clothes, accessories, shoes' },
    { value: 'food', label: 'Food', icon: '🍔', description: 'Meals, groceries, snacks' },
    { value: 'fragile', label: 'Fragile', icon: '🏺', description: 'Glassware, artwork, delicate items' },
    { value: 'other', label: 'Other', icon: '📦', description: 'General packages' }
  ];

  const packageSizes = [
    { value: 'small', label: 'Small', description: 'Envelope size (up to 1 lb)', dimensions: '9" x 12" x 2"' },
    { value: 'medium', label: 'Medium', description: 'Shoebox size (up to 10 lbs)', dimensions: '12" x 8" x 6"' },
    { value: 'large', label: 'Large', description: 'Carry-on bag size (up to 30 lbs)', dimensions: '22" x 14" x 9"' },
    { value: 'extra_large', label: 'Extra Large', description: 'Large box (up to 50 lbs)', dimensions: '24" x 18" x 12"' }
  ];

  const urgencyOptions = [
    { value: 'asap', label: 'ASAP', description: 'Within 30-60 minutes', premium: 'High' },
    { value: '1_hour', label: 'Within 1 Hour', description: 'Standard fast delivery', premium: 'Medium' },
    { value: '2_hours', label: 'Within 2 Hours', description: 'Flexible timing', premium: 'Low' },
    { value: '4_hours', label: 'Within 4 Hours', description: 'Economy option', premium: 'None' },
    { value: 'scheduled', label: 'Scheduled', description: 'Choose specific time', premium: 'None' }
  ];

  const getFieldError = (fieldName: string) => {
    return validationErrors.find(error => error.field === fieldName)?.message;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
            <Link to="/dashboard" className="hover:text-blue-600">Dashboard</Link>
            <span>›</span>
            <span className="text-gray-900">New Delivery</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Request Delivery</h1>
          <p className="text-gray-600 mt-2">Fill out the details below to book your package delivery</p>
        </div>

        {/* API Error Display */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{apiError}</p>
            <button
              type="button"
              onClick={() => setApiError('')}
              className="text-red-600 text-sm underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Address Information Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium mr-3">1</span>
              Address Information
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pickup Address */}
              <div>
                <label htmlFor="pickup-address" className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Address *
                </label>
                <div className="relative">
                  <input
                    id="pickup-address"
                    type="text"
                    value={pickupQuery}
                    onChange={(e) => setPickupQuery(e.target.value)}
                    placeholder="Enter pickup address"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      getFieldError('pickup_address') ? 'border-red-300' : 'border-gray-300'
                    }`}
                    aria-describedby={getFieldError('pickup_address') ? 'pickup-error' : undefined}
                  />
                  {pickupLoading && (
                    <div className="absolute right-3 top-3" aria-label="Loading suggestions">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {pickupSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {pickupSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.place_id}
                          type="button"
                          onClick={() => selectPickupAddress(suggestion)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                        >
                          <div className="font-medium text-gray-900">{suggestion.structured_formatting.main_text}</div>
                          <div className="text-sm text-gray-500">{suggestion.structured_formatting.secondary_text}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {getFieldError('pickup_address') && (
                  <p id="pickup-error" className="text-red-600 text-sm mt-1">{getFieldError('pickup_address')}</p>
                )}
                
                {/* Saved Addresses for Pickup */}
                {savedAddresses && savedAddresses.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Or choose from saved addresses:</p>
                    <div className="flex flex-wrap gap-2">
                      {savedAddresses.map((saved) => (
                        <button
                          key={saved.uid}
                          type="button"
                          onClick={() => {
                            setPickupAddress(saved.address);
                            setPickupQuery(`${saved.address.street_address}, ${saved.address.city}, ${saved.address.state}`);
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
                        >
                          {saved.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label htmlFor="pickup-instructions" className="sr-only">Pickup instructions</label>
                <textarea
                  id="pickup-instructions"
                  value={deliveryPreferences.pickup_instructions || ''}
                  onChange={(e) => setDeliveryPreferences(prev => ({ ...prev, pickup_instructions: e.target.value }))}
                  placeholder="Special pickup instructions (floor, parking, access codes...)"
                  className="w-full mt-3 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>

              {/* Delivery Address */}
              <div>
                <label htmlFor="delivery-address" className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Address *
                </label>
                <div className="relative">
                  <input
                    id="delivery-address"
                    type="text"
                    value={deliveryQuery}
                    onChange={(e) => setDeliveryQuery(e.target.value)}
                    placeholder="Enter delivery address"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      getFieldError('delivery_address') ? 'border-red-300' : 'border-gray-300'
                    }`}
                    aria-describedby={getFieldError('delivery_address') ? 'delivery-error' : undefined}
                  />
                  {deliveryLoading && (
                    <div className="absolute right-3 top-3" aria-label="Loading suggestions">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {deliverySuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {deliverySuggestions.map((suggestion) => (
                        <button
                          key={suggestion.place_id}
                          type="button"
                          onClick={() => selectDeliveryAddress(suggestion)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                        >
                          <div className="font-medium text-gray-900">{suggestion.structured_formatting.main_text}</div>
                          <div className="text-sm text-gray-500">{suggestion.structured_formatting.secondary_text}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {getFieldError('delivery_address') && (
                  <p id="delivery-error" className="text-red-600 text-sm mt-1">{getFieldError('delivery_address')}</p>
                )}

                {/* Saved Addresses for Delivery */}
                {savedAddresses && savedAddresses.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Or choose from saved addresses:</p>
                    <div className="flex flex-wrap gap-2">
                      {savedAddresses.map((saved) => (
                        <button
                          key={saved.uid}
                          type="button"
                          onClick={() => {
                            setDeliveryAddress(saved.address);
                            setDeliveryQuery(`${saved.address.street_address}, ${saved.address.city}, ${saved.address.state}`);
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
                        >
                          {saved.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label htmlFor="delivery-instructions" className="sr-only">Delivery instructions</label>
                <textarea
                  id="delivery-instructions"
                  value={deliveryPreferences.delivery_instructions || ''}
                  onChange={(e) => setDeliveryPreferences(prev => ({ ...prev, delivery_instructions: e.target.value }))}
                  placeholder="Delivery instructions (floor, parking, access codes...)"
                  className="w-full mt-3 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
            </div>

            {/* Recipient Information */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="recipient-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Name *
                </label>
                <input
                  id="recipient-name"
                  type="text"
                  value={recipientInfo.name}
                  onChange={(e) => setRecipientInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name of recipient"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('recipient_name') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  aria-describedby={getFieldError('recipient_name') ? 'recipient-name-error' : undefined}
                />
                {getFieldError('recipient_name') && (
                  <p id="recipient-name-error" className="text-red-600 text-sm mt-1">{getFieldError('recipient_name')}</p>
                )}
              </div>
              <div>
                <label htmlFor="recipient-phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Phone *
                </label>
                <input
                  id="recipient-phone"
                  type="tel"
                  value={recipientInfo.phone}
                  onChange={(e) => setRecipientInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('recipient_phone') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  aria-describedby={getFieldError('recipient_phone') ? 'recipient-phone-error' : undefined}
                />
                {getFieldError('recipient_phone') && (
                  <p id="recipient-phone-error" className="text-red-600 text-sm mt-1">{getFieldError('recipient_phone')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Package Specification Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium mr-3">2</span>
              Package Details
            </h2>

            {/* Package Type */}
            <fieldset className="mb-6">
              <legend className="block text-sm font-medium text-gray-700 mb-3">Package Type</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {packageTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setPackageDetails(prev => ({ ...prev, package_type: type.value as any }))}
                    className={`p-4 border-2 rounded-lg text-center transition-colors ${
                      packageDetails.package_type === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    aria-pressed={packageDetails.package_type === type.value}
                  >
                    <div className="text-2xl mb-2">{type.icon}</div>
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Package Size */}
            <fieldset className="mb-6">
              <legend className="block text-sm font-medium text-gray-700 mb-3">Package Size</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {packageSizes.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setPackageDetails(prev => ({ ...prev, size_category: size.value as any }))}
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      packageDetails.size_category === size.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    aria-pressed={packageDetails.size_category === size.value}
                  >
                    <div className="font-medium text-sm">{size.label}</div>
                    <div className="text-xs text-gray-600 mt-1">{size.description}</div>
                    <div className="text-xs text-gray-500 mt-1">{size.dimensions}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Weight and Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="weight-slider" className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Weight (lbs) *
                </label>
                <input
                  id="weight-slider"
                  type="range"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={packageDetails.estimated_weight}
                  onChange={(e) => setPackageDetails(prev => ({ ...prev, estimated_weight: parseFloat(e.target.value) }))}
                  className="w-full"
                  aria-describedby="weight-display"
                />
                <div id="weight-display" className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>0.1 lbs</span>
                  <span className="font-medium">{packageDetails.estimated_weight} lbs</span>
                  <span>50 lbs</span>
                </div>
                {getFieldError('weight') && (
                  <p className="text-red-600 text-sm mt-1">{getFieldError('weight')}</p>
                )}
              </div>

              <div>
                <label htmlFor="package-value" className="block text-sm font-medium text-gray-700 mb-2">
                  Package Value (Optional, for insurance)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    id="package-value"
                    type="number"
                    value={packageDetails.declared_value || ''}
                    onChange={(e) => setPackageDetails(prev => ({ ...prev, declared_value: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Insurance coverage up to declared value</p>
              </div>
            </div>

            {/* Fragile Handling */}
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="fragile"
                  checked={packageDetails.is_fragile}
                  onChange={(e) => setPackageDetails(prev => ({ ...prev, is_fragile: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="fragile" className="ml-2 block text-sm text-gray-900">
                  Fragile - Handle with extra care
                </label>
              </div>
              {packageDetails.is_fragile && (
                <p className="text-sm text-amber-600 mt-1">Additional fragile handling fee may apply</p>
              )}
            </div>
          </div>

          {/* Delivery Requirements Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium mr-3">3</span>
              Delivery Requirements
            </h2>

            {/* Urgency Level */}
            <fieldset className="mb-6">
              <legend className="block text-sm font-medium text-gray-700 mb-3">Delivery Urgency</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {urgencyOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDeliveryPreferences(prev => ({ ...prev, urgency_level: option.value as any }))}
                    className={`p-4 border-2 rounded-lg text-center transition-colors ${
                      deliveryPreferences.urgency_level === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    aria-pressed={deliveryPreferences.urgency_level === option.value}
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-600 mt-1">{option.description}</div>
                    <div className={`text-xs mt-1 ${
                      option.premium === 'High' ? 'text-red-600' : 
                      option.premium === 'Medium' ? 'text-orange-600' : 
                      option.premium === 'Low' ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {option.premium} Premium
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Scheduled Delivery */}
            {deliveryPreferences.urgency_level === 'scheduled' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="scheduled-date" className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date *</label>
                  <input
                    id="scheduled-date"
                    type="date"
                    value={deliveryPreferences.scheduled_pickup_date || ''}
                    onChange={(e) => setDeliveryPreferences(prev => ({ ...prev, scheduled_pickup_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      getFieldError('scheduled_date') ? 'border-red-300' : 'border-gray-300'
                    }`}
                    aria-describedby={getFieldError('scheduled_date') ? 'scheduled-date-error' : undefined}
                  />
                  {getFieldError('scheduled_date') && (
                    <p id="scheduled-date-error" className="text-red-600 text-sm mt-1">{getFieldError('scheduled_date')}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="scheduled-time" className="block text-sm font-medium text-gray-700 mb-2">Preferred Time</label>
                  <input
                    id="scheduled-time"
                    type="time"
                    value={deliveryPreferences.scheduled_pickup_time || ''}
                    onChange={(e) => setDeliveryPreferences(prev => ({ ...prev, scheduled_pickup_time: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Leave at Door */}
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="leave-at-door"
                  checked={deliveryPreferences.leave_at_door}
                  onChange={(e) => setDeliveryPreferences(prev => ({ ...prev, leave_at_door: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="leave-at-door" className="ml-2 block text-sm text-gray-900">
                  Leave at door (no signature required)
                </label>
              </div>
            </div>
          </div>

          {/* Pricing Display */}
          {pricingData && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium mr-3">4</span>
                Pricing Summary
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base delivery fee</span>
                  <span>${pricingData.base_price.toFixed(2)}</span>
                </div>
                {pricingData.size_premium > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Size premium</span>
                    <span>${pricingData.size_premium.toFixed(2)}</span>
                  </div>
                )}
                {pricingData.urgency_premium > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Urgency premium</span>
                    <span>${pricingData.urgency_premium.toFixed(2)}</span>
                  </div>
                )}
                {pricingData.special_handling_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Special handling</span>
                    <span>${pricingData.special_handling_fee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Service fee</span>
                  <span>${pricingData.service_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span>${pricingData.tax_amount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>${pricingData.total_amount.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Estimated delivery: {new Date(pricingData.estimated_delivery_time).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {pricingLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Calculating pricing...</span>
              </div>
            </div>
          )}

          {pricingError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Unable to calculate pricing. Please check addresses and try again.</p>
            </div>
          )}

          {/* Form Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-medium mb-2">Please fix the following errors:</h3>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isFormValid || submitMutation.isPending || pricingLoading}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                'Continue to Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UV_DeliveryRequest;