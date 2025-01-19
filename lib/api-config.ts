// 1. Set up environment variables for API configuration
const API_CONFIG = {
    BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://lesson-manager-914922463191.us-central1.run.app',
    TIMEOUT: 15000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
  };
  
  // 2. Create enhanced axios instance with proper error handling
  import axios from 'axios';
  
  const createAxiosInstance = () => {
    const instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  
    // Add request interceptor for debugging
    instance.interceptors.request.use(
      (config) => {
        console.log(`Making ${config.method?.toUpperCase()} request to: ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );
  
    // Add response interceptor with enhanced error handling
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
  
        // Check if we should retry the request
        if (shouldRetryRequest(originalRequest)) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
          
          // Log retry attempt
          console.log(`Retrying request (${originalRequest._retryCount}/${API_CONFIG.MAX_RETRIES})`);
          
          return instance(originalRequest);
        }
  
        // Handle network errors
        if (!error.response) {
          console.error('Network Error Details:', {
            message: error.message,
            config: {
              url: originalRequest?.url,
              method: originalRequest?.method,
              baseURL: originalRequest?.baseURL
            }
          });
  
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
  
        // Handle other types of errors
        handleApiError(error);
  
        return Promise.reject(error);
      }
    );
  
    return instance;
  };
  
  // Helper functions
  const shouldRetryRequest = (config) => {
    // Don't retry if we've already retried too many times
    if (config._retryCount >= API_CONFIG.MAX_RETRIES) {
      return false;
    }
  
    // Only retry GET requests or specific POST requests
    return (
      config.method === 'get' ||
      (config.method === 'post' && config.url?.includes('initialize-lesson'))
    );
  };
  
  const handleApiError = (error) => {
    const status = error.response?.status;
    const responseData = error.response?.data;
  
    // Log detailed error information
    console.error('API Error:', {
      status,
      data: responseData,
      config: error.config,
      message: error.message
    });
  
    // Handle specific error cases
    switch (status) {
      case 400:
        throw new Error(responseData?.message || 'Invalid request. Please check your input.');
      case 401:
        throw new Error('Session expired. Please log in again.');
      case 403:
        throw new Error('You do not have permission to perform this action.');
      case 404:
        throw new Error('The requested resource was not found.');
      case 429:
        throw new Error('Too many requests. Please try again later.');
      case 500:
        throw new Error('Server error. Please try again later.');
      default:
        throw new Error('An unexpected error occurred. Please try again.');
    }
  };
  
  // Create and export the axios instance
  export const axiosInstance = createAxiosInstance();
  
  // Example API methods using the enhanced axios instance
  export const api = {
    initializeLesson: async (studentId, lessonPath) => {
      try {
        const response = await axiosInstance.post('/initialize-lesson', {
          student_id: studentId,
          lesson_path: lessonPath
        });
        return response.data;
      } catch (error) {
        // Log the error with context
        console.error('Initialize lesson error:', {
          studentId,
          lessonPath,
          error: error.message
        });
        throw error; // Re-throw to be handled by the component
      }
    },
    // Add other API methods here...
  };