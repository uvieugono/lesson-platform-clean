import axios from 'axios';

const BASE_URL = '/api/proxy'; 

axios.defaults.headers.common['Content-Type'] = 'application/json';

interface ApiService {
  initializeLesson: (studentId: string, lessonPath: string) => Promise<any>;
  pauseLesson: (sessionId: string, reason: string) => Promise<any>;
  resumeLesson: (sessionId: string) => Promise<any>;
  generateNotes: (lessonRef: string, studentId: string) => Promise<any>;
  processInteraction: (
    sessionId: string,
    studentId: string,
    lessonRef: string,
    interactionData: any
  ) => Promise<any>;
  saveProgress: (
    sessionId: string,
    userId: string,
    lessonRef: string,
    progress: number
  ) => Promise<any>;
  aiTutor: (studentId: string, question: string, lessonPath: string) => Promise<any>;
  generateLessonPlan: (data: any) => Promise<any>;
  findLessonByRef: (
    lessonRef: string,
    country: string,
    curriculum: string,
    grade: string,
    level: string,
    subject: string
  ) => Promise<any>;
  lessonContent: (studentId: string, lessonId: string) => Promise<any>;
}

export const api: ApiService = {
  initializeLesson: async (studentId, lessonPath) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=initialize-lesson`, {
        student_id: studentId,
        lesson_path: lessonPath,
      });
      return response.data;
    } catch (error) {
      console.error('Initialize lesson error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to initialize lesson');
    }
  },

  pauseLesson: async (sessionId, reason) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=pause-lesson`, {
        session_id: sessionId,
        reason: reason,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('Pause lesson error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to pause lesson');
    }
  },

  resumeLesson: async (sessionId) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=resume-lesson`, {
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('Resume lesson error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to resume lesson');
    }
  },

  generateNotes: async (lessonRef, studentId) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=generate-notes`, {
        lessonRef: lessonRef,
        studentId: studentId,
      });
      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      return response.data.data;
    } catch (error) {
      console.error('Generate notes error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to generate notes');
    }
  },

  processInteraction: async (sessionId, studentId, lessonRef, interactionData) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=process-interaction`, {
        session_id: sessionId,
        student_id: studentId,
        lesson_ref: lessonRef,
        interaction_analytics: interactionData,
      });
      return response.data;
    } catch (error) {
      console.error('Process interaction error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to process interaction');
    }
  },

  saveProgress: async (sessionId, userId, lessonRef, progress) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=save-progress`, {
        session_id: sessionId,
        user_id: userId,
        lesson_ref: lessonRef,
        progress: progress,
      });
      return response.data;
    } catch (error) {
      console.error('Save progress error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to save progress');
    }
  },

  aiTutor: async (studentId, question, lessonPath) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=ai-tutor`, {
        student_id: studentId,
        question: question,
        lesson_path: lessonPath,
      });
      return response.data;
    } catch (error) {
      console.error('AI tutor error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to get AI tutor response');
    }
  },

  generateLessonPlan: async (data) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=generate-lesson-plan`, data);
      console.log("Response from generate-lesson-plan:", response); // Log the response
      return response.data;
    } catch (error) {
      console.error('Generate lesson plan error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to generate lesson plan');
    }
  },

  findLessonByRef: async (lessonRef, country, curriculum, grade, level, subject) => {
    try {
      const response = await axios.post(`${BASE_URL}?endpoint=get-lesson-by-ref`, {
        lesson_ref: lessonRef,
        country: country,
        curriculum: curriculum,
        grade: grade,
        level: level,
        subject: subject
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching lesson by ref:', error);
      throw new Error(error?.response?.data?.message || 'Failed to fetch lesson data');
    }
  },

  lessonContent: async (studentId, lessonId) => {
    try {
      const response = await axios.post(
        'https://us-central1-solynta-academy.cloudfunctions.net/lessonManager/lesson-content',
        {
          student_id: studentId,
          lesson_id: lessonId,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Lesson content error:', error);
      throw new Error(error?.response?.data?.message || 'Failed to fetch lesson content');
    }
  },
};