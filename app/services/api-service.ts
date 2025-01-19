import axios, { AxiosResponse } from 'axios';
import { handleAxiosError } from '@utils/error-utils';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lesson-manager-914922463191.us-central1.run.app';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

function isRetryableError(error: any): boolean {
  return (
    !error.response ||
    error.response.status === 408 ||
    error.response.status === 429 ||
    (error.response.status >= 500 && error.response.status <= 599)
  );
}

// Simplified request interceptor - only handle config
axiosInstance.interceptors.request.use(
  config => config,
  error => Promise.reject(error) // Don't transform error here
);

// Simplified response interceptor - only handle retries
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (!originalRequest._retry && isRetryableError(error)) {
      originalRequest._retry = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await axiosInstance(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError); // Don't transform error here
      }
    }
    return Promise.reject(error); // Don't transform error here
  }
);

// Helper function to handle API errors
async function handleApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const errorMessage = handleAxiosError(error);
    throw new Error(errorMessage);
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error('An unexpected error occurred');
}

export const api = {
  async fetchLessonContent(studentId: string, lessonId: string) {
    try {
      const response = await axiosInstance.post('/lesson-content', {
        student_id: studentId,
        lesson_id: lessonId
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },
  
  async initializeLesson(studentId: string, lessonId: string) {
    try {
      const response = await axiosInstance.post('/initialize-lesson', {
        student_id: studentId,
        lesson_id: lessonId
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  }
};