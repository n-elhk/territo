import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  errors?: string[];
}

export function parseApiError(err: HttpErrorResponse): ApiError {
  const body = err.error as Partial<ApiError> | null;
  return {
    statusCode: err.status,
    timestamp: body?.timestamp ?? new Date().toISOString(),
    path: body?.path ?? '',
    message: body?.message ?? err.message,
    errors: body?.errors,
  };
}
