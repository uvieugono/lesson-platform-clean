import axios, { AxiosResponse } from 'axios';
import { handleAxiosError } from '@utils/error-utils';

interface LessonResponse {
  session_id: string;
  lessonData: {
    lessonRef: string;
    title: string;
    content: any;
  };
}

const BASE_URL = 'https://lesson-manager-914922463191.us-central1.run.app';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
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
  (config) => config,
  (error) => Promise.reject(error), // Don't transform error here
);

// Simplified response interceptor - only handle retries
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest._retry && isRetryableError(error)) {
      originalRequest._retry = true;
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await axiosInstance(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError); // Don't transform error here
      }
    }
    return Promise.reject(error); // Don't transform error here
  },
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
  async fetchLessonContent(studentId: string, lessonPath: string) {
    try {
      const response = await axiosInstance.post('/lesson-content', {
        student_id: studentId,
        lesson_path: lessonPath,
      });
      return response.data.data; // Assuming your backend wraps data in a 'data' field
    } catch (error) {
      await handleApiError(error);
    }
  },

  async initializeLesson(studentId: string, lessonId: string): Promise<LessonResponse> {
    try {
      const response = await axiosInstance.post<{ data: LessonResponse }>('/initialize-lesson', {
        student_id: studentId,
        lesson_path: lessonId, // <-- Use `lesson_path` to match the Flask backend
      });

      // Check if we have the expected data structure
      if (!response.data || !response.data.data || !response.data.data.session_id) {
        if (process.env.NODE_ENV === 'development') {
          // Return mock data in development
          return {
            session_id: `mock_session_${Date.now()}`,
            lessonData: {
              lessonRef: lessonId,
              title: 'Mock Lesson',
              content: {},
            },
          };
        }
        throw new Error('Invalid response structure from server');
      }

      return response.data.data;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // Return mock data in development even on error
        return {
          session_id: `mock_session_${Date.now()}`,
          lessonData: {
            lessonRef: lessonId,
            title: 'Mock Lesson',
            content: {},
          },
        };
      }
      await handleApiError(error);
      throw error; // TypeScript requires this even though handleApiError always throws
    }
  },

  async pauseLesson(sessionId: string, studentId: string) {
    try {
      const response = await axiosInstance.post('/pause-lesson', {
        session_id: sessionId,
        student_id: studentId,
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },

  async resumeLesson(sessionId: string, studentId: string) {
    try {
      const response = await axiosInstance.post('/resume-lesson', {
        session_id: sessionId,
        student_id: studentId,
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },

  async sendMessageToTutor(studentId: string, message: string, lessonRef: string) {
    try {
      const response = await axiosInstance.post('/ai-tutor', {
        student_id: studentId,
        message: message,
        lesson_ref: lessonRef,
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },

  async generateNotes(studentId: string, lessonRef: string) {
    try {
      const response = await axiosInstance.post('/generate-notes', {
        student_id: studentId,
        lesson_ref: lessonRef,
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },

  async processInteraction(studentId: string, lessonRef: string, interactionData: any) {
    try {
      const response = await axiosInstance.post('/process-interaction', {
        student_id: studentId,
        lesson_ref: lessonRef,
        interaction_data: interactionData,
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },

  async saveProgress(studentId: string, lessonRef: string, progressData: any) {
    try {
      const response = await axiosInstance.post('/save-progress', {
        student_id: studentId,
        lesson_ref: lessonRef,
        progress_data: progressData,
      });
      return response.data;
    } catch (error) {
      await handleApiError(error);
    }
  },
};