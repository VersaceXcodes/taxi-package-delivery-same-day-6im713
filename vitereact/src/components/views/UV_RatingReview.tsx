import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface OrderDetails {
  uid: string;
  order_number: string;
  status: string;
  pickup_address: {
    street_address: string;
    city: string;
    state: string;
  };
  delivery_address: {
    street_address: string;
    city: string;
    state: string;
  };
  package: {
    package_type: string;
    size_category: string;
    estimated_weight: number;
  };
  courier: {
    uid: string;
    first_name: string;
    last_name: string;
    profile_image_url: string;
  };
  sender_id: string;
  actual_delivery_time: string;
  total_amount: number;
}

interface CourierProfile {
  average_rating: number;
}

interface RatingSubmission {
  rated_id: string;
  overall_rating: number;
  professionalism_rating?: number;
  speed_rating?: number;
  communication_rating?: number;
  package_handling_rating?: number;
  written_feedback?: string;
  is_anonymous: boolean;
  images?: string[];
}

interface PhotoUpload {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded_url?: string;
}

const UV_RatingReview: React.FC = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { currentUser, isAuthenticated, jwtToken } = useAppStore(state => ({
    currentUser: state.authenticationState.currentUser,
    isAuthenticated: state.authenticationState.authenticationStatus.isAuthenticated,
    jwtToken: state.authenticationState.sessionManagement.jwtToken,
  }));

  // Form state
  const [overallRating, setOverallRating] = useState<number>(0);
  const [categoryRatings, setCategoryRatings] = useState({
    speed: 0,
    communication: 0,
    professionalism: 0,
    package_handling: 0,
  });
  const [writtenFeedback, setWrittenFeedback] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [photoUploads, setPhotoUploads] = useState<PhotoUpload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const ratingType = searchParams.get('type') as 'sender_to_courier' | 'courier_to_sender' || 'sender_to_courier';

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      photoUploads.forEach(upload => {
        if (upload.preview) {
          URL.revokeObjectURL(upload.preview);
        }
      });
    };
  }, []);

  // Fetch order details
  const fetchOrderDetails = async (): Promise<OrderDetails> => {
    const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    return data.data;
  };

  // Fetch courier profile for rating
  const fetchCourierProfile = async (courierId: string): Promise<CourierProfile> => {
    const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/profile/courier`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    return data.data;
  };

  const { data: orderDetails, isLoading: orderLoading, isError: orderError } = useQuery<OrderDetails, Error>({
    queryKey: ['orderDetails', order_id],
    queryFn: fetchOrderDetails,
    enabled: !!order_id && isAuthenticated && !!jwtToken,
  });

  const { data: courierProfile } = useQuery<CourierProfile, Error>({
    queryKey: ['courierProfile', orderDetails?.courier?.uid],
    queryFn: () => fetchCourierProfile(orderDetails?.courier?.uid || ''),
    enabled: !!orderDetails?.courier?.uid && !!jwtToken,
  });

  // Photo upload mutation
  const uploadPhoto = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('photo_type', 'delivery');
    
    const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    return data.data.photo_url;
  };

  const photoUploadMutation = useMutation<string, Error, File>({
    mutationFn: uploadPhoto,
    onSuccess: (uploadedUrl, file) => {
      setPhotoUploads(prev => prev.map(upload => 
        upload.file === file 
          ? { ...upload, uploading: false, uploaded_url: uploadedUrl }
          : upload
      ));
    },
    onError: (error, file) => {
      setPhotoUploads(prev => {
        const updatedUploads = prev.filter(upload => upload.file !== file);
        // Clean up object URL for failed upload
        const failedUpload = prev.find(upload => upload.file === file);
        if (failedUpload?.preview) {
          URL.revokeObjectURL(failedUpload.preview);
        }
        return updatedUploads;
      });
      console.error('Photo upload failed:', error);
    },
  });

  // Rating submission mutation
  const submitRating = async (ratingData: RatingSubmission): Promise<void> => {
    await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/ratings/${order_id}`, ratingData, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });
  };

  const ratingMutation = useMutation<void, Error, RatingSubmission>({
    mutationFn: submitRating,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderDetails', order_id] });
      queryClient.invalidateQueries({ queryKey: ['deliveryHistory'] });
      
      // Navigate based on user type
      if (currentUser?.user_type === 'sender') {
        navigate('/dashboard?tab=history');
      } else {
        navigate('/dashboard');
      }
    },
    onError: (error) => {
      console.error('Rating submission failed:', error);
    },
  });

  const handleStarClick = (rating: number, category?: string) => {
    if (category) {
      setCategoryRatings(prev => ({
        ...prev,
        [category]: rating
      }));
    } else {
      setOverallRating(rating);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) { // 5MB limit
        const preview = URL.createObjectURL(file);
        const newUpload: PhotoUpload = {
          file,
          preview,
          uploading: true,
        };
        
        setPhotoUploads(prev => [...prev, newUpload]);
        photoUploadMutation.mutate(file);
      }
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUploads(prev => {
      const upload = prev[index];
      if (upload?.preview) {
        URL.revokeObjectURL(upload.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (overallRating === 0) {
      alert('Please provide an overall rating');
      return;
    }

    if (!orderDetails?.courier?.uid) {
      alert('Unable to determine who to rate');
      return;
    }

    setIsSubmitting(true);

    const photoUrls = photoUploads
      .filter(upload => upload.uploaded_url)
      .map(upload => upload.uploaded_url!);

    const ratingData: RatingSubmission = {
      rated_id: orderDetails.courier.uid,
      overall_rating: overallRating,
      written_feedback: writtenFeedback.trim() || undefined,
      is_anonymous: isAnonymous,
      images: photoUrls.length > 0 ? photoUrls : undefined,
    };

    // Add category ratings if provided
    if (categoryRatings.professionalism > 0) {
      ratingData.professionalism_rating = categoryRatings.professionalism;
    }
    if (categoryRatings.speed > 0) {
      ratingData.speed_rating = categoryRatings.speed;
    }
    if (categoryRatings.communication > 0) {
      ratingData.communication_rating = categoryRatings.communication;
    }
    if (categoryRatings.package_handling > 0) {
      ratingData.package_handling_rating = categoryRatings.package_handling;
    }

    try {
      await ratingMutation.mutateAsync(ratingData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (currentRating: number, onStarClick: (rating: number) => void, size: 'sm' | 'lg' = 'sm') => {
    const starSize = size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
    
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onStarClick(star)}
            className={`${starSize} transition-colors ${
              star <= currentRating 
                ? 'text-yellow-400 hover:text-yellow-500' 
                : 'text-gray-300 hover:text-yellow-300'
            }`}
          >
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    );
  };

  const getRatingLabel = (rating: number) => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    return labels[rating] || '';
  };

  const categoryLabels = {
    speed: 'Delivery Speed',
    communication: 'Communication',
    professionalism: 'Professionalism', 
    package_handling: 'Package Handling',
  };

  const handleIssueToggle = (issue: string) => {
    setSelectedIssues(prev => 
      prev.includes(issue) 
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  const formatAddress = (address: any) => {
    if (typeof address === 'string') return address;
    return `${address.street_address}, ${address.city}, ${address.state}`;
  };

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to rate this delivery</p>
          <Link to="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (orderError || !orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Unable to load order details</p>
          <Link to="/dashboard" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isUserSender = currentUser?.uid === orderDetails.sender_id;
  const isUserCourier = currentUser?.uid === orderDetails.courier.uid;

  if (!isUserSender && !isUserCourier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">You don't have permission to rate this delivery</p>
          <Link to="/dashboard" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Rate Your Delivery Experience</h1>
              <Link 
                to={isUserSender ? "/dashboard?tab=history" : "/dashboard"}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            </div>
            
            {/* Order Context */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Order #{orderDetails.order_number}</p>
                  <p className="font-medium">{formatAddress(orderDetails.pickup_address)}</p>
                  <p className="text-gray-600">to</p>
                  <p className="font-medium">{formatAddress(orderDetails.delivery_address)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="font-medium">{new Date(orderDetails.actual_delivery_time).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600">
                    Total: ${orderDetails.total_amount}
                  </p>
                </div>
              </div>
              
              {/* Participant Info */}
              <div className="mt-4 flex items-center gap-4">
                {isUserSender ? (
                  <div>
                    <img 
                      src={orderDetails.courier.profile_image_url || `https://picsum.photos/40/40?random=${orderDetails.courier.uid}`}
                      alt={`${orderDetails.courier.first_name} ${orderDetails.courier.last_name}`}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium">Your Courier: {orderDetails.courier.first_name} {orderDetails.courier.last_name}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {renderStars(Math.round(courierProfile?.average_rating || 0), () => {}, 'sm')}
                        </div>
                        <span className="text-sm text-gray-600">({courierProfile?.average_rating || 0}/5.0)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Rate your delivery experience</p>
                    <p className="text-sm text-gray-600">Your feedback helps improve our service</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rating Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Overall Rating */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Overall Experience</h2>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  {renderStars(overallRating, setOverallRating, 'lg')}
                </div>
                <p className="text-lg font-medium text-gray-700">{getRatingLabel(overallRating)}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {isUserSender ? 'How would you rate your overall delivery experience?' : 'How would you rate this sender?'}
                </p>
              </div>
            </div>

            {/* Category Ratings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Detailed Ratings</h2>
              <div className="space-y-4">
                {Object.entries(categoryLabels).map(([category, label]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{label}</span>
                    <div className="flex items-center gap-3">
                      {renderStars(categoryRatings[category as keyof typeof categoryRatings], (rating) => handleStarClick(rating, category))}
                      <span className="text-sm text-gray-500 w-16">{getRatingLabel(categoryRatings[category as keyof typeof categoryRatings])}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Written Feedback */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Written Feedback</h2>
              <textarea
                value={writtenFeedback}
                onChange={(e) => setWrittenFeedback(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={isUserSender ? "Share details about your delivery experience..." : "Share details about this sender..."}
              />
              <div className="flex justify-between mt-2">
                <p className="text-sm text-gray-500">
                  Help others by sharing your experience
                </p>
                <p className="text-sm text-gray-500">
                  {writtenFeedback.length}/500
                </p>
              </div>
            </div>

            {/* Issue Reporting */}
            {overallRating <= 3 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">What went wrong?</h2>
                <p className="text-sm text-gray-600 mb-4">Select all that apply to help us improve:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {issueTypes.map(issue => (
                    <label key={issue} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIssues.includes(issue)}
                        onChange={() => handleIssueToggle(issue)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{issue}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Photo Upload */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Add Photos (Optional)</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload photos to document service issues or recognize exceptional service
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB each</p>
                </label>
              </div>

              {/* Photo Previews */}
              {photoUploads.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {photoUploads.map((upload, index) => (
                    <div key={index} className="relative">
                      <img
                        src={upload.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      {upload.uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        </div>
                      )}
                      {!upload.uploading && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Options */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Privacy Settings</h2>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Submit feedback anonymously (your name won't be shown to other users)
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={overallRating === 0 || isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Submitting...
                    </div>
                  ) : (
                    'Submit Rating'
                  )}
                </button>
                <Link
                  to={isUserSender ? "/dashboard?tab=history" : "/dashboard"}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Skip for Now
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                You can edit your rating within 24 hours of submission
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_RatingReview;