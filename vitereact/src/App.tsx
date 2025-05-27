import React, { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import "./App.css";

// Lazy load all view components for better performance
const UV_Landing = React.lazy(() => import('@/components/views/UV_Landing'));
const UV_Login = React.lazy(() => import('@/components/views/UV_Login'));
const UV_SenderRegistration = React.lazy(() => import('@/components/views/UV_SenderRegistration'));
const UV_CourierRegistration = React.lazy(() => import('@/components/views/UV_CourierRegistration'));
const UV_SenderDashboard = React.lazy(() => import('@/components/views/UV_SenderDashboard'));
const UV_CourierDashboard = React.lazy(() => import('@/components/views/UV_CourierDashboard'));
const UV_DeliveryRequest = React.lazy(() => import('@/components/views/UV_DeliveryRequest'));
const UV_TrackingPage = React.lazy(() => import('@/components/views/UV_TrackingPage'));
const UV_PaymentCheckout = React.lazy(() => import('@/components/views/UV_PaymentCheckout'));
const UV_DeliveryHistory = React.lazy(() => import('@/components/views/UV_DeliveryHistory'));
const UV_ProfileSettings = React.lazy(() => import('@/components/views/UV_ProfileSettings'));
const UV_RatingReview = React.lazy(() => import('@/components/views/UV_RatingReview'));
const UV_CourierVerification = React.lazy(() => import('@/components/views/UV_CourierVerification'));
const UV_SupportContact = React.lazy(() => import('@/components/views/UV_SupportContact'));

// Configure QueryClient with proper error handling and retry logic
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 408, 429
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return error?.response?.status === 408 || error?.response?.status === 429 ? failureCount < 2 : false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// Global Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Global Error Boundary caught an error:', error, errorInfo);
    // Here you could log to an error reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Spinner Component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

// Enhanced Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedUserTypes?: Array<'sender' | 'courier'>;
}> = ({ 
  children, 
  requireAuth = true,
  allowedUserTypes 
}) => {
  const { authentication_state } = useAppStore();
  const location = useLocation();
  
  if (requireAuth && !authentication_state.authentication_status.is_authenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (allowedUserTypes && authentication_state.current_user) {
    const userType = authentication_state.current_user.user_type;
    if (!allowedUserTypes.includes(userType)) {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  return <>{children}</>;
};

// Dashboard Route Component with enhanced logic
const DashboardRoute: React.FC = () => {
  const { authentication_state } = useAppStore();
  
  if (!authentication_state.authentication_status.is_authenticated) {
    return <Navigate to="/login?returnUrl=/dashboard" replace />;
  }
  
  const userType = authentication_state.current_user?.user_type;
  
  if (userType === 'sender') {
    return <UV_SenderDashboard />;
  } else if (userType === 'courier') {
    return <UV_CourierDashboard />;
  } else {
    return <Navigate to="/login" replace />;
  }
};

// App Initialization Component
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { authentication_state, initializeAuth } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Configure axios defaults
        axios.defaults.baseURL = process.env.REACT_APP_API_BASE_URL || '/api';
        axios.defaults.timeout = 10000;

        // Add request interceptor for auth token
        axios.interceptors.request.use(
          (config) => {
            const token = authentication_state.session_management.jwt_token;
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
          },
          (error) => Promise.reject(error)
        );

        // Add response interceptor for error handling
        axios.interceptors.response.use(
          (response) => response,
          (error) => {
            if (error.response?.status === 401) {
              // Handle token expiration
              // You might want to call a logout action here
            }
            return Promise.reject(error);
          }
        );

        // Initialize authentication if available
        if (typeof initializeAuth === 'function') {
          await initializeAuth();
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [authentication_state.session_management.jwt_token, initializeAuth]);

  if (!isInitialized) {
    return <LoadingSpinner message="Initializing application..." />;
  }

  return <>{children}</>;
};

// Main App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<UV_Landing />} />
        <Route path="/login" element={<UV_Login />} />
        <Route path="/register/sender" element={<UV_SenderRegistration />} />
        <Route path="/register/courier" element={<UV_CourierRegistration />} />
        <Route path="/support" element={<UV_SupportContact />} />
        
        {/* Public route with token access */}
        <Route path="/track/:order_id" element={<UV_TrackingPage />} />
        
        {/* Dashboard with conditional rendering */}
        <Route path="/dashboard" element={<DashboardRoute />} />
        
        {/* Protected routes for authenticated users */}
        <Route 
          path="/request-delivery" 
          element={
            <ProtectedRoute>
              <UV_DeliveryRequest />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/checkout/:order_id" 
          element={
            <ProtectedRoute>
              <UV_PaymentCheckout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/history" 
          element={
            <ProtectedRoute>
              <UV_DeliveryHistory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <UV_ProfileSettings />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/rate/:order_id" 
          element={
            <ProtectedRoute>
              <UV_RatingReview />
            </ProtectedRoute>
          } 
        />
        
        {/* Courier-only routes */}
        <Route 
          path="/verification" 
          element={
            <ProtectedRoute allowedUserTypes={['courier']}>
              <UV_CourierVerification />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch all route - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppInitializer>
            <AppRoutes />
          </AppInitializer>
        </BrowserRouter>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;