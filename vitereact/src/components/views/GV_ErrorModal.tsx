import React, { useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// Error type definitions based on the global state schema
interface ApplicationError {
  errorId: string;
  errorType: string;
  message: string;
  timestamp: string;
  context?: any;
}

interface ModalMessage {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actions: Array<{
    label: string;
    action: string;
  }>;
}

interface ErrorSeverityConfig {
  icon: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
}

const GV_ErrorModal: React.FC = () => {
  const [retryLoading, setRetryLoading] = useState(false);
  const [autoRetryAttempts, setAutoRetryAttempts] = useState(0);
  
  // Access global error state and actions
  const { errorHandlingState, clearCurrentError, clearModalMessage, retryFailedRequest } = useAppStore();
  const { currentErrors, errorReportingEnabled } = errorHandlingState.errorTracking;
  const { modalMessages } = errorHandlingState.userFeedback;
  const { apiConnectivity, maintenanceMode } = errorHandlingState.systemStatus;

  // Get the current error to display (prioritize modal messages, then current errors)
  const currentModalMessage = modalMessages.length > 0 ? modalMessages[0] : null;
  const currentError = currentErrors.length > 0 ? currentErrors[0] : null;
  const hasError = currentModalMessage || currentError;

  // Define error severity configurations
  const errorSeverityConfig: Record<string, ErrorSeverityConfig> = {
    error: {
      icon: '⚠️',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      textColor: 'text-red-800'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-800'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-800'
    }
  };

  // Get error type and configuration
  const getErrorTypeConfig = (error: ApplicationError | ModalMessage) => {
    if ('type' in error) {
      return errorSeverityConfig[error.type] || errorSeverityConfig.error;
    }
    
    // Determine severity based on error type for ApplicationError
    const errorType = error.errorType.toLowerCase();
    if (errorType.includes('network') || errorType.includes('timeout') || errorType.includes('connection')) {
      return errorSeverityConfig.error;
    } else if (errorType.includes('validation') || errorType.includes('permission')) {
      return errorSeverityConfig.warning;
    } else {
      return errorSeverityConfig.info;
    }
  };

  // Check if error is transient and should be auto-retried
  const isTransientError = (error: ApplicationError): boolean => {
    const transientTypes = ['network_timeout', 'connection_lost', 'server_unavailable'];
    return transientTypes.includes(error.errorType);
  };

  // Handle automatic retry
  const handleAutoRetry = useCallback(async () => {
    if (!currentError) return;
    
    setAutoRetryAttempts(prev => prev + 1);
    try {
      await retryFailedRequest(currentError.errorId);
      setAutoRetryAttempts(0);
    } catch (error) {
      // Auto-retry failed, user will need to manually retry or dismiss
      console.error('Auto-retry failed:', error);
    }
  }, [currentError, retryFailedRequest]);

  // Auto-retry logic for transient failures
  useEffect(() => {
    if (currentError && isTransientError(currentError) && autoRetryAttempts < 3) {
      const retryTimer = setTimeout(() => {
        handleAutoRetry();
      }, 2000 * Math.pow(2, autoRetryAttempts)); // Exponential backoff

      return () => clearTimeout(retryTimer);
    }
  }, [currentError, autoRetryAttempts, handleAutoRetry]);

  // Handle manual retry
  const handleManualRetry = useCallback(async () => {
    if (!currentError) return;
    
    setRetryLoading(true);
    try {
      await retryFailedRequest(currentError.errorId);
      setAutoRetryAttempts(0);
    } catch (error) {
      // Manual retry failed, show error
      console.error('Manual retry failed:', error);
    } finally {
      setRetryLoading(false);
    }
  }, [currentError, retryFailedRequest]);

  // Handle modal dismissal
  const handleDismiss = useCallback(() => {
    try {
      if (currentModalMessage) {
        clearModalMessage(currentModalMessage.id);
      } else if (currentError) {
        clearCurrentError(currentError.errorId);
      }
      setAutoRetryAttempts(0);
    } catch (error) {
      console.error('Error dismissing modal:', error);
    }
  }, [currentModalMessage, currentError, clearModalMessage, clearCurrentError]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  }, [handleDismiss]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleDismiss();
    }
  }, [handleDismiss]);

  // Get user-friendly error message
  const getUserFriendlyMessage = (error: ApplicationError | ModalMessage): string => {
    if ('message' in error && error.message) {
      return error.message;
    }

    const errorType = 'errorType' in error ? error.errorType : 'unknown';
    
    const friendlyMessages: Record<string, string> = {
      network_timeout: "We're having trouble connecting to our servers. Please check your internet connection and try again.",
      connection_lost: "Your connection was interrupted. We'll try to reconnect automatically.",
      validation_error: "Please check the information you entered and try again.",
      authentication_failed: "Your session has expired. Please log in again to continue.",
      permission_denied: "You don't have permission to perform this action.",
      payment_failed: "We couldn't process your payment. Please check your payment details and try again.",
      service_unavailable: "This feature is temporarily unavailable. Please try again later.",
      maintenance_mode: "We're performing maintenance to improve your experience. Please try again shortly."
    };

    return friendlyMessages[errorType] || "Something went wrong. Please try again or contact support if the problem persists.";
  };

  // Get suggested actions based on error type
  const getSuggestedActions = (error: ApplicationError | ModalMessage): string[] => {
    const errorType = 'errorType' in error ? error.errorType : ('type' in error ? error.type : 'unknown');
    
    const actionSuggestions: Record<string, string[]> = {
      network_timeout: [
        "Check your internet connection",
        "Try refreshing the page",
        "Wait a moment and try again"
      ],
      validation_error: [
        "Review the highlighted fields",
        "Ensure all required information is provided",
        "Check for any formatting requirements"
      ],
      authentication_failed: [
        "Log in again to continue",
        "Clear your browser cache if problems persist"
      ],
      payment_failed: [
        "Verify your payment information",
        "Try a different payment method",
        "Contact your bank if the issue continues"
      ],
      service_unavailable: [
        "Try again in a few minutes",
        "Check our status page for updates"
      ]
    };

    return actionSuggestions[errorType] || [
      "Try refreshing the page",
      "Contact support if the problem continues"
    ];
  };

  // Don't render if no errors
  if (!hasError) {
    return null;
  }

  const displayError = currentModalMessage || currentError!;
  const errorConfig = getErrorTypeConfig(displayError);
  const title = 'title' in displayError ? displayError.title : 'Error';
  const message = getUserFriendlyMessage(displayError);
  const suggestions = getSuggestedActions(displayError);
  const canRetry = currentError && (isTransientError(currentError) || apiConnectivity === 'online');

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
        aria-describedby="error-modal-description"
      >
        {/* Modal Content */}
        <div
          className={`
            ${errorConfig.bgColor} ${errorConfig.borderColor}
            border-2 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto
            transform transition-all duration-200 ease-out
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="flex items-center space-x-3">
              <div className={`text-2xl ${errorConfig.iconColor}`} aria-hidden="true">
                {errorConfig.icon}
              </div>
              <h2
                id="error-modal-title"
                className={`text-lg font-semibold ${errorConfig.textColor}`}
              >
                {title}
              </h2>
            </div>
            <button
              onClick={handleDismiss}
              className={`
                ${errorConfig.textColor} hover:bg-black hover:bg-opacity-10
                rounded-full p-1 transition-colors duration-200
              `}
              aria-label="Close error dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error Message */}
          <div className="px-6 pb-4">
            <p
              id="error-modal-description"
              className={`${errorConfig.textColor} text-sm leading-relaxed`}
            >
              {message}
            </p>
          </div>

          {/* Auto-retry indicator */}
          {currentError && isTransientError(currentError) && autoRetryAttempts > 0 && autoRetryAttempts < 3 && (
            <div className="px-6 pb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Retrying automatically... (Attempt {autoRetryAttempts}/3)</span>
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {suggestions.length > 0 && (
            <div className="px-6 pb-4">
              <h3 className={`text-sm font-medium ${errorConfig.textColor} mb-2`}>
                What you can do:
              </h3>
              <ul className={`text-sm ${errorConfig.textColor} space-y-1`}>
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-xs mt-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* System Status Information */}
          {(apiConnectivity !== 'online' || maintenanceMode) && (
            <div className="px-6 pb-4">
              <div className="bg-gray-100 rounded-md p-3">
                <h4 className="text-sm font-medium text-gray-800 mb-1">System Status</h4>
                {apiConnectivity !== 'online' && (
                  <p className="text-xs text-gray-600">
                    Connection: {apiConnectivity === 'offline' ? 'Offline' : 'Limited'}
                  </p>
                )}
                {maintenanceMode && (
                  <p className="text-xs text-gray-600">
                    Maintenance mode is active
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
            {canRetry && (
              <button
                onClick={handleManualRetry}
                disabled={retryLoading}
                className={`
                  flex-1 px-4 py-2 bg-blue-600 text-white rounded-md
                  hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-200
                  ${retryLoading ? 'cursor-wait' : ''}
                `}
              >
                {retryLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Retrying...</span>
                  </span>
                ) : (
                  'Try Again'
                )}
              </button>
            )}

            <Link
              to="/support"
              onClick={handleDismiss}
              className={`
                flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md
                hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors duration-200 text-center
              `}
            >
              Get Help
            </Link>

            <button
              onClick={handleDismiss}
              className={`
                flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-md
                hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                transition-colors duration-200
              `}
            >
              Dismiss
            </button>
          </div>

          {/* Error Reporting Notice */}
          {errorReportingEnabled && currentError && (
            <div className="px-6 pb-4 border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500">
                This error has been automatically reported to help us improve our service.
                Error ID: {currentError.errorId}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GV_ErrorModal;