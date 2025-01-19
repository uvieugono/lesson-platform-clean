import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://lesson-manager-914922463191.us-central1.run.app';

// Create custom axios instance with retry logic
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // Increased timeout
  headers: {
    'Content-Type': 'application/json',
    // Add CORS headers
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Add any authentication tokens here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we haven't tried retrying yet and it's a retryable error
    if (!originalRequest._retry && isRetryableError(error)) {
      originalRequest._retry = true;
      
      try {
        // Wait for 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await axiosInstance(originalRequest);
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        throw handleAxiosError(retryError);
      }
    }

    throw handleAxiosError(error);
  }
);

// Helper functions
function isRetryableError(error) {
  return (
    !error.response || // Network errors
    error.response.status === 408 || // Request timeout
    error.response.status === 429 || // Too many requests
    (error.response.status >= 500 && error.response.status <= 599) // Server errors
  );
}

function handleAxiosError(error) {
  if (!error.response) {
    // Network error
    return new Error('Network error - Please check your internet connection');
  }

  switch (error.response.status) {
    case 401:
      return new Error('Session expired - Please log in again');
    case 403:
      return new Error('Access denied - You do not have permission');
    case 404:
      return new Error('Resource not found');
    case 429:
      return new Error('Too many requests - Please try again later');
    case 500:
      return new Error('Server error - Please try again later');
    default:
      return new Error(error.response?.data?.message || 'An unexpected error occurred');
  }
}

// API endpoints
export const api = {
  initializeLesson: async (studentId: string, lessonPath: string) => {
    try {
      const response = await axiosInstance.post('/initialize-lesson', {
        student_id: studentId,
        lesson_path: lessonPath,
      });
      return response.data;
    } catch (error) {
      console.error('Initialize lesson error:', error);
      throw error;
    }
  },

  pauseLesson: async (sessionId: string, reason: string) => {
    try {
      const response = await axiosInstance.post('/pause-lesson', {
        session_id: sessionId,
        reason,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('Pause lesson error:', error);
      throw error;
    }
  },

  // Add other API methods similarly
};

export default axiosInstance;