import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// Type definitions
interface SupportCategory {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  icon: string;
}

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  views: number;
  helpful_votes: number;
  created_at: string;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  assigned_agent?: string;
}

interface ChatMessage {
  id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_name: string;
  message: string;
  timestamp: string;
  attachments?: string[];
}

interface LiveChatSession {
  id: string;
  status: 'waiting' | 'connected' | 'ended';
  queue_position?: number;
  estimated_wait_time?: number;
  agent_name?: string;
  messages: ChatMessage[];
}

interface CreateTicketPayload {
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  order_id?: string;
  attachments?: File[];
}

interface StartChatPayload {
  initial_message: string;
  category: string;
  order_id?: string;
}

interface SendMessagePayload {
  chat_session_id: string;
  message: string;
  attachments?: File[];
}

const UV_SupportContact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Global state with null checks
  const authState = useAppStore(state => state?.authenticationState);
  const currentUser = authState?.currentUser;
  const isAuthenticated = authState?.authenticationStatus?.isAuthenticated || false;
  const jwtToken = authState?.sessionManagement?.jwtToken;
  
  // URL parameters
  const orderParam = searchParams.get('order');
  const categoryParam = searchParams.get('category');
  const urgentParam = searchParams.get('urgent') === 'true';
  
  // Local state
  const [activeTab, setActiveTab] = useState<'chat' | 'ticket' | 'knowledge' | 'history'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryParam || '');
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    description: '',
    priority: urgentParam ? 'urgent' : 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });
  const [chatMessage, setChatMessage] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [activeChatSession, setActiveChatSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // API Base URL with fallback
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Mock data for demonstration (replace with real API when endpoints are available)
  const mockCategories: SupportCategory[] = [
    { id: '1', name: 'Order Issues', description: 'Problems with deliveries', priority: 'high', icon: '📦' },
    { id: '2', name: 'Payment', description: 'Billing and payment issues', priority: 'medium', icon: '💳' },
    { id: '3', name: 'Account', description: 'Profile and account settings', priority: 'low', icon: '👤' },
    { id: '4', name: 'Technical', description: 'App and website issues', priority: 'high', icon: '🔧' }
  ];

  const mockArticles: KnowledgeBaseArticle[] = [
    {
      id: '1',
      title: 'How to track your delivery',
      content: 'You can track your delivery in real-time through the app...',
      category: 'Order Issues',
      tags: ['tracking', 'delivery'],
      views: 150,
      helpful_votes: 12,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Payment methods accepted',
      content: 'We accept all major credit cards, PayPal, and digital wallets...',
      category: 'Payment',
      tags: ['payment', 'cards'],
      views: 89,
      helpful_votes: 8,
      created_at: new Date().toISOString()
    }
  ];

  // API Functions with error handling
  const fetchSupportCategories = async (): Promise<SupportCategory[]> => {
    try {
      // TODO: Replace with real API endpoint when available
      // const { data } = await axios.get(`${API_BASE_URL}/api/support/categories`);
      // return data;
      return mockCategories;
    } catch (error) {
      console.error('Failed to fetch support categories:', error);
      throw error;
    }
  };

  const fetchKnowledgeBase = async (query?: string, category?: string): Promise<KnowledgeBaseArticle[]> => {
    try {
      // TODO: Replace with real API endpoint when available
      let filteredArticles = mockArticles;
      if (query) {
        filteredArticles = filteredArticles.filter(article => 
          article.title.toLowerCase().includes(query.toLowerCase()) ||
          article.content.toLowerCase().includes(query.toLowerCase())
        );
      }
      if (category) {
        filteredArticles = filteredArticles.filter(article => article.category === category);
      }
      return filteredArticles;
    } catch (error) {
      console.error('Failed to fetch knowledge base:', error);
      throw error;
    }
  };

  const fetchUserTickets = async (): Promise<SupportTicket[]> => {
    if (!isAuthenticated || !jwtToken) return [];
    try {
      // TODO: Replace with real API endpoint when available
      // const { data } = await axios.get(`${API_BASE_URL}/api/support/tickets`, {
      //   headers: { Authorization: `Bearer ${jwtToken}` }
      // });
      // return data;
      return [];
    } catch (error) {
      console.error('Failed to fetch user tickets:', error);
      throw error;
    }
  };

  const fetchChatSession = async (sessionId: string): Promise<LiveChatSession> => {
    try {
      // TODO: Replace with real API endpoint when available
      // const { data } = await axios.get(`${API_BASE_URL}/api/support/chat/${sessionId}`, {
      //   headers: { Authorization: `Bearer ${jwtToken}` }
      // });
      // return data;
      return {
        id: sessionId,
        status: 'waiting',
        queue_position: 3,
        estimated_wait_time: 5,
        messages: []
      };
    } catch (error) {
      console.error('Failed to fetch chat session:', error);
      throw error;
    }
  };

  // Error handler
  const handleError = (error: AxiosError | Error, context: string) => {
    console.error(`Error in ${context}:`, error);
    setError(`Failed to ${context.toLowerCase()}. Please try again.`);
  };

  // React Query hooks with error handling
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['support-categories'],
    queryFn: fetchSupportCategories,
    onError: (error: AxiosError) => handleError(error, 'Load support categories')
  });

  const { data: knowledgeArticles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['knowledge-base', searchQuery, selectedCategory],
    queryFn: () => fetchKnowledgeBase(searchQuery, selectedCategory),
    onError: (error: AxiosError) => handleError(error, 'Load knowledge articles')
  });

  const { data: userTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['user-tickets'],
    queryFn: fetchUserTickets,
    enabled: isAuthenticated,
    onError: (error: AxiosError) => handleError(error, 'Load user tickets')
  });

  const { data: chatSession, isLoading: chatLoading } = useQuery({
    queryKey: ['chat-session', activeChatSession],
    queryFn: () => fetchChatSession(activeChatSession!),
    enabled: !!activeChatSession,
    refetchInterval: 2000,
    onError: (error: AxiosError) => handleError(error, 'Load chat session')
  });

  // Mutations with error handling
  const createTicketMutation = useMutation<SupportTicket, AxiosError, CreateTicketPayload>({
    mutationFn: async (ticketData) => {
      if (!jwtToken) throw new Error('Authentication required');
      // TODO: Replace with real API endpoint when available
      // const formData = new FormData();
      // formData.append('subject', ticketData.subject);
      // formData.append('description', ticketData.description);
      // formData.append('category', ticketData.category);
      // formData.append('priority', ticketData.priority);
      // if (ticketData.order_id) formData.append('order_id', ticketData.order_id);
      // const { data } = await axios.post(`${API_BASE_URL}/api/support/tickets`, formData, {
      //   headers: { 
      //     Authorization: `Bearer ${jwtToken}`,
      //     'Content-Type': 'multipart/form-data'
      //   }
      // });
      // return data;
      return {
        id: Date.now().toString(),
        ticket_number: `TK-${Date.now()}`,
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category,
        priority: ticketData.priority,
        status: 'open' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      setShowTicketForm(false);
      setTicketForm({ subject: '', description: '', priority: 'medium' });
      setError(null);
    },
    onError: (error: AxiosError) => handleError(error, 'Create ticket')
  });

  const startChatMutation = useMutation<LiveChatSession, AxiosError, StartChatPayload>({
    mutationFn: async (chatData) => {
      if (!jwtToken) throw new Error('Authentication required');
      // TODO: Replace with real API endpoint when available
      // const { data } = await axios.post(`${API_BASE_URL}/api/support/chat/start`, chatData, {
      //   headers: { Authorization: `Bearer ${jwtToken}` }
      // });
      // return data;
      return {
        id: Date.now().toString(),
        status: 'waiting',
        queue_position: 1,
        estimated_wait_time: 2,
        messages: []
      };
    },
    onSuccess: (session) => {
      setActiveChatSession(session.id);
      setActiveTab('chat');
      setError(null);
    },
    onError: (error: AxiosError) => handleError(error, 'Start chat')
  });

  const sendMessageMutation = useMutation<ChatMessage, AxiosError, SendMessagePayload>({
    mutationFn: async (messageData) => {
      if (!jwtToken) throw new Error('Authentication required');
      // TODO: Replace with real API endpoint when available
      // const { data } = await axios.post(`${API_BASE_URL}/api/support/chat/message`, messageData, {
      //   headers: { Authorization: `Bearer ${jwtToken}` }
      // });
      // return data;
      return {
        id: Date.now().toString(),
        sender_type: 'user',
        sender_name: currentUser?.first_name || 'You',
        message: messageData.message,
        timestamp: new Date().toISOString()
      };
    },
    onSuccess: () => {
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-session', activeChatSession] });
      setError(null);
    },
    onError: (error: AxiosError) => handleError(error, 'Send message')
  });

  // Handlers
  const handleCreateTicket = () => {
    if (!isAuthenticated) {
      window.location.href = '/login?returnUrl=/support';
      return;
    }
    
    createTicketMutation.mutate({
      subject: ticketForm.subject,
      description: ticketForm.description,
      category: selectedCategory,
      priority: ticketForm.priority,
      order_id: orderParam || undefined
    });
  };

  const handleStartChat = () => {
    if (!isAuthenticated) {
      window.location.href = '/login?returnUrl=/support';
      return;
    }
    
    startChatMutation.mutate({
      initial_message: chatMessage || 'Hello, I need assistance.',
      category: selectedCategory,
      order_id: orderParam || undefined
    });
  };

  const handleSendMessage = () => {
    if (!activeChatSession || !chatMessage.trim()) return;
    
    sendMessageMutation.mutate({
      chat_session_id: activeChatSession,
      message: chatMessage
    });
  };

  const dismissError = () => {
    setError(null);
  };

  // Effects
  useEffect(() => {
    if (urgentParam) {
      setActiveTab('ticket');
      setShowTicketForm(true);
    }
  }, [urgentParam]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-100';
      case 'in_progress': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={dismissError}
                className="text-red-400 hover:text-red-600"
                type="button"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Customer Support</h1>
            <p className="mt-2 text-sm text-gray-600">
              Get help with your deliveries, account, or platform questions
            </p>
            
            {orderParam && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-blue-700">
                    Support for Order #{orderParam}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => setActiveTab('chat')}
            className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
            type="button"
          >
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Live Chat</h3>
                <p className="text-sm text-gray-600">Get instant help from our support team</p>
              </div>
            </div>
            <div className="flex items-center text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              3 agents available
            </div>
          </button>

          <button
            onClick={() => {setActiveTab('ticket'); setShowTicketForm(true);}}
            className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
            type="button"
          >
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Ticket</h3>
                <p className="text-sm text-gray-600">Submit a detailed support request</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">Average response: 2 hours</p>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
            type="button"
          >
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Help Center</h3>
                <p className="text-sm text-gray-600">Find answers to common questions</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">500+ articles available</p>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                type="button"
              >
                Live Chat
              </button>
              <button
                onClick={() => setActiveTab('ticket')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'ticket'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                type="button"
              >
                Support Tickets
              </button>
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'knowledge'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                type="button"
              >
                Knowledge Base
              </button>
              {isAuthenticated && (
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  type="button"
                >
                  My Tickets
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {/* Live Chat Tab */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                {!activeChatSession ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Live Chat</h3>
                    <p className="text-gray-600 mb-6">Connect with our support team for immediate assistance</p>
                    
                    <div className="max-w-md mx-auto space-y-4">
                      {!categoriesLoading && categories.length > 0 && (
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      <textarea
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Describe your issue briefly..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                      />
                      
                      <button
                        onClick={handleStartChat}
                        disabled={startChatMutation.isPending}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                      >
                        {startChatMutation.isPending ? 'Starting Chat...' : 'Start Chat'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg h-96 flex flex-col">
                    {/* Chat Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-gray-900">
                            {chatSession?.agent_name ? `Chat with ${chatSession.agent_name}` : 'Connecting...'}
                          </span>
                        </div>
                        <button
                          onClick={() => setActiveChatSession(null)}
                          className="text-gray-400 hover:text-gray-600"
                          type="button"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {chatSession?.status === 'waiting' && (
                        <div className="mt-2 text-sm text-gray-600">
                          Queue position: {chatSession.queue_position} | Estimated wait: {chatSession.estimated_wait_time} min
                        </div>
                      )}
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {chatLoading ? (
                        <div className="text-center text-gray-500">Loading messages...</div>
                      ) : (
                        chatSession?.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.sender_type === 'user'
                                  ? 'bg-blue-600 text-white'
                                  : message.sender_type === 'agent'
                                  ? 'bg-gray-200 text-gray-900'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              <p className="text-sm">{message.message}</p>
                              <p className="text-xs mt-1 opacity-75">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="border-t border-gray-200 p-4">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type your message..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Support Tickets Tab */}
            {activeTab === 'ticket' && (
              <div className="space-y-6">
                {!showTicketForm ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Support Ticket</h3>
                    <p className="text-gray-600 mb-6">Submit a detailed request for complex issues that need investigation</p>
                    
                    <button
                      onClick={() => setShowTicketForm(true)}
                      className="bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700"
                      type="button"
                    >
                      Create New Ticket
                    </button>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Create Support Ticket</h3>
                      <button
                        onClick={() => setShowTicketForm(false)}
                        className="text-gray-400 hover:text-gray-600"
                        type="button"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                          Category *
                        </label>
                        <select
                          id="category"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="">Select a category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                          Priority
                        </label>
                        <select
                          id="priority"
                          value={ticketForm.priority}
                          onChange={(e) => setTicketForm({...ticketForm, priority: e.target.value as any})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                          Subject *
                        </label>
                        <input
                          id="subject"
                          type="text"
                          value={ticketForm.subject}
                          onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Brief description of your issue"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                          Description *
                        </label>
                        <textarea
                          id="description"
                          value={ticketForm.description}
                          onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={6}
                          placeholder="Please provide detailed information about your issue, including steps to reproduce if applicable"
                          required
                        />
                      </div>

                      <div className="flex space-x-4">
                        <button
                          onClick={() => setShowTicketForm(false)}
                          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateTicket}
                          disabled={createTicketMutation.isPending || !ticketForm.subject || !ticketForm.description || !selectedCategory}
                          className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                        >
                          {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Knowledge Base Tab */}
            {activeTab === 'knowledge' && (
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="max-w-2xl mx-auto">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search help articles..."
                      className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === ''
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    type="button"
                  >
                    All Topics
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      type="button"
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {/* Articles */}
                <div className="space-y-4">
                  {articlesLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">Loading articles...</p>
                    </div>
                  ) : knowledgeArticles.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47.881-6.08 2.33M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No articles found</h3>
                      <p className="text-gray-600">Try adjusting your search terms or browse different categories</p>
                    </div>
                  ) : (
                    knowledgeArticles.map((article) => (
                      <div key={article.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{article.title}</h3>
                        <p className="text-gray-600 mb-4 line-clamp-3">{article.content}</p>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            <span>{article.views} views</span>
                            <span>{article.helpful_votes} helpful</span>
                            <span className="px-2 py-1 bg-gray-100 rounded-full">{article.category}</span>
                          </div>
                          <span>{new Date(article.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* My Tickets Tab */}
            {activeTab === 'history' && isAuthenticated && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">My Support Tickets</h3>
                  <button
                    onClick={() => {setActiveTab('ticket'); setShowTicketForm(true);}}
                    className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    type="button"
                  >
                    Create New Ticket
                  </button>
                </div>

                {ticketsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading tickets...</p>
                  </div>
                ) : userTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No tickets yet</h3>
                    <p className="text-gray-600 mb-4">You haven't created any support tickets</p>
                    <button
                      onClick={() => {setActiveTab('ticket'); setShowTicketForm(true);}}
                      className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                      type="button"
                    >
                      Create Your First Ticket
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userTickets.map((ticket) => (
                      <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{ticket.subject}</h3>
                            <p className="text-sm text-gray-600">Ticket #{ticket.ticket_number}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-gray-600 mb-4 line-clamp-2">{ticket.description}</p>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                            <span>Updated {new Date(ticket.updated_at).toLocaleDateString()}</span>
                            {ticket.assigned_agent && <span>Agent: {ticket.assigned_agent}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Additional Support Options */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Alternative Contact Methods</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-700">support@quickcourier.com</span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-gray-700">1-800-COURIER (1-800-268-7437)</span>
              </div>
              <div className="text-sm text-gray-500">
                Phone support: Monday-Friday 8AM-8PM EST
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Support</h3>
            <p className="text-gray-600 mb-4">
              For urgent delivery issues or safety concerns during active deliveries
            </p>
            <button 
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
              type="button"
            >
              Emergency Hotline: 1-800-911-HELP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_SupportContact;