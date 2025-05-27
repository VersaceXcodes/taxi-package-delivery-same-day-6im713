import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Type definitions matching backend schemas
interface OrderDetails {
  uid: string;
  order_number: string;
  status: 'pending' | 'courier_assigned' | 'pickup_in_progress' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  pickup_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: number;
    longitude: number;
    building_instructions?: string;
  };
  delivery_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: number;
    longitude: number;
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
    package_description?: string;
  };
  estimated_pickup_time: string;
  estimated_delivery_time: string;
  base_price: number;
  total_amount: number;
  sender_id: string;
  courier_id?: string;
  created_at: string;
  updated_at: string;
  courier?: {
    uid: string;
    first_name: string;
    last_name: string;
    profile_image_url?: string;
  };
}

interface Message {
  uid: string;
  order_id: string;
  sender_id: string;
  message_content: string;
  sent_at: string;
  message_type: 'text' | 'image' | 'quick_template' | 'system';
  image_url?: string;
  is_read: boolean;
  sender: {
    uid: string;
    first_name: string;
    last_name: string;
  };
}

interface SendMessagePayload {
  recipient_id: string;
  message_type: 'text' | 'image' | 'quick_template';
  message_content: string;
  image_url?: string;
}

const UV_TrackingPage: React.FC = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state with null checks
  const authState = useAppStore((state) => state.authenticationState || {});
  const currentUser = authState.currentUser || null;
  const isAuthenticated = authState.isAuthenticated || false;
  const jwtToken = authState.sessionManagement?.jwtToken || null;

  // Local component state
  const [selectedTab, setSelectedTab] = useState<'map' | 'timeline' | 'messages'>('map');
  const [messageInput, setMessageInput] = useState('');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showCourierInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // URL parameters
  const publicToken = searchParams.get('token');

  // API functions with proper error handling
  const fetchOrderDetails = async (): Promise<OrderDetails> => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`,
        {
          headers: isAuthenticated && jwtToken ? {
            Authorization: `Bearer ${jwtToken}`
          } : {},
          params: publicToken ? { token: publicToken } : {}
        }
      );
      return data.data;
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  };

  const fetchMessages = async (): Promise<Message[]> => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/messages/${order_id}`,
        {
          headers: isAuthenticated && jwtToken ? {
            Authorization: `Bearer ${jwtToken}`
          } : {},
          params: publicToken ? { token: publicToken } : {}
        }
      );
      return data.data.messages || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const sendMessage = async (payload: SendMessagePayload): Promise<Message> => {
    const { data } = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/messages/${order_id}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return data.data;
  };

  // React Query hooks
  const { data: orderDetails, isLoading: orderLoading, isError: orderError } = useQuery<OrderDetails, Error>({
    queryKey: ['order', order_id],
    queryFn: fetchOrderDetails,
    enabled: !!order_id,
    refetchInterval: 30000,
    retry: 3
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[], Error>({
    queryKey: ['messages', order_id],
    queryFn: fetchMessages,
    enabled: !!order_id && isAuthenticated,
    refetchInterval: 5000,
    retry: 1
  });

  const sendMessageMutation = useMutation<Message, Error, SendMessagePayload>({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', order_id] });
      setMessageInput('');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
    }
  });

  // Update map center when order details load
  useEffect(() => {
    if (orderDetails && orderDetails.pickup_address && orderDetails.delivery_address && !mapCenter) {
      const centerLat = (orderDetails.pickup_address.latitude + orderDetails.delivery_address.latitude) / 2;
      const centerLng = (orderDetails.pickup_address.longitude + orderDetails.delivery_address.longitude) / 2;
      setMapCenter({ lat: centerLat, lng: centerLng });
    }
  }, [orderDetails, mapCenter]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle message input
  const handleSendMessage = () => {
    if (!messageInput.trim() || !isAuthenticated || !order_id || !orderDetails) return;

    const recipientId = orderDetails.courier_id || orderDetails.sender_id;
    if (!recipientId) return;

    sendMessageMutation.mutate({
      recipient_id: recipientId,
      message_type: 'text',
      message_content: messageInput.trim()
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-500';
      case 'courier_assigned': return 'bg-yellow-500';
      case 'pickup_in_progress': return 'bg-orange-500';
      case 'in_transit': return 'bg-indigo-500';
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'failed': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Order Pending';
      case 'courier_assigned': return 'Courier Assigned';
      case 'pickup_in_progress': return 'Pickup in Progress';
      case 'in_transit': return 'In Transit';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'failed': return 'Failed';
      default: return 'Unknown Status';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (orderLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (orderError || !orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">We couldn't find the delivery order you're looking for. Please check the tracking link and try again.</p>
          <Link to="/" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to={isAuthenticated ? "/dashboard" : "/"} className="text-gray-500 hover:text-gray-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Tracking Order</h1>
                <p className="text-sm text-gray-500">#{orderDetails.order_number}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(orderDetails.status)}`}>
                {getStatusText(orderDetails.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setSelectedTab('map')}
            className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
              selectedTab === 'map' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setSelectedTab('timeline')}
            className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
              selectedTab === 'timeline' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500'
            }`}
          >
            Timeline
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setSelectedTab('messages')}
              className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                selectedTab === 'messages' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500'
              }`}
            >
              Messages
              {messages.filter(m => !m.is_read && m.sender_id !== currentUser?.uid).length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {messages.filter(m => !m.is_read && m.sender_id !== currentUser?.uid).length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Map and Timeline Section */}
          <div className={`lg:col-span-2 ${selectedTab !== 'map' && selectedTab !== 'timeline' ? 'hidden lg:block' : ''}`}>
            {/* Map Container */}
            <div className={`bg-white rounded-lg shadow-sm mb-6 ${selectedTab !== 'map' ? 'hidden lg:block' : ''}`}>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Live Tracking</h2>
                </div>
              </div>
              {/* Simplified Map Placeholder */}
              <div className="h-96 bg-gray-100 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="bg-blue-600 text-white p-3 rounded-full mb-4 inline-block">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-sm">Interactive map showing real-time courier location</p>
                    <p className="text-gray-500 text-xs mt-1">Map integration would be implemented with Leaflet or Google Maps</p>
                  </div>
                </div>
                {/* Map Controls */}
                <div className="absolute top-4 right-4 flex flex-col space-y-2">
                  <button className="bg-white shadow-md rounded p-2 hover:bg-gray-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                  <button className="bg-white shadow-md rounded p-2 hover:bg-gray-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button className="bg-white shadow-md rounded p-2 hover:bg-gray-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Route Information */}
              <div className="p-4 bg-gray-50 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Pickup Location</p>
                    <p className="font-medium">{orderDetails.pickup_address.street_address}</p>
                    <p className="text-gray-500">{orderDetails.pickup_address.city}, {orderDetails.pickup_address.state} {orderDetails.pickup_address.postal_code}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Delivery Location</p>
                    <p className="font-medium">{orderDetails.delivery_address.street_address}</p>
                    <p className="text-gray-500">{orderDetails.delivery_address.city}, {orderDetails.delivery_address.state} {orderDetails.delivery_address.postal_code}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Timeline Section */}
            <div className={`bg-white rounded-lg shadow-sm ${selectedTab !== 'timeline' ? 'hidden lg:block' : ''}`}>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Delivery Timeline</h2>
              </div>
              <div className="p-4">
                <div className="flow-root">
                  <ul className="space-y-6">
                    <li className="relative flex items-start">
                      <div className="relative flex items-center justify-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getStatusColor(orderDetails.status)}`}>
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {getStatusText(orderDetails.status)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Last updated: {formatTime(orderDetails.updated_at)}
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          {/* Right Sidebar - Courier Info and Messages */}
          <div className="lg:col-span-1">
            {/* Courier Information Panel */}
            {orderDetails.courier && showCourierInfo && (
              <div className="bg-white rounded-lg shadow-sm mb-6">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Your Courier</h2>
                </div>
                <div className="p-4">
                  <div className="flex items-center space-x-4 mb-4">
                    <img
                      src={orderDetails.courier.profile_image_url || `https://picsum.photos/64/64?random=${orderDetails.courier.uid}`}
                      alt={`${orderDetails.courier.first_name} ${orderDetails.courier.last_name}`}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {orderDetails.courier.first_name} {orderDetails.courier.last_name}
                      </h3>
                    </div>
                  </div>
                  {/* Contact Options */}
                  {isAuthenticated && (
                    <div className="grid grid-cols-2 gap-3">
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center">
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Call
                      </button>
                      <button 
                        onClick={() => setSelectedTab('messages')}
                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center justify-center"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Message
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Messages Section */}
            {isAuthenticated && (
              <div className={`bg-white rounded-lg shadow-sm ${selectedTab !== 'messages' ? 'hidden lg:block' : ''}`}>
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
                </div>
                {/* Messages Container */}
                <div className="h-96 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs text-gray-400 mt-1">Start a conversation with your courier</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.uid}
                          className={`flex ${message.sender_id === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs px-4 py-2 rounded-lg ${
                            message.sender_id === currentUser?.uid
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <p className="text-sm">{message.message_content}</p>
                            <p className={`text-xs mt-1 ${
                              message.sender_id === currentUser?.uid ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatTime(message.sent_at)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  {/* Message Input */}
                  <div className="p-4 border-t">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your message..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || sendMessageMutation.isPending}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_TrackingPage;