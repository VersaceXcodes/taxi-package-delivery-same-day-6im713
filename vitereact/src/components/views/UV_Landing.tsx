import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Type definitions
interface PlatformStatistics {
  total_deliveries: number;
  average_delivery_time: string;
  customer_satisfaction: number;
  active_couriers: number;
}

interface CustomerTestimonial {
  id: string;
  customer_name: string;
  customer_image: string;
  rating: number;
  review_text: string;
  delivery_details: string;
  date: string;
}

interface ServiceArea {
  id: string;
  name: string;
  coverage_zones: string[];
  is_active: boolean;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface PricingCalculation {
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

// Mock data functions (replacing non-existent API endpoints)
const getMockStatistics = (): PlatformStatistics => ({
  total_deliveries: 50000,
  average_delivery_time: '2.5 hrs',
  customer_satisfaction: 4.8,
  active_couriers: 2500
});

const getMockTestimonials = (): CustomerTestimonial[] => [
  {
    id: '1',
    customer_name: 'Sarah Johnson',
    customer_image: 'https://picsum.photos/50/50?random=1',
    rating: 5,
    review_text: 'Incredibly fast delivery! My package arrived within 2 hours.',
    delivery_details: 'Downtown to Midtown - Electronics',
    date: '2024-01-15'
  },
  {
    id: '2', 
    customer_name: 'Mike Chen',
    customer_image: 'https://picsum.photos/50/50?random=2',
    rating: 5,
    review_text: 'Professional courier and great communication throughout.',
    delivery_details: 'Westside to Airport - Documents',
    date: '2024-01-14'
  },
  {
    id: '3',
    customer_name: 'Emily Rodriguez',
    customer_image: 'https://picsum.photos/50/50?random=3', 
    rating: 4,
    review_text: 'Reliable service, will definitely use again.',
    delivery_details: 'North End to South Bay - Package',
    date: '2024-01-13'
  }
];

const getMockServiceAreas = (): ServiceArea[] => [
  {
    id: '1',
    name: 'Downtown Metro',
    coverage_zones: ['Downtown', 'Financial District', 'Arts Quarter'],
    is_active: true
  },
  {
    id: '2',
    name: 'Westside',
    coverage_zones: ['West Hollywood', 'Beverly Hills', 'Santa Monica'],
    is_active: true
  },
  {
    id: '3',
    name: 'San Fernando Valley',
    coverage_zones: ['Sherman Oaks', 'Studio City', 'North Hollywood'],
    is_active: false
  }
];

const getMockFAQs = (): FAQItem[] => [
  {
    id: '1',
    question: 'How fast can my package be delivered?',
    answer: 'We offer same-day delivery with options ranging from 30 minutes to 4 hours depending on your needs and location.',
    category: 'delivery'
  },
  {
    id: '2',
    question: 'What types of packages can you deliver?',
    answer: 'We can deliver documents, electronics, food, clothing, and most personal items. Packages must be under 50 lbs and fit in a standard vehicle.',
    category: 'packages'
  },
  {
    id: '3',
    question: 'How much does delivery cost?',
    answer: 'Pricing starts at $8 for local deliveries and varies based on distance, package size, and delivery speed. Get an instant quote with our calculator.',
    category: 'pricing'
  },
  {
    id: '4',
    question: 'Are my packages insured?',
    answer: 'Yes, all deliveries are covered by insurance up to $1,000. Additional coverage is available for high-value items.',
    category: 'insurance'
  }
];

// API function for pricing (using correct endpoint)
const calculatePricing = async (distance: number, urgency: string): Promise<PricingCalculation> => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/pricing/estimate`, {
      pickup_address: {
        latitude: 34.0522,
        longitude: -118.2437
      },
      delivery_address: {
        latitude: 34.0522 + (distance * 0.01),
        longitude: -118.2437 + (distance * 0.01)
      },
      package: {
        size_category: 'medium',
        estimated_weight: 2.0,
        is_fragile: false
      },
      urgency_level: urgency === 'asap' ? 'asap' : urgency === 'express' ? '1_hour' : '2_hours'
    });
    
    return response.data.data;
  } catch (error) {
    // Fallback to mock data if API fails
    return {
      base_price: 8.00,
      urgency_premium: urgency === 'asap' ? 5.00 : urgency === 'express' ? 3.00 : 0.00,
      size_premium: 2.00,
      special_handling_fee: 0.00,
      service_fee: 1.50,
      tax_amount: 1.25,
      total_amount: 12.50 + (urgency === 'asap' ? 5.00 : urgency === 'express' ? 3.00 : 0.00),
      estimated_pickup_time: new Date(Date.now() + (urgency === 'asap' ? 30 : urgency === 'express' ? 60 : 120) * 60000).toISOString(),
      estimated_delivery_time: new Date(Date.now() + (urgency === 'asap' ? 90 : urgency === 'express' ? 150 : 240) * 60000).toISOString()
    };
  }
};

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authenticationState } = useAppStore();
  
  // Local state for pricing calculator
  const [calculatorDistance, setCalculatorDistance] = useState(2);
  const [calculatorUrgency, setCalculatorUrgency] = useState('standard');
  const [showExitIntent, setShowExitIntent] = useState(false);

  // URL parameters
  const referralCode = searchParams.get('ref');
  const utmSource = searchParams.get('utm_source');
  const promoCode = searchParams.get('promo');

  // Mock data queries (replacing non-existent APIs)
  const statistics = getMockStatistics();
  const testimonials = getMockTestimonials();
  const serviceAreas = getMockServiceAreas();
  const faqs = getMockFAQs();

  // Pricing calculation query with error handling
  const { data: pricingData, isLoading: pricingLoading, error: pricingError } = useQuery<PricingCalculation, Error>({
    queryKey: ['pricingCalculation', calculatorDistance, calculatorUrgency],
    queryFn: () => calculatePricing(calculatorDistance, calculatorUrgency),
    retry: 1,
    staleTime: 30000 // Cache for 30 seconds
  });

  // Redirect authenticated users to their dashboard with proper null checks
  useEffect(() => {
    if (authenticationState.isAuthenticated && 
        authenticationState.currentUser && 
        authenticationState.currentUser.user_type) {
      navigate('/dashboard');
    }
  }, [authenticationState.isAuthenticated, authenticationState.currentUser, navigate]);

  // Exit intent detection
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setShowExitIntent(true);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  const buildRegistrationUrl = (type: 'sender' | 'courier') => {
    const params = new URLSearchParams();
    if (referralCode) params.append('ref', referralCode);
    if (promoCode) params.append('promo', promoCode);
    
    const queryString = params.toString();
    return `/register/${type}${queryString ? `?${queryString}` : ''}`;
  };

  const formatEstimatedTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMinutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60));
      
      if (diffMinutes < 60) {
        return `${diffMinutes} minutes`;
      } else {
        const hours = Math.floor(diffMinutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      }
    } catch {
      return '2-3 hours';
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('https://picsum.photos/1920/1080?random=1')` }}></div>
        
        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Same-Day Delivery Made Simple
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Connect with trusted couriers for fast, reliable delivery across the city. 
              Your package delivered within hours, not days.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link 
                to={buildRegistrationUrl('sender')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors duration-300 w-full sm:w-auto"
              >
                Send a Package
              </Link>
              <Link 
                to={buildRegistrationUrl('courier')}
                className="bg-transparent border-2 border-white hover:bg-white hover:text-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors duration-300 w-full sm:w-auto"
              >
                Become a Courier
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <span className="text-blue-100">1-4 Hour Delivery</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <span className="text-blue-100">Fully Insured</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <span className="text-blue-100">Background Checked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Statistics */}
      <section className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {statistics?.total_deliveries?.toLocaleString() || '50K+'}
              </div>
              <div className="text-gray-600">Deliveries Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {statistics?.average_delivery_time || '2.5 hrs'}
              </div>
              <div className="text-gray-600">Average Delivery Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {`${statistics?.customer_satisfaction || 4.8}/5`}
              </div>
              <div className="text-gray-600">Customer Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {`${statistics?.active_couriers || 2500}+`}
              </div>
              <div className="text-gray-600">Active Couriers</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple, fast, and reliable. Get your package delivered in three easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Request Delivery</h3>
              <p className="text-gray-600">
                Enter pickup and delivery addresses, package details, and choose your delivery speed.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Get Matched</h3>
              <p className="text-gray-600">
                We instantly connect you with the best available courier in your area.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Track & Receive</h3>
              <p className="text-gray-600">
                Follow your package in real-time and receive notifications at every step.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Pricing Calculator */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Calculate Your Delivery Cost</h2>
              <p className="text-xl text-gray-600">
                Get an instant quote for your same-day delivery.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distance (miles)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={calculatorDistance}
                    onChange={(e) => setCalculatorDistance(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="text-center text-sm text-gray-500 mt-1">
                    {calculatorDistance} miles
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Speed
                  </label>
                  <select
                    value={calculatorUrgency}
                    onChange={(e) => setCalculatorUrgency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="standard">Standard (2-4 hours)</option>
                    <option value="express">Express (1-2 hours)</option>
                    <option value="asap">ASAP (30-60 minutes)</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 text-center">
                {pricingError ? (
                  <div className="text-red-600 mb-4">
                    Unable to calculate pricing. Please try again.
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {pricingLoading ? 'Calculating...' : `$${pricingData?.total_amount?.toFixed(2) || '12.50'}`}
                  </div>
                )}
                <div className="text-gray-600 mb-4">
                  Estimated delivery time: {pricingData?.estimated_delivery_time ? formatEstimatedTime(pricingData.estimated_delivery_time) : '2-3 hours'}
                </div>
                <Link
                  to={buildRegistrationUrl('sender')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
                >
                  Book This Delivery
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area Coverage */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Service Coverage</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We deliver across major metropolitan areas with expanding coverage.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-100 rounded-lg p-8 mb-8">
              <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">Service Area Map</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {serviceAreas?.map((area) => (
                <div key={area.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{area.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${area.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm text-gray-600">
                      {area.is_active ? 'Active' : 'Coming Soon'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">What Our Customers Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real feedback from thousands of satisfied customers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials?.slice(0, 6).map((testimonial) => (
              <div key={testimonial.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center mb-4">
                  <img
                    src={testimonial.customer_image || `https://picsum.photos/50/50?random=${testimonial.id}`}
                    alt={testimonial.customer_name}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-800">{testimonial.customer_name}</h4>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 mb-3">{testimonial.review_text}</p>
                <div className="text-sm text-gray-500">
                  {testimonial.delivery_details}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Trust Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Your Security is Our Priority</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Every delivery is protected with comprehensive insurance and verified couriers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🛡️</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Package Insurance</h3>
              <p className="text-gray-600 text-sm">Up to $1000 coverage for all deliveries</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Background Checks</h3>
              <p className="text-gray-600 text-sm">All couriers are verified and screened</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-gray-600 text-sm">Monitor your package every step of the way</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Payments</h3>
              <p className="text-gray-600 text-sm">Bank-level encryption for all transactions</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get answers to common questions about our delivery service.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="space-y-4">
              {faqs?.slice(0, 8).map((faq) => (
                <div key={faq.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      {faq.question}
                    </h3>
                    <p className="text-gray-600">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App Promotion */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get the QuickCourier App</h2>
            <p className="text-xl text-blue-100 mb-8">
              Manage your deliveries on the go with our mobile app. Available on iOS and Android.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <a
                href="#"
                className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg flex items-center gap-3 transition-colors duration-300"
              >
                <span className="text-2xl">📱</span>
                <div className="text-left">
                  <div className="text-xs text-gray-300">Download on the</div>
                  <div className="text-sm font-semibold">App Store</div>
                </div>
              </a>
              <a
                href="#"
                className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg flex items-center gap-3 transition-colors duration-300"
              >
                <span className="text-2xl">🤖</span>
                <div className="text-left">
                  <div className="text-xs text-gray-300">Get it on</div>
                  <div className="text-sm font-semibold">Google Play</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-8 md:p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Send Your Package?</h2>
            <p className="text-xl mb-8 text-orange-100">
              Join thousands of satisfied customers who trust QuickCourier for their delivery needs.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to={buildRegistrationUrl('sender')}
                className="bg-white hover:bg-gray-100 text-orange-600 px-8 py-4 rounded-lg text-lg font-semibold transition-colors duration-300 w-full sm:w-auto"
              >
                Send a Package Now
              </Link>
              <Link
                to={buildRegistrationUrl('courier')}
                className="bg-transparent border-2 border-white hover:bg-white hover:text-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors duration-300 w-full sm:w-auto"
              >
                Earn as a Courier
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Exit Intent Popup */}
      {showExitIntent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Wait! Don't Leave Yet</h3>
              <p className="text-gray-600 mb-6">
                Get 20% off your first delivery with code WELCOME20
              </p>
              <div className="flex gap-4">
                <Link
                  to={buildRegistrationUrl('sender')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300 flex-1"
                >
                  Claim Discount
                </Link>
                <button
                  type="button"
                  onClick={() => setShowExitIntent(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Chat Widget */}
      <div className="fixed bottom-6 right-6 z-40">
        <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-colors duration-300">
          <span className="text-xl">💬</span>
        </button>
      </div>
    </>
  );
};

export default UV_Landing;