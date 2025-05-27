import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// TypeScript Interfaces matching backend API
interface CourierRegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  drivers_license_number: string;
  drivers_license_image: File;
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'scooter';
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  license_plate: string;
  insurance_policy_number?: string;
  insurance_expiry_date?: string;
}

interface FormErrors {
  [key: string]: string;
}

interface CourierRegistrationResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      uid: string;
      email: string;
      user_type: string;
      first_name: string;
      last_name: string;
    };
  };
}

const UV_CourierRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authenticationState } = useAppStore();

  // Form State
  const [formData, setFormData] = useState<CourierRegistrationData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    drivers_license_number: '',
    drivers_license_image: null as unknown as File,
    vehicle_type: 'car',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: undefined,
    vehicle_color: '',
    license_plate: '',
    insurance_policy_number: '',
    insurance_expiry_date: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [driversLicenseFile, setDriversLicenseFile] = useState<File | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (authenticationState.isAuthenticated) {
      navigate('/dashboard');
    }
  }, [authenticationState.isAuthenticated, navigate]);

  // API Functions
  const registerCourier = async (data: CourierRegistrationData): Promise<CourierRegistrationResponse> => {
    const formDataPayload = new FormData();

    // Add all required fields
    formDataPayload.append('email', data.email);
    formDataPayload.append('password', data.password);
    formDataPayload.append('first_name', data.first_name);
    formDataPayload.append('last_name', data.last_name);
    formDataPayload.append('phone_number', data.phone_number);
    formDataPayload.append('drivers_license_number', data.drivers_license_number);
    formDataPayload.append('vehicle_type', data.vehicle_type);
    formDataPayload.append('license_plate', data.license_plate);

    // Add optional fields if provided
    if (data.vehicle_make) formDataPayload.append('vehicle_make', data.vehicle_make);
    if (data.vehicle_model) formDataPayload.append('vehicle_model', data.vehicle_model);
    if (data.vehicle_year) formDataPayload.append('vehicle_year', data.vehicle_year.toString());
    if (data.vehicle_color) formDataPayload.append('vehicle_color', data.vehicle_color);
    if (data.insurance_policy_number) formDataPayload.append('insurance_policy_number', data.insurance_policy_number);
    if (data.insurance_expiry_date) formDataPayload.append('insurance_expiry_date', data.insurance_expiry_date);

    // Add required drivers license image
    if (driversLicenseFile) {
      formDataPayload.append('drivers_license_image', driversLicenseFile);
    }

    const { data: response } = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/register/courier`,
      formDataPayload,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response;
  };

  // React Query Mutation
  const registrationMutation = useMutation({
    mutationFn: registerCourier,
    onSuccess: (data) => {
      // Store token
      if (data.data.token) {
        localStorage.setItem('auth_token', data.data.token);
      }
      // Navigate to dashboard or verification page
      navigate('/dashboard');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      setFormErrors({ general: errorMessage });
    },
  });

  // Validation Functions
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!formData.first_name.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email format';
    if (!formData.password) errors.password = 'Password is required';
    if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (!formData.phone_number.trim()) errors.phone_number = 'Phone number is required';
    if (!formData.drivers_license_number.trim()) errors.drivers_license_number = 'Driver\'s license number is required';
    if (!formData.vehicle_type) errors.vehicle_type = 'Vehicle type is required';
    if (!formData.license_plate.trim()) errors.license_plate = 'License plate is required';
    if (!driversLicenseFile) errors.drivers_license_image = 'Driver\'s license image is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, driversLicenseFile]);

  // File Upload Handler
  const handleFileUpload = useCallback((file: File) => {
    // Validate file type and size
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      setFormErrors(prev => ({ ...prev, drivers_license_image: 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.' }));
      return;
    }

    if (file.size > maxSize) {
      setFormErrors(prev => ({ ...prev, drivers_license_image: 'File size must be less than 5MB.' }));
      return;
    }

    // Clear any previous errors
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.drivers_license_image;
      return newErrors;
    });

    setDriversLicenseFile(file);
  }, []);

  // Form Submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      registrationMutation.mutate(formData);
    }
  }, [formData, validateForm, registrationMutation]);

  // Input Change Handler
  const handleInputChange = useCallback((field: keyof CourierRegistrationData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [formErrors]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Become a Courier</h2>
          <p className="mt-2 text-gray-600">Join our delivery network and start earning today</p>
        </div>

        <div className="bg-white shadow rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.first_name && <p className="text-red-600 text-sm mt-1">{formErrors.first_name}</p>}
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.last_name && <p className="text-red-600 text-sm mt-1">{formErrors.last_name}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.email && <p className="text-red-600 text-sm mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    minLength={8}
                  />
                  {formErrors.password && <p className="text-red-600 text-sm mt-1">{formErrors.password}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.phone_number && <p className="text-red-600 text-sm mt-1">{formErrors.phone_number}</p>}
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Vehicle Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Type *
                  </label>
                  <select
                    id="vehicle_type"
                    value={formData.vehicle_type}
                    onChange={(e) => handleInputChange('vehicle_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="car">Car</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="scooter">Scooter</option>
                  </select>
                  {formErrors.vehicle_type && <p className="text-red-600 text-sm mt-1">{formErrors.vehicle_type}</p>}
                </div>

                <div>
                  <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700 mb-1">
                    License Plate *
                  </label>
                  <input
                    type="text"
                    id="license_plate"
                    value={formData.license_plate}
                    onChange={(e) => handleInputChange('license_plate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.license_plate && <p className="text-red-600 text-sm mt-1">{formErrors.license_plate}</p>}
                </div>

                <div>
                  <label htmlFor="vehicle_make" className="block text-sm font-medium text-gray-700 mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    id="vehicle_make"
                    value={formData.vehicle_make || ''}
                    onChange={(e) => handleInputChange('vehicle_make', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="vehicle_model" className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    id="vehicle_model"
                    value={formData.vehicle_model || ''}
                    onChange={(e) => handleInputChange('vehicle_model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="vehicle_year" className="block text-sm font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    id="vehicle_year"
                    value={formData.vehicle_year || ''}
                    onChange={(e) => handleInputChange('vehicle_year', parseInt(e.target.value) || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1900"
                    max="2025"
                  />
                </div>

                <div>
                  <label htmlFor="vehicle_color" className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    id="vehicle_color"
                    value={formData.vehicle_color || ''}
                    onChange={(e) => handleInputChange('vehicle_color', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Driver's License */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Driver's License</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="drivers_license_number" className="block text-sm font-medium text-gray-700 mb-1">
                    License Number *
                  </label>
                  <input
                    type="text"
                    id="drivers_license_number"
                    value={formData.drivers_license_number}
                    onChange={(e) => handleInputChange('drivers_license_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.drivers_license_number && <p className="text-red-600 text-sm mt-1">{formErrors.drivers_license_number}</p>}
                </div>

                <div>
                  <label htmlFor="drivers_license_image" className="block text-sm font-medium text-gray-700 mb-1">
                    License Image *
                  </label>
                  <input
                    type="file"
                    id="drivers_license_image"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formErrors.drivers_license_image && <p className="text-red-600 text-sm mt-1">{formErrors.drivers_license_image}</p>}
                  {driversLicenseFile && (
                    <p className="text-green-600 text-sm mt-1">✓ {driversLicenseFile.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Insurance Information */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Insurance Information (Optional)</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="insurance_policy_number" className="block text-sm font-medium text-gray-700 mb-1">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    id="insurance_policy_number"
                    value={formData.insurance_policy_number || ''}
                    onChange={(e) => handleInputChange('insurance_policy_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="insurance_expiry_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    id="insurance_expiry_date"
                    value={formData.insurance_expiry_date || ''}
                    onChange={(e) => handleInputChange('insurance_expiry_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Error Display */}
            {formErrors.general && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-600">{formErrors.general}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-between">
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-500"
              >
                Already have an account? Sign in
              </Link>

              <button
                type="submit"
                disabled={registrationMutation.isPending}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registrationMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Registering...
                  </>
                ) : (
                  'Register as Courier'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UV_CourierRegistration;