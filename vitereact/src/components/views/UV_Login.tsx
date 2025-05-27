import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types for API integration matching backend schema
interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      uid: string;
      email: string;
      user_type: 'sender' | 'courier';
      first_name: string;
      last_name: string;
      profile_image_url?: string;
      is_verified: boolean;
      is_active: boolean;
    };
  };
}

interface PasswordResetRequest {
  email: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    authenticationState, 
    setAuthenticationState,
    errorHandlingState,
    setError,
    clearErrors,
    applicationConfigurationState
  } = useAppStore();

  // URL parameter extraction
  const urlParams = new URLSearchParams(location.search);
  const returnUrl = urlParams.get('returnUrl') || '/dashboard';
  const urlUserType = urlParams.get('userType') as 'sender' | 'courier' | null;
  const isExpired = urlParams.get('expired') === 'true';

  // Form state
  const [userType, setUserType] = useState<'sender' | 'courier'>(urlUserType || 'sender');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember_me: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<Date | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (authenticationState?.authenticationStatus?.isAuthenticated) {
      navigate(returnUrl);
    }
  }, [authenticationState?.authenticationStatus?.isAuthenticated, navigate, returnUrl]);

  // Handle lockout timer
  useEffect(() => {
    if (lockoutTime && isLocked) {
      const timer = setInterval(() => {
        if (new Date() > lockoutTime) {
          setIsLocked(false);
          setLockoutTime(null);
          setLoginAttempts(0);
          setShowCaptcha(false);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime, isLocked]);

  // Email/phone validation
  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    const phoneRegex = /^\\+?[\\d\\s\\-\\(\\)]{10,}$/;
    return emailRegex.test(value) || phoneRegex.test(value);
  };

  // Real-time validation
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error on change
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Real-time email validation
    if (field === 'email' && value && !validateEmail(value)) {
      setValidationErrors(prev => ({ 
        ...prev, 
        email: 'Please enter a valid email address or phone number' 
      }));
    }
  };

  // Login API mutation
  const loginMutation = useMutation<AuthResponse, Error, LoginCredentials>({
    mutationFn: async (credentials) => {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        credentials
      );
      return data;
    },
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Login failed');
      }

      const { data } = response;
      
      // Update global authentication state
      if (setAuthenticationState && typeof setAuthenticationState === 'function') {
        setAuthenticationState({
          currentUser: data.user,
          sessionManagement: {
            jwtToken: data.token,
            refreshToken: '',
            tokenExpiry: '',
            sessionId: '',
            lastActivity: new Date().toISOString()
          },
          authenticationStatus: {
            isAuthenticated: true,
            isLoading: false,
            loginAttempts: 0,
            sessionValid: true
          },
          rolePermissions: {
            senderPermissions: data.user.user_type === 'sender' ? [] : [],
            courierPermissions: data.user.user_type === 'courier' ? [] : [],
            adminPermissions: []
          }
        });
      }

      // Store token if remember me is checked
      if (formData.remember_me) {
        localStorage.setItem('quickcourier_token', data.token);
      }

      // Clear any errors
      if (clearErrors && typeof clearErrors === 'function') {
        clearErrors();
      }
      
      // Navigate to appropriate dashboard
      const targetUrl = returnUrl === '/dashboard' 
        ? '/dashboard'
        : returnUrl;
      navigate(targetUrl);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      
      // Increment login attempts
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      // Show CAPTCHA after 3 attempts
      if (newAttempts >= 3) {
        setShowCaptcha(true);
      }

      // Lock account after 5 attempts
      if (newAttempts >= 5) {
        setIsLocked(true);
        setLockoutTime(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutes
        if (setError && typeof setError === 'function') {
          setError({
            errorId: 'login_lockout',
            errorType: 'authentication',
            message: 'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        if (setError && typeof setError === 'function') {
          setError({
            errorId: 'login_failed',
            errorType: 'authentication',
            message: errorMessage,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  });

  // Password reset mutation
  const passwordResetMutation = useMutation<any, Error, PasswordResetRequest>({
    mutationFn: async (resetData) => {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/auth/password/reset`,
        resetData
      );
      return data;
    },
    onSuccess: () => {
      setShowForgotPassword(false);
      if (setError && typeof setError === 'function') {
        setError({
          errorId: 'password_reset_sent',
          errorType: 'info',
          message: 'Password reset instructions have been sent to your email.',
          timestamp: new Date().toISOString()
        });
      }
    },
    onError: (error: any) => {
      if (setError && typeof setError === 'function') {
        setError({
          errorId: 'password_reset_failed',
          errorType: 'authentication',
          message: error.response?.data?.message || 'Failed to send password reset email.',
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clearErrors && typeof clearErrors === 'function') {
      clearErrors();
    }

    // Validation
    const errors: Record<string, string> = {};
    if (!formData.email.trim()) {
      errors.email = 'Email or phone number is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address or phone number';
    }
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    }
    if (showCaptcha && !captchaToken) {
      errors.captcha = 'Please complete the CAPTCHA verification';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (isLocked) {
      return;
    }

    // Submit login
    loginMutation.mutate({
      email: formData.email.trim(),
      password: formData.password
    });
  };

  // Handle forgot password
  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail.trim() || !validateEmail(forgotPasswordEmail)) {
      setValidationErrors({ forgotEmail: 'Please enter a valid email address' });
      return;
    }

    passwordResetMutation.mutate({
      email: forgotPasswordEmail.trim()
    });
  };

  // Handle social login - disabled since not supported by backend
  const handleSocialLogin = (provider: 'google' | 'facebook' | 'apple') => {
    if (setError && typeof setError === 'function') {
      setError({
        errorId: 'social_login_placeholder',
        errorType: 'info',
        message: `${provider} login integration coming soon!`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const lockoutTimeRemaining = lockoutTime ? Math.max(0, Math.ceil((lockoutTime.getTime() - Date.now()) / 1000)) : 0;
  const lockoutMinutes = Math.floor(lockoutTimeRemaining / 60);
  const lockoutSeconds = lockoutTimeRemaining % 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-indigo-600">QuickCourier</h1>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          {isExpired && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Your session has expired. Please sign in again.
              </p>
            </div>
          )}
        </div>

        {/* User Type Selection */}
        <div className="bg-white shadow-lg rounded-lg p-6 space-y-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setUserType('sender')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                userType === 'sender'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Send Packages
            </button>
            <button
              type="button"
              onClick={() => setUserType('courier')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                userType === 'courier'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Deliver Packages
            </button>
          </div>

          {/* Error Display */}
          {errorHandlingState?.errorTracking?.currentErrors?.length > 0 && (
            <div className="space-y-2">
              {errorHandlingState.errorTracking.currentErrors.map((error) => (
                <div
                  key={error.errorId}
                  className={`p-3 rounded-md ${
                    error.errorType === 'info' 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <p className={`text-sm ${
                    error.errorType === 'info' ? 'text-blue-800' : 'text-red-800'
                  }`}>
                    {error.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Lockout Message */}
          {isLocked && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-sm font-medium text-red-800">Account Temporarily Locked</h3>
              <p className="mt-1 text-sm text-red-700">
                Too many failed login attempts. Please try again in {lockoutMinutes}:
                {lockoutSeconds.toString().padStart(2, '0')}.
              </p>
            </div>
          )}

          {/* Forgot Password Modal */}
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Enter your email address and we'll send you a reset link.
                </p>
              </div>
              <div>
                <label htmlFor="forgot-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
                {validationErrors.forgotEmail && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.forgotEmail}</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={passwordResetMutation.isPending}
                  className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordResetMutation.isPending ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address or phone number
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    validationErrors.email ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="Email address or phone number"
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                      validationErrors.password ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                )}
              </div>

              {/* CAPTCHA placeholder */}
              {showCaptcha && (
                <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="captcha"
                      onChange={(e) => setCaptchaToken(e.target.checked ? 'captcha_verified' : '')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="captcha" className="text-sm text-gray-700">
                      I'm not a robot (CAPTCHA)
                    </label>
                  </div>
                  {validationErrors.captcha && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.captcha}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={formData.remember_me}
                    onChange={(e) => setFormData(prev => ({ ...prev, remember_me: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me for 30 days
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending || isLocked}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          )}

          {/* Social Login - Disabled as not supported by backend */}
          {!showForgotPassword && applicationConfigurationState?.featureFlags?.socialLogin && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="sr-only">Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialLogin('facebook')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="sr-only">Facebook</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialLogin('apple')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="sr-only">Apple</span>
                </button>
              </div>
            </div>
          )}

          {/* Registration Links */}
          {!showForgotPassword && (
            <div className="text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link
                to={userType === 'sender' ? '/register/sender' : '/register/courier'}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign up as a {userType}
              </Link>
            </div>
          )}
        </div>

        {/* Support Link */}
        <div className="text-center">
          <Link
            to="/support"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Need help? Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UV_Login;