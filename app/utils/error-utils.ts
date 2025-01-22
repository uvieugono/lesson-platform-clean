// app/utils/error-utils.ts
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify'; // Import toast
import 'react-toastify/dist/ReactToastify.css'; // Import CSS (required)

export const handleAxiosError = (error: AxiosError | Error | unknown): string => {
  let errorMessage = "An unexpected error occurred."; // Default error message

  if (axios.isAxiosError(error)) {
    // Handle Axios-specific errors
    const serverMessage = error.response?.data?.message;
    errorMessage = serverMessage || "An error occurred with the server request.";
    toast.error(errorMessage); // Show toast here
  } else if (error instanceof Error) {
    // Handle generic Error objects
    errorMessage = error.message;
    toast.error(errorMessage); // Show toast here
  } else {
    // Handle other unknown error types
    toast.error(errorMessage); // Show toast here
  }

  console.error(error); // Always log the error for debugging
  return errorMessage; // Return the error message string
};