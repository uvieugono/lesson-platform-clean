import { AxiosError } from 'axios';

// File: utils/error-utils.ts
export const showErrorToast = (error: Error): void => {
  // This function can be implemented with your preferred toast library
  console.error('Error:', error.message);
  // Example with a toast library:
  // toast.error(error.message);
};

export function handleAxiosError(error: any): string {
  if (error.response) {
    return `Error: ${error.response.status}: ${error.response.data.message || 'Unknown error occurred'}`;
  } else if (error.request) {
    return 'Error: No response received from server';
  }
  return `Error: ${error.message}`;
}