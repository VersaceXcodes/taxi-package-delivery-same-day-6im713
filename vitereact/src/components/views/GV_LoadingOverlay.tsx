import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/main';

// Loading component interfaces
interface LoadingOverlayProps {
  className?: string;
}

interface ComponentLoadingState {
  componentId: string;
  loading: boolean;
}

// Main GV_LoadingOverlay component
const GV_LoadingOverlay: React.FC<LoadingOverlayProps> = ({ className = '' }) => {
  const { loadingStates, userInterfaceSettings } = useAppStore(state => ({
    loadingStates: state.errorHandlingState?.loadingStates || {
      globalLoading: false,
      pageLoading: false,
      componentLoading: []
    },
    userInterfaceSettings: state.applicationConfigurationState?.userInterfaceSettings || {
      reducedMotion: false
    }
  }));

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  // Simulate progress for page loading
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let timeout: NodeJS.Timeout | null = null;

    if (loadingStates.pageLoading || loadingStates.globalLoading) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);

      timeout = setTimeout(() => {
        setLoadingProgress(100);
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [loadingStates.pageLoading, loadingStates.globalLoading]);

  // Update loading messages
  useEffect(() => {
    if (loadingStates.globalLoading) {
      setLoadingMessage('Initializing QuickCourier...');
    } else if (loadingStates.pageLoading) {
      setLoadingMessage('Loading page...');
    } else {
      setLoadingMessage('Loading...');
    }
  }, [loadingStates.globalLoading, loadingStates.pageLoading]);

  // Get component-specific loading states with proper type checking
  const componentLoadingStates: ComponentLoadingState[] = Array.isArray(loadingStates.componentLoading) 
    ? loadingStates.componentLoading 
    : [];
  const hasComponentLoading = componentLoadingStates.length > 0 && componentLoadingStates.some(item => item.loading);

  // Check if any loading state is active
  const isAnyLoading = loadingStates.globalLoading || loadingStates.pageLoading || hasComponentLoading;

  // Safe access to reducedMotion setting
  const reducedMotion = userInterfaceSettings?.reducedMotion || false;

  return (
    <>
      {/* Full Screen Loading Overlay for Global/Page Loading */}
      {(loadingStates.globalLoading || loadingStates.pageLoading) && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity duration-300 ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loading-title"
          aria-describedby="loading-description"
        >
          <div className="flex flex-col items-center space-y-6 max-w-sm mx-auto px-4">
            {/* Animated QuickCourier Logo */}
            <div className="relative">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center shadow-lg ${!reducedMotion ? 'animate-pulse' : ''}`}>
                <svg 
                  className="w-8 h-8 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 10V3L4 14h7v7l9-11h-7z" 
                  />
                </svg>
              </div>
              
              {/* Spinning Ring Animation */}
              {!reducedMotion && (
                <div className="absolute inset-0 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin"></div>
              )}
            </div>

            {/* Loading Title */}
            <h2 id="loading-title" className="text-xl font-semibold text-gray-900 text-center">
              QuickCourier
            </h2>

            {/* Loading Message */}
            <p id="loading-description" className="text-gray-600 text-center">
              {loadingMessage}
            </p>

            {/* Progress Bar */}
            {loadingStates.pageLoading && (
              <div className="w-full max-w-xs">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out ${!reducedMotion ? 'animate-pulse' : ''}`}
                    style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(loadingProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Loading progress"
                  ></div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  {Math.round(loadingProgress)}% complete
                </p>
              </div>
            )}

            {/* Loading Dots Animation */}
            {!reducedMotion && (
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}
          </div>

          {/* Screen Reader Live Region */}
          <div 
            className="sr-only" 
            aria-live="polite" 
            aria-atomic="true"
          >
            {loadingMessage} {loadingStates.pageLoading && `${Math.round(loadingProgress)}% complete`}
          </div>
        </div>
      )}

      {/* Component-Specific Loading Indicators */}
      {hasComponentLoading && !loadingStates.globalLoading && !loadingStates.pageLoading && (
        <div className="fixed top-4 right-4 z-40 space-y-2">
          {componentLoadingStates
            .filter(item => item.loading)
            .map((item: ComponentLoadingState) => (
              <div
                key={item.componentId}
                className={`bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex items-center space-x-3 max-w-sm transform transition-all duration-300 ${!reducedMotion ? 'translate-x-0 opacity-100' : ''}`}
                role="status"
                aria-label={`Loading ${item.componentId}`}
              >
                {/* Mini Spinner */}
                <div className={`w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full ${!reducedMotion ? 'animate-spin' : ''}`}></div>
                
                {/* Loading Text */}
                <span className="text-sm text-gray-700 font-medium">
                  Loading {item.componentId.replace(/_/g, ' ')}...
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Background Sync Notification Bar */}
      {!isAnyLoading && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
          {/* This would show when background sync is happening */}
          {/* For now, it's hidden but structure is ready */}
        </div>
      )}
    </>
  );
};

export default GV_LoadingOverlay;