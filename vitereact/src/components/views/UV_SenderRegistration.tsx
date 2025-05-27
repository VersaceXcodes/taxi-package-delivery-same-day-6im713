import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

// Interfaces matching backend API
interface RegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  marketing_opt_in: boolean;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  confirm_password?: string;
}

interface AddressSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: any;
  };
}

const UV_SenderRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Parameters
  const referralCode = searchParams.get('ref') || '';

  // Component State
  const [formData, setFormData] = useState<RegistrationData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    marketing_opt_in: false
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  // Form persistence
  useEffect(() => {
    const savedData = localStorage.getItem('sender_registration_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed.formData || formData);
        setConfirmPassword(parsed.confirmPassword || '');
      } catch (error) {
        console.error('Error parsing saved registration data:', error);
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      formData,
      confirmPassword
    };
    localStorage.setItem('sender_registration_data', JSON.stringify(dataToSave));
  }, [formData, confirmPassword]);

  // API Functions
  const searchAddresses = async (query: string): Promise<AddressSuggestion[]> => {
    const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/addresses/autocomplete?query=${encodeURIComponent(query)}`);
    return data.data || [];
  };

  const registerSender = async (payload: RegistrationData): Promise<AuthResponse> => {
    const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/register/sender`, payload);
    return data;
  };

  // React Query Mutations
  const addressSearchMutation = useMutation({
    mutationFn: searchAddresses,
    onSuccess: (data) => {
      setAddressSuggestions(data);
      setShowAddressSuggestions(true);
    }
  });

  const registrationMutation = useMutation({
    mutationFn: registerSender,
    onSuccess: (data) => {
      // Store authentication data in localStorage since no Redux store is available
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('current_user', JSON.stringify(data.data.user));
      localStorage.removeItem('sender_registration_data');
      navigate('/dashboard');
    },
    onError: (error: any) => {
      console.error('Registration failed:', error);
      if (error.response?.data?.message) {
        setValidationErrors({ email: error.response.data.message });
      }
    }
  });

  // Validation Functions
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.first_name || formData.first_name.length < 2 || formData.first_name.length > 50) {
      errors.first_name = 'First name must be between 2-50 characters';
    }

    if (!formData.last_name || formData.last_name.length < 2 || formData.last_name.length > 50) {
      errors.last_name = 'Last name must be between 2-50 characters';
    }

    if (!formData.email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone_number || !/^\\+?[\\d\\s\\-\\(\\)]+$/.test(formData.phone_number)) {
      errors.phone_number = 'Please enter a valid phone number';
    }

    if (!formData.password || formData.password.length < 8 || 
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/.test(formData.password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }

    if (formData.password !== confirmPassword) {
      errors.confirm_password = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Event Handlers
  const handleInputChange = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressSearch = (query: string) => {
    if (query.length > 2) {
      addressSearchMutation.mutate(query);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    registrationMutation.mutate(formData);
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\\d/.test(password)) strength++;
    if (/[^a-zA-Z\\d]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <div className="text-2xl font-bold text-blue-600">QuickCourier</div>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your Sender Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.first_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your first name"
                  required
                />
                {validationErrors.first_name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.first_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.last_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your last name"
                  required
                />
                {validationErrors.last_name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.last_name}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your email address"
                required
              />
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.phone_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="+1 (555) 123-4567"
                required
              />
              {validationErrors.phone_number && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.phone_number}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Create a strong password"
                required
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.strength <= 2 ? 'text-red-500' : 
                      passwordStrength.strength <= 3 ? 'text-yellow-500' : 
                      passwordStrength.strength <= 4 ? 'text-blue-500' : 'text-green-500'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.confirm_password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Confirm your password"
                required
              />
              {validationErrors.confirm_password && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.confirm_password}</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                id="marketing_opt_in"
                type="checkbox"
                checked={formData.marketing_opt_in}
                onChange={(e) => handleInputChange('marketing_opt_in', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="marketing_opt_in" className="text-sm text-gray-700">
                I would like to receive marketing emails and updates
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={registrationMutation.isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registrationMutation.isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UV_SenderRegistration;