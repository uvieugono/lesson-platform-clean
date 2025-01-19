import React from 'react';
import { showErrorToast } from '../utils/error-utils'; // Adjusted path

const ErrorDisplay: React.FC<{ error: Error | null; onRetry?: () => void }> = ({ error, onRetry }) => {
  if (!error) return null;

  return (
    <div className="error">
      <p>Error: {error.message}</p>
      {onRetry && (
        <button onClick={onRetry}>Retry</button>
      )}
    </div>
  );
};

export default ErrorDisplay;