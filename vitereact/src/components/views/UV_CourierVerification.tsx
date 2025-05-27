import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Updated interfaces to match API specification
interface CourierVerificationData {
  profile: {
    uid: string;
    user_id: string;
    drivers_license_number?: string;
    drivers_license_image_url?: string;
    background_check_status: 'pending' | 'approved' | 'rejected';
    background_check_date?: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    verification_notes?: string;
    approval_date?: string;
  };
  user: {
    uid: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    is_verified: boolean;
  };
}

interface UploadResponse {
  file_url: string;
  file_type: string;
  upload_timestamp: string;
}

interface FileUploadState {
  [key: string]: {
    uploading: boolean;
    progress: number;
    error?: string;
  };
}

// Simple auth context for demo - in real app would be from Redux/Context
interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  user?: {
    userType: string;
  };
}

const UV_CourierVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const step = searchParams.get('step');
  const resubmit = searchParams.get('resubmit');
  
  const [activeTab, setActiveTab] = useState<'progress' | 'documents' | 'communication'>('progress');
  const [fileUploadStates, setFileUploadStates] = useState<FileUploadState>({});
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File | null }>({});

  // Mock auth state - in real app would come from Redux store
  const authState: AuthState = {
    isAuthenticated: true, // Would come from actual auth state
    token: localStorage.getItem('authToken') || '',
    user: { userType: 'courier' }
  };

  const queryClient = useQueryClient();

  // Redirect if not authenticated or not a courier
  useEffect(() => {
    if (!authState.isAuthenticated || authState.user?.userType !== 'courier') {
      navigate('/login');
    }
  }, [authState, navigate]);

  // Set active tab based on URL parameters
  useEffect(() => {
    if (step) {
      setActiveTab('progress');
    }
    if (resubmit) {
      setActiveTab('documents');
    }
  }, [step, resubmit]);

  // Fetch courier profile using actual API endpoint
  const fetchCourierProfile = async (): Promise<CourierVerificationData> => {
    const [profileResponse, userResponse] = await Promise.all([
      axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/profile/courier`,
        {
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        }
      ),
      axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/profile`,
        {
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        }
      )
    ]);

    return {
      profile: profileResponse.data.data,
      user: userResponse.data.data
    };
  };

  const { data: verificationData, isLoading: statusLoading, error: statusError } = useQuery<CourierVerificationData, Error>({
    queryKey: ['courierVerificationData'],
    queryFn: fetchCourierProfile,
    enabled: authState.isAuthenticated && authState.user?.userType === 'courier',
  });

  // Document upload using actual API endpoint
  const uploadDocument = async (data: { file: File; file_type: string }): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('file_type', data.file_type);

    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && progressEvent.total > 0) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFileUploadStates(prev => ({
              ...prev,
              [data.file_type]: { ...prev[data.file_type], progress: percentCompleted }
            }));
          }
        },
      }
    );

    return response.data.data;
  };

  const uploadDocumentMutation = useMutation<UploadResponse, Error, { file: File; file_type: string }>({
    mutationFn: uploadDocument,
    onMutate: ({ file_type }) => {
      setFileUploadStates(prev => ({
        ...prev,
        [file_type]: { uploading: true, progress: 0 }
      }));
    },
    onSuccess: (_, { file_type }) => {
      setFileUploadStates(prev => ({
        ...prev,
        [file_type]: { uploading: false, progress: 100 }
      }));
      setSelectedFiles(prev => ({ ...prev, [file_type]: null }));
      queryClient.invalidateQueries({ queryKey: ['courierVerificationData'] });
    },
    onError: (error, { file_type }) => {
      setFileUploadStates(prev => ({
        ...prev,
        [file_type]: { uploading: false, progress: 0, error: error.message }
      }));
    },
  });

  // Handle file selection
  const handleFileSelect = (fileType: string, file: File | null) => {
    setSelectedFiles(prev => ({ ...prev, [fileType]: file }));
  };

  // Handle file upload
  const handleFileUpload = (fileType: string) => {
    const file = selectedFiles[fileType];
    if (file) {
      uploadDocumentMutation.mutate({ file, file_type: fileType });
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
      case 'approved':
        return '✓';
      case 'rejected':
        return '✗';
      case 'pending':
        return '⏳';
      default:
        return '○';
    }
  };

  // Calculate overall progress
  const calculateProgress = () => {
    if (!verificationData?.profile) return 0;

    let completed = 0;
    let total = 3; // Background check, verification, driver license

    if (verificationData.profile.background_check_status === 'approved') completed++;
    if (verificationData.profile.verification_status === 'verified') completed++;
    if (verificationData.profile.drivers_license_image_url) completed++;

    return Math.round((completed / total) * 100);
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 text-center mt-4">Loading verification status...</p>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Verification Status</h2>
          <p className="text-gray-600 mb-4">{statusError.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Verification Center</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Verification Progress</h2>
            <span className="text-sm text-gray-500">
              {progress}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'progress', label: 'Progress', icon: '📊' },
                { id: 'documents', label: 'Documents', icon: '📄' },
                { id: 'communication', label: 'Support', icon: '💬' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'progress' | 'documents' | 'communication')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${\n                    activeTab === tab.id\n                      ? 'border-blue-500 text-blue-600'\n                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'\n                  }`}\n                  type="button"
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Progress Tab */}
            {activeTab === 'progress' && verificationData && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Verification Steps</h3>
                  <div className="space-y-4">
                    {/* Background Check */}
                    <div className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStatusColor(verificationData.profile.background_check_status)}`}>
                        {getStatusIcon(verificationData.profile.background_check_status)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Background Check</h4>
                        <p className="text-gray-600 text-sm mt-1">Verification of your background and criminal history</p>
                        {verificationData.profile.background_check_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Completed: {new Date(verificationData.profile.background_check_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(verificationData.profile.background_check_status)}`}>
                        {verificationData.profile.background_check_status.toUpperCase()}
                      </div>
                    </div>

                    {/* Identity Verification */}
                    <div className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStatusColor(verificationData.profile.verification_status)}`}>
                        {getStatusIcon(verificationData.profile.verification_status)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Identity Verification</h4>
                        <p className="text-gray-600 text-sm mt-1">Verification of your identity and documentation</p>
                        {verificationData.profile.verification_notes && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-600">
                            <strong>Note:</strong> {verificationData.profile.verification_notes}
                          </div>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(verificationData.profile.verification_status)}`}>
                        {verificationData.profile.verification_status.toUpperCase()}
                      </div>
                    </div>

                    {/* Driver License */}
                    <div className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStatusColor(verificationData.profile.drivers_license_image_url ? 'verified' : 'pending')}`}>
                        {getStatusIcon(verificationData.profile.drivers_license_image_url ? 'verified' : 'pending')}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Driver's License</h4>
                        <p className="text-gray-600 text-sm mt-1">Upload and verification of your driver's license</p>
                        {verificationData.profile.drivers_license_number && (
                          <p className="text-xs text-gray-500 mt-1">
                            License: {verificationData.profile.drivers_license_number}
                          </p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(verificationData.profile.drivers_license_image_url ? 'verified' : 'pending')}`}>
                        {verificationData.profile.drivers_license_image_url ? 'UPLOADED' : 'PENDING'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Document Management</h3>
                \n                {/* Driver License Upload */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Driver's License</h4>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(verificationData?.profile.drivers_license_image_url ? 'verified' : 'pending')}`}>
                      {verificationData?.profile.drivers_license_image_url ? 'UPLOADED' : 'PENDING'}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Upload a clear photo of your driver's license (front side only)
                    <span className="text-red-600"> *Required</span>
                  </p>

                  {!verificationData?.profile.drivers_license_image_url && (
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect('driver_license', e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {selectedFiles.driver_license && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{selectedFiles.driver_license?.name}</span>
                          <button
                            onClick={() => handleFileUpload('driver_license')}
                            disabled={fileUploadStates.driver_license?.uploading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                            type="button"
                          >
                            {fileUploadStates.driver_license?.uploading ? 'Uploading...' : 'Upload'}
                          </button>
                        </div>
                      )}
                      {fileUploadStates.driver_license?.uploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${fileUploadStates.driver_license?.progress || 0}%` }}
                          ></div>
                        </div>
                      )}
                      {fileUploadStates.driver_license?.error && (
                        <p className="text-red-600 text-sm">{fileUploadStates.driver_license?.error}</p>
                      )}
                    </div>
                  )}
                  \n
                  {verificationData?.profile.drivers_license_image_url && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-600">
                      <strong>Document uploaded successfully</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Communication Tab */}
            {activeTab === 'communication' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Support Information</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Contact Support</h4>
                    <p className="text-gray-600 text-sm mb-3">Get help with verification issues</p>
                    <p className="text-sm text-gray-600">Email: verification@quickcourier.com</p>
                    <p className="text-sm text-gray-600">Phone: 1-800-COURIER</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Verification Status</h4>
                    <p className="text-gray-600 text-sm mb-3">Current status of your application</p>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${getStatusColor(verificationData?.profile.verification_status || 'pending')}`}>
                      {(verificationData?.profile.verification_status || 'pending').toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Help Resources */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Need Help?</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center p-4 border border-gray-200 rounded-lg">
              <span className="text-2xl mr-3">📞</span>
              <div>
                <h4 className="font-medium text-gray-900">Contact Support</h4>
                <p className="text-gray-600 text-sm">Get help with verification issues</p>
              </div>
            </div>
            <div className="flex items-center p-4 border border-gray-200 rounded-lg">
              <span className="text-2xl mr-3">📚</span>
              <div>
                <h4 className="font-medium text-gray-900">FAQ</h4>
                <p className="text-gray-600 text-sm">Common verification questions</p>
              </div>
            </div>
            <div className="flex items-center p-4 border border-gray-200 rounded-lg">
              <span className="text-2xl mr-3">💬</span>
              <div>
                <h4 className="font-medium text-gray-900">Documentation</h4>
                <p className="text-gray-600 text-sm">Verification requirements guide</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_CourierVerification;