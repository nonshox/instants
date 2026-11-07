import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: { Accept: "application/json" },
});

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export function getApiErrorMessage(
  cause: unknown,
  fallback: string,
): string {
  if (!axios.isAxiosError<ApiErrorResponse>(cause)) {
    return fallback;
  }
  return cause.response?.data.error?.message ?? fallback;
}
