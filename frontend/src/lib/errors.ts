import axios from 'axios';

// Turn any thrown value into a message that's safe and useful to show the user
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError<{ error?: string }>(err)) {
    if (err.response?.data?.error) return err.response.data.error;
    if (!err.response) return "Can't reach the server. Check your connection and try again.";
  }
  return fallback;
}
