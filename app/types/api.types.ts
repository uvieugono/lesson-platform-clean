// File: src/types/api.types.ts

export interface LessonResponse {
  session_id: string;
  lessonData: any; // Replace with proper type
}

export interface NotesResponse {
  noteContent: string;
}

export interface ProgressResponse {
  status: string;
  progress: number;
}

export interface InteractionResponse {
  explanation: string;
  nextSteps?: string[];
}

export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
}