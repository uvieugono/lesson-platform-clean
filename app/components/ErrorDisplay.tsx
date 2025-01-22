import React from 'react';

interface ErrorDisplayProps {
  error: Error;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  return (
    <div className="text-center p-6 bg-red-50 rounded-xl">
      <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
      <p className="text-red-600 mb-4">
        {error?.message || 'An error occurred while loading the lesson'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    </div>
  );
};

export default ErrorDisplay;