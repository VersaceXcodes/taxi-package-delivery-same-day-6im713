import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { 
  ChevronDownIcon, 
  ChevronUpIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  MapPinIcon,
  ClockIcon,
  ShieldCheckIcon,
  StarIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

const GV_Footer: React.FC = () => {
  const { authenticationState } = useAppStore();
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const toggleMobileSection = (section: string) => {
    setMobileSection(mobileSection === section ? null : section);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    console.log('Newsletter subscription:', email);
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="bg-gray-900 text-white">
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Service Status Bar */}
          <div className="border-b border-gray-800 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>All Services Operational</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ClockIcon className="w-4 h-4" />
                  <span>Delivering: 6AM - 11PM Daily</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <PhoneIcon className="w-4 h-4" />
                  <span className="text-sm">Emergency: +1 (555) 911-RUSH</span>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Live Chat
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Footer Content */}
          <div className="hidden md:block py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              {/* Company Information */}
              <div className="lg:col-span-1">
                <div className="mb-6">
                  <Link to="/" className="text-2xl font-bold text-blue-400">
                    QuickCourier
                  </Link>
                  <p className="mt-2 text-gray-400 text-sm">
                    Reliable same-day delivery service connecting you with trusted local couriers.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPinIcon className="w-4 h-4 text-gray-400" />
                    <span>Service Areas: NYC, SF, LA, Chicago</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <StarIcon className="w-4 h-4 text-yellow-400" />
                    <span>4.8/5 Average Rating (12,450+ reviews)</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <ShieldCheckIcon className="w-4 h-4 text-green-400" />
                    <span>$1M Insurance Coverage</span>
                  </div>
                </div>
              </div>

              {/* Service Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Services</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Same-Day Delivery</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Express Delivery</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Scheduled Delivery</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Business Solutions</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Coverage Areas</Link></li>
                  <li><Link to="/support" className="text-gray-400 hover:text-white transition-colors">FAQ</Link></li>
                </ul>
              </div>

              {/* Business & Partnership */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Business</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">About Us</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">How It Works</Link></li>
                  <li><Link to="/register/courier" className="text-gray-400 hover:text-white transition-colors">Become a Courier</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Partner with Us</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Careers</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">API Documentation</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Press Kit</Link></li>
                </ul>
              </div>

              {/* Support & Legal */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Support & Legal</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/support" className="text-gray-400 hover:text-white transition-colors">Help Center</Link></li>
                  <li><Link to="/support" className="text-gray-400 hover:text-white transition-colors">Contact Support</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Track Package</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Insurance Policy</Link></li>
                  <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Accessibility</Link></li>
                </ul>
              </div>

              {/* Contact & Apps */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Connect</h3>
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <PhoneIcon className="w-4 h-4" />
                      <span>+1 (555) 123-QUICK</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <EnvelopeIcon className="w-4 h-4" />
                      <span>support@quickcourier.com</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ChatBubbleLeftRightIcon className="w-4 h-4" />
                      <span>24/7 Live Chat</span>
                    </div>
                  </div>
                  
                  {/* Social Media */}
                  <div>
                    <h4 className="font-medium mb-2">Follow Us</h4>
                    <div className="flex space-x-3">
                      <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                        <span className="sr-only">Facebook</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" clipRule="evenodd" />
                        </svg>
                      </a>
                      <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                        <span className="sr-only">Twitter</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                        </svg>
                      </a>
                      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                        <span className="sr-only">Instagram</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                        </svg>
                      </a>
                      <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                        <span className="sr-only">LinkedIn</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  {/* Mobile Apps */}
                  <div>
                    <h4 className="font-medium mb-2">Download Our App</h4>
                    <div className="space-y-2">
                      <a href="https://apps.apple.com/quickcourier" target="_blank" rel="noopener noreferrer" className="block">
                        <img src="https://picsum.photos/seed/appstore/120/40" alt="Download on App Store" className="h-10" />
                      </a>
                      <a href="https://play.google.com/store/apps/quickcourier" target="_blank" rel="noopener noreferrer" className="block">
                        <img src="https://picsum.photos/seed/playstore/120/40" alt="Get it on Google Play" className="h-10" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Footer Content */}
          <div className="md:hidden py-6">
            {/* Newsletter Section */}
            <div className="mb-6 pb-6 border-b border-gray-800">
              <h3 className="font-semibold mb-3">Stay Updated</h3>
              <form onSubmit={handleNewsletterSubmit} className="flex space-x-2">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  value={email}
                  onChange={handleEmailChange}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  required
                />
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Subscribe
                </button>
              </form>
              <p className="text-xs text-gray-400 mt-2">
                Get delivery updates and exclusive offers. Unsubscribe anytime.
              </p>
            </div>

            {/* Mobile Collapsible Sections */}
            <div className="space-y-4">
              {/* Services */}
              <div>
                <button 
                  onClick={() => toggleMobileSection('services')}
                  className="w-full flex justify-between items-center py-3 text-left font-medium"
                >
                  <span>Services</span>
                  {mobileSection === 'services' ? 
                    <ChevronUpIcon className="w-5 h-5" /> : 
                    <ChevronDownIcon className="w-5 h-5" />
                  }
                </button>
                {mobileSection === 'services' && (
                  <div className="pb-4 space-y-2 text-sm">
                    <Link to="/" className="block text-gray-400 py-1">Same-Day Delivery</Link>
                    <Link to="/" className="block text-gray-400 py-1">Express Delivery</Link>
                    <Link to="/" className="block text-gray-400 py-1">Scheduled Delivery</Link>
                    <Link to="/" className="block text-gray-400 py-1">Business Solutions</Link>
                    <Link to="/" className="block text-gray-400 py-1">Coverage Areas</Link>
                    <Link to="/support" className="block text-gray-400 py-1">FAQ</Link>
                  </div>
                )}
              </div>

              {/* Business */}
              <div>
                <button 
                  onClick={() => toggleMobileSection('business')}
                  className="w-full flex justify-between items-center py-3 text-left font-medium"
                >
                  <span>Business</span>
                  {mobileSection === 'business' ? 
                    <ChevronUpIcon className="w-5 h-5" /> : 
                    <ChevronDownIcon className="w-5 h-5" />
                  }
                </button>
                {mobileSection === 'business' && (
                  <div className="pb-4 space-y-2 text-sm">
                    <Link to="/" className="block text-gray-400 py-1">About Us</Link>
                    <Link to="/" className="block text-gray-400 py-1">How It Works</Link>
                    <Link to="/register/courier" className="block text-gray-400 py-1">Become a Courier</Link>
                    <Link to="/" className="block text-gray-400 py-1">Partner with Us</Link>
                    <Link to="/" className="block text-gray-400 py-1">Careers</Link>
                    <Link to="/" className="block text-gray-400 py-1">API Documentation</Link>
                  </div>
                )}
              </div>

              {/* Support */}
              <div>
                <button 
                  onClick={() => toggleMobileSection('support')}
                  className="w-full flex justify-between items-center py-3 text-left font-medium"
                >
                  <span>Support & Legal</span>
                  {mobileSection === 'support' ? 
                    <ChevronUpIcon className="w-5 h-5" /> : 
                    <ChevronDownIcon className="w-5 h-5" />
                  }
                </button>
                {mobileSection === 'support' && (
                  <div className="pb-4 space-y-2 text-sm">
                    <Link to="/support" className="block text-gray-400 py-1">Help Center</Link>
                    <Link to="/support" className="block text-gray-400 py-1">Contact Support</Link>
                    <Link to="/" className="block text-gray-400 py-1">Track Package</Link>
                    <Link to="/" className="block text-gray-400 py-1">Terms of Service</Link>
                    <Link to="/" className="block text-gray-400 py-1">Privacy Policy</Link>
                    <Link to="/" className="block text-gray-400 py-1">Insurance Policy</Link>
                    <Link to="/" className="block text-gray-400 py-1">Accessibility</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Contact Info */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <PhoneIcon className="w-4 h-4" />
                  <span>+1 (555) 123-QUICK</span>
                </div>
                <div className="flex items-center space-x-2">
                  <EnvelopeIcon className="w-4 h-4" />
                  <span>support@quickcourier.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPinIcon className="w-4 h-4" />
                  <span>NYC, SF, LA, Chicago</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Indicators & Certifications */}
          <div className="border-t border-gray-800 py-6">
            <div className="text-center mb-4">
              <h4 className="text-sm font-medium mb-3">Trusted & Secure</h4>
              <div className="flex flex-wrap justify-center items-center gap-6 text-xs text-gray-400">
                <div className="flex items-center space-x-1">
                  <ShieldCheckIcon className="w-4 h-4 text-green-400" />
                  <span>SSL Encrypted</span>
                </div>
                <div className="flex items-center space-x-1">
                  <ShieldCheckIcon className="w-4 h-4 text-blue-400" />
                  <span>$1M Insurance</span>
                </div>
                <div className="flex items-center space-x-1">
                  <StarIcon className="w-4 h-4 text-yellow-400" />
                  <span>4.8/5 Rating</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>SOC 2 Type II</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>GDPR Compliant</span>
                </div>
              </div>
            </div>
            
            {/* Partner Logos */}
            <div className="flex flex-wrap justify-center items-center gap-4 opacity-60 mb-4">
              <img src="https://picsum.photos/seed/partner1/80/30" alt="Insurance Partner" className="h-6 grayscale" />
              <img src="https://picsum.photos/seed/partner2/80/30" alt="Security Partner" className="h-6 grayscale" />
              <img src="https://picsum.photos/seed/partner3/80/30" alt="Payment Partner" className="h-6 grayscale" />
              <img src="https://picsum.photos/seed/partner4/80/30" alt="Technology Partner" className="h-6 grayscale" />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
              <div className="mb-4 md:mb-0">
                <p>&copy; {currentYear} QuickCourier, Inc. All rights reserved.</p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-end space-x-6">
                <Link to="/" className="hover:text-white transition-colors">Privacy</Link>
                <Link to="/" className="hover:text-white transition-colors">Terms</Link>
                <Link to="/" className="hover:text-white transition-colors">Cookies</Link>
                <Link to="/" className="hover:text-white transition-colors">Accessibility</Link>
                {authenticationState.currentUser?.user_type === 'sender' && (
                  <Link to="/support" className="hover:text-white transition-colors">Business Support</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;