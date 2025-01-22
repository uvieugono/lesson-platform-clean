'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { BookOpen, Play, Trophy, Send, Sparkles, Pause } from 'lucide-react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import ErrorDisplay from '@/components/ErrorDisplay'; 
import { api as localApi } from '@/services/api-service'; 

console.log('ErrorDisplay component:', ErrorDisplay);

// Using proxy configuration
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Configure axios defaults
axios.defaults.headers.common['Content-Type'] = 'application/json';

// First, let's define a simple error boundary component
function SimpleErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleError = (error) => {
      console.error('Error caught by boundary:', error);
      setError(error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-lg">
        <h2>Something went wrong</h2>
        <pre>{error?.toString()}</pre>
      </div>
    );
  }

  return children;
}

// Add a debug wrapper component
function DebugWrapper({ children }) {
  console.log('Debug: Rendering wrapper');
  return (
    <div className="debug-wrapper">
      {children}
    </div>
  );
}

const api = {
  initializeLesson: async (studentId, lessonPath) => {
    try {
      const response = await axios.post(`${BASE_URL}/initialize-lesson`, {
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
      const response = await axios.post(`${BASE_URL}/pause-lesson`, {
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
      const response = await axios.post(`${BASE_URL}/resume-lesson`, {
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
      const response = await axios.post(`${BASE_URL}/generate-notes`, {
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
      const response = await axios.post(`${BASE_URL}/process-interaction`, {
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
      const response = await axios.post(`${BASE_URL}/save-progress`, {
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
      const response = await axios.post(`${BASE_URL}/ai-tutor`, {
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
};

const sampleData = {
  generatedContent: [{ content: 'Welcome to the lesson!' }],
  interactiveElements: [
    {
      type: 'graph',
      title: 'Sample Graph',
      data: [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 30 },
      ],
    },
    {
      type: 'animation',
      title: 'Sample Animation',
      animationConfig: { x: 100, y: 0, rotate: 360, duration: 2 },
    },
    {
      type: 'flashcard',
      title: 'Sample Flashcards',
      flashcards: [
        { front: 'What is 2 + 2?', back: '4' },
        { front: 'What is the capital of France?', back: 'Paris' },
      ],
    },
    {
      type: 'text',
      title: 'Sample Text',
      content: 'This is a sample text content.',
    },
  ],
  quizzes: [],
  examContent: [],
};

function Progress({ value }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-600 h-2 rounded-full transition-all"
        style={{ width: `${Math.min(Math.max(value || 0, 0), 100)}%` }}
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

const LocalErrorDisplay = ({ error, onRetry }) => {
  return (
    <div className="text-center p-6 bg-red-50 rounded-xl">
      <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
      <p className="text-red-600 mb-4">{error?.message || 'An error occurred while loading the lesson'}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    </div>
  );
};

interface StartScreenProps {
  handleStartLesson: (lessonId: string) => void;
  isLoading: boolean;
  error?: any; // Add the `error` prop as optional
}

function StartScreen({ handleStartLesson, isLoading, error }: StartScreenProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-4xl text-center font-bold mb-8 text-blue-600">Interactive Learning</h2>
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            <p>{error.message || "An error occurred while starting the lesson."}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="text-center p-8 bg-blue-50 rounded-xl hover:shadow-md transition-all">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-blue-600" />
            <h3 className="font-bold text-xl mb-3">Interactive Content</h3>
            <p className="text-gray-600">Engage with dynamic visualizations</p>
          </div>
          <div className="text-center p-8 bg-green-50 rounded-xl hover:shadow-md transition-all">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h3 className="font-bold text-xl mb-3">Adaptive Learning</h3>
            <p className="text-gray-600">Personalized assessments</p>
          </div>
        </div>
        <button
          onClick={() => handleStartLesson('2d-shapes-intro')}
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-3 transition-all"
        >
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-t-2 border-white rounded-full animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              Begin Lesson
              <Play className="w-6 h-6" />
            </>
          )}
        </button>
        <p className="text-center text-sm text-gray-500 mt-6 flex items-center justify-center gap-2">
          Powered by Gemini AI
          <Sparkles className="w-4 h-4 text-yellow-400" />
        </p>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  disabled?: boolean; // Make `disabled` optional if needed
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, disabled = false, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-6 py-3 rounded-lg font-medium transition-all
        ${
          disabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : active
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }
      `}
    >
      {children}
    </button>
  );
}

function ChatMessage({ message, role, assistantLabel = 'Tutor' }) {
  return (
    <div
      className={`p-4 rounded-xl shadow-sm ${
        role === 'user' ? 'bg-blue-50 text-blue-900 ml-8' : 'bg-green-50 text-green-900 mr-8'
      }`}
    >
      <div className="font-medium mb-1">{role === 'user' ? 'You' : assistantLabel}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ContentCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">{title}</h2>
      {children}
    </div>
  );
}

function ErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (error) => {
      console.error('Error caught by boundary:', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return <div>Something went wrong. Please try again.</div>;
  }

  return children;
}

const GraphComponent = ({ data }) => (
  <LineChart width={500} height={300} data={data}>
    <XAxis dataKey="x" />
    <YAxis dataKey="y" />
    <Tooltip />
    <Line type="monotone" dataKey="y" stroke="#8884d8" />
  </LineChart>
);

const AnimationComponent = ({ animationConfig }) => (
  <motion.div
    animate={{ x: animationConfig.x, y: animationConfig.y, rotate: animationConfig.rotate }}
    transition={{ duration: animationConfig.duration }}
  >
    Animated Content
  </motion.div>
);

const FlashcardComponent = ({ front, back }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="flashcard"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      {isFlipped ? back : front}
    </div>
  );
};

const TextComponent = ({ content }) => (
  <p className="text-gray-800 text-lg leading-relaxed">{content}</p>
);

const renderInteractiveElement = (element) => {
  switch (element.type) {
    case 'graph':
      return <GraphComponent data={element.data} />;
    case 'animation':
      return <AnimationComponent animationConfig={element.animationConfig} />;
    case 'flashcard':
      return element.flashcards.map((flashcard, index) => (
        <FlashcardComponent key={index} front={flashcard.front} back={flashcard.back} />
      ));
    case 'text':
      return <TextComponent content={element.content} />;
    default:
      return null;
  }
};

interface Scores {
  quiz?: number;
  exam?: number;
  // Add other properties if needed
}

// Define a placeholder for getDynamicStudentId
function getDynamicStudentId(): string {
  // TODO: Replace this with actual logic to retrieve the dynamic student ID
  return "dummy-student-id";
}

const LessonPage = () => {
  const [isLessonStarted, setIsLessonStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('lesson');
  const [timeSpent, setTimeSpent] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isLessonPaused, setIsLessonPaused] = useState(false);
  const [instructorChatHistory, setInstructorChatHistory] = useState([]);
  const [tutorChatHistory, setTutorChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [responses, setResponses] = useState({});
  const [scores, setScores] = useState<Scores>({});
  const [submitted, setSubmitted] = useState<SubmittedState>({});
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [tutorInteractions, setTutorInteractions] = useState(10);
  const [examTimeLeft, setExamTimeLeft] = useState(60);
  const [examTimerActive, setExamTimerActive] = useState(false);
  const [dynamicLessonContent, setDynamicLessonContent] = useState({
    generatedContent: [],
    interactiveElements: [],
    quizzes: [],
    examContent: [],
  });
  const [lessonData, setLessonData] = useState(null);
  const [error, setError] = useState<Error | null>(null); // Type error properly

  // Replace with your dynamic source
  const studentId = getDynamicStudentId();

  const fetchLessonContent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${BASE_URL}/lesson-content`, {
        student_id: studentId,
        lesson_id: 'lesson123', // Pass any required payload
      }); // Change from GET to POST
      setDynamicLessonContent(response.data);
    } catch (err) {
      console.error('Error fetching lesson content:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLessonStarted) {
      fetchLessonContent();
    }
  }, [isLessonStarted]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent>
            <LocalErrorDisplay error={error} onRetry={fetchLessonContent} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent>
            <LoadingSpinner />
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStartLesson = async (lessonId) => {
    setIsLoading(true);
    setError(null); // Clear any previous errors
    try {
      const response = await localApi.initializeLesson(studentId, lessonId);
      console.log('API Response:', response);
      setSessionId(response.session_id);
      setLessonData(response.lessonData);
      setIsLessonStarted(true);
    } catch (error) {
      console.error('Failed to start lesson:', error);
      setError(error); // Set the error state
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndLesson = async () => {
    try {
      if (!lessonData) throw new Error('Lesson data is not available');
      const notesData = await localApi.generateNotes(lessonData.lessonRef, studentId);
      if (!notesData || !notesData.noteContent) {
        throw new Error('No notes content received from the server');
      }

      const blob = new Blob([notesData.noteContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      setIsLessonStarted(false);
      setLessonCompleted(false);
      setSessionId(null);
    } catch (error) {
      console.error('Error generating notes:', error);
      alert('Failed to generate lesson notes. Please try again.');
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    if (!lessonData) throw new Error('Lesson data is not available');

    // Use a type assertion to dynamically access the aiTutor method
    const dynamicApi = localApi as any;

    if (activeTab === 'tutor') {
      if (tutorInteractions <= 0) return;
      setTutorChatHistory((prev) => [...prev, { role: 'user', content: message }]);
      setChatInput('');
      setTutorInteractions((prev) => prev - 1);

      if (typeof dynamicApi.aiTutor === 'function') {
        try {
          const response = await dynamicApi.aiTutor(studentId, message, lessonData.lessonRef);
          setTutorChatHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: response.data.explanation,
            },
          ]);
        } catch (error) {
          console.error("Error calling aiTutor:", error);
          alert('Failed to get AI tutor response. Please try again.');
        }
      } else {
        console.warn("aiTutor function is not available on localApi");
      }
    } else if (activeTab === 'lesson') {
      setInstructorChatHistory((prev) => [...prev, { role: 'user', content: message }]);
      setChatInput('');

      if (typeof dynamicApi.aiTutor === 'function') {
        try {
          const response = await dynamicApi.aiTutor(studentId, message, lessonData.lessonRef);
          setInstructorChatHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: response.data.explanation,
            },
          ]);
        } catch (error) {
          console.error("Error calling aiTutor:", error);
          alert('Failed to get instructor response. Please try again.');
        }
      } else {
        console.warn("aiTutor function is not available on localApi");
      }
    }
  };

  const handleSubmit = (type: keyof Scores) => {
    const isQuiz = type === 'quiz';
    const questions = isQuiz ? dynamicLessonContent.quizzes : dynamicLessonContent.examContent;

    let score = 0;
    questions.forEach((q, idx) => {
      if (
        (q.type === 'fill' || q.type === 'multiple-choice') &&
        responses[`${type}-${idx}`] === q.correctAnswer
      ) {
        score++;
      }
    });

    const calculatedScore = Math.round((score / questions.length) * 100);
    setScores((prev) => ({
      ...prev,
      [type]: calculatedScore,
    }));
    setSubmitted((prev) => ({ ...prev, [type]: true }));

    if (isQuiz) {
      setLessonCompleted(true);
    }

    if (!isQuiz) {
      setExamTimerActive(false);
    }
  };

  const handleTabClick = (tabName) => {
    if (tabName === 'exam' && !lessonCompleted) return;
    setActiveTab(tabName);

    if (tabName === 'exam') {
      setExamTimeLeft(60);
      setExamTimerActive(true);
    } else {
      setExamTimerActive(false);
    }
  };

  const handleInputChange = (e) => {
    setChatInput(e.target.value);
  };

  // Render methods for lesson, quiz, and tutor tabs
  const renderQuizTab = () => (
    <ContentCard title="Quiz">
      <div className="space-y-6">
        {dynamicLessonContent.quizzes.map((q, idx) => (
          <div key={idx} className="p-6 bg-gray-50 rounded-xl">
            <p className="text-xl font-semibold mb-4">{q.question}</p>
            {q.type === 'multiple-choice' && (
              <div className="space-y-3">
                {q.options.map((opt, optIdx) => (
                  <label
                    key={optIdx}
                    className="flex items-center space-x-3 p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={opt}
                      checked={responses[`quiz-${idx}`] === opt}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          [`quiz-${idx}`]: e.target.value,
                        }))
                      }
                      disabled={submitted.quiz}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        {submitted.quiz ? (
          <div className="p-6 bg-green-50 rounded-xl flex items-center justify-between">
            <p className="text-xl font-bold text-green-800">Your Score: {scores.quiz || 0}%</p>
          </div>
        ) : (
          <button
            onClick={() => handleSubmit('quiz')}
            disabled={submitted.quiz}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold"
          >
            Submit Quiz
          </button>
        )}
      </div>
    </ContentCard>
  );

  const renderTutorTab = () => (
    <ContentCard title="AI Tutor">
      <div className="space-y-6">
        <div className="space-y-4">
          {tutorChatHistory.map((msg, idx) => (
            <ChatMessage key={idx} message={msg.content} role={msg.role} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={chatInput}
            onChange={handleInputChange}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleSendMessage(chatInput)}
            disabled={tutorInteractions <= 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600">Interactions left: {tutorInteractions}</p>
      </div>
    </ContentCard>
  );

  const createRenderContent = (
    activeTab,
    dynamicLessonContent,
    isLessonPaused,
    setIsLessonPaused,
    instructorChatHistory,
    chatInput,
    handleInputChange,
    handleSendMessage,
    renderQuizTab,
    renderTutorTab,
    examTimeLeft,
    responses,
    setResponses,
    submitted,
    scores,
    handleSubmit
  ) => {
    console.log('Rendering content for tab:', activeTab);
    switch (activeTab) {
      case 'lesson':
        return renderLessonTab(
          dynamicLessonContent, 
          isLessonPaused, 
          setIsLessonPaused,
          instructorChatHistory,
          chatInput,
          handleInputChange,
          handleSendMessage
        );
      case 'quiz':
        return renderQuizTab();
      case 'exam':
        return (
          <ContentCard title="Final Exam">
            <div className="mb-4 text-red-600 font-bold">Time Left: {examTimeLeft}s</div>
            <div className="space-y-6">
              {dynamicLessonContent.examContent.map((q, idx) => (
                <div key={idx} className="p-6 bg-gray-50 rounded-xl">
                  <p className="text-xl font-semibold mb-4">{q.question}</p>
                  {q.type === 'multiple-choice' && (
                    <div className="space-y-3">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center space-x-3 p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <input
                            type="radio"
                            value={opt}
                            checked={responses[`exam-${idx}`] === opt}
                            onChange={(e) =>
                              setResponses((prev) => ({
                                ...prev,
                                [`exam-${idx}`]: e.target.value,
                              }))
                            }
                            disabled={submitted.exam}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {submitted.exam ? (
                <div className="p-6 bg-green-50 rounded-xl flex items-center justify-between">
                  <p className="text-xl font-bold text-green-800">Your Score: {scores.exam || 0}%</p>
                </div>
              ) : (
                <button
                  onClick={() => handleSubmit('exam')}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold"
                >
                  Submit Exam
                </button>
              )}
            </div>
          </ContentCard>
        );
      case 'tutor':
        return renderTutorTab();
      default:
        return null;
    }
  };

  const renderLessonTab = (content, isPaused, setIsPaused, instructorChatHistory, chatInput, handleInputChange, handleSendMessage) => {
    return (
      <ContentCard title="Lesson Content">
        <div className="space-y-8">
          {/* Pause/Resume Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                isPaused
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              } text-white transition-colors`}
            >
              {isPaused ? (
                <>
                  <Play className="w-5 h-5" />
                  Resume Lesson
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5" />
                  Pause Lesson
                </>
              )}
            </button>
          </div>

          {/* Generated Content */}
          {content.generatedContent.map((item, index) => (
            <div key={index} className="prose max-w-none">
              {item.content}
            </div>
          ))}

          {/* Interactive Elements */}
          {content.interactiveElements.map((element, index) => (
            <div key={index} className="border rounded-xl p-6 bg-gray-50">
              {element.title && (
                <h3 className="text-xl font-semibold mb-4">{element.title}</h3>
              )}
              {renderInteractiveElement(element)}
            </div>
          ))}

          {/* Chat/Discussion Section */}
          <div className="space-y-4 mt-8">
            {instructorChatHistory.map((msg, idx) => (
              <ChatMessage 
                key={idx} 
                message={msg.content} 
                role={msg.role} 
                assistantLabel="Instructor" 
              />
            ))}

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={handleInputChange}
                placeholder="Ask the instructor a question..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleSendMessage(chatInput)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </ContentCard>
    );
  };

  const renderContent = () => createRenderContent(
    activeTab,
    dynamicLessonContent,
    isLessonPaused,
    setIsLessonPaused,
    instructorChatHistory,
    chatInput,
    handleInputChange,
    handleSendMessage,
    renderQuizTab,
    renderTutorTab,
    examTimeLeft,
    responses,
    setResponses,
    submitted,
    scores,
    handleSubmit
  );

  return (
    <SimpleErrorBoundary>
      <DebugWrapper>
        <div className="min-h-screen bg-gray-100">
          {!isLessonStarted ? (
            <StartScreen 
              handleStartLesson={handleStartLesson} 
              isLoading={isLoading}
              error={error}  // Add this
            />
          ) : (
            <div className="max-w-6xl mx-auto px-4 py-8">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <TabButton
                      active={activeTab === 'lesson'}
                      disabled={false} // Add the `disabled` prop
                      onClick={() => handleTabClick('lesson')}
                    >
                      Lesson
                    </TabButton>
                    <TabButton
                      active={activeTab === 'quiz'}
                      disabled={false} // Add the `disabled` prop
                      onClick={() => handleTabClick('quiz')}
                    >
                      Quiz
                    </TabButton>
                    <TabButton
                      active={activeTab === 'exam'}
                      disabled={!lessonCompleted} // Add the `disabled` prop
                      onClick={() => handleTabClick('exam')}
                    >
                      Exam
                    </TabButton>
                    <TabButton
                      active={activeTab === 'tutor'}
                      disabled={false} // Add the `disabled` prop
                      onClick={() => handleTabClick('tutor')}
                    >
                      AI Tutor
                    </TabButton>
                  </div>

                  <button
                    onClick={handleEndLesson}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                  >
                    End Lesson
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold mb-6 text-blue-600">Progress</h2>
                    <Progress value={(timeSpent / 60) * 100} />
                  </div>

                  {renderContent()}
                </div>
              </div>
            </div>
          )}
        </div>
      </DebugWrapper>
    </SimpleErrorBoundary>
  );
};

export default LessonPage;

interface SubmittedState {
  quiz?: boolean;
  exam?: boolean;
  // Add other properties if needed
}
