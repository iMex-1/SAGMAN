export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
      },
    };
  }
}

export const Errors = {
  NotFound: (resource: string, id?: string) =>
    new AppError(
      `${resource.toUpperCase()}_NOT_FOUND`,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404,
    ),

  Forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError('FORBIDDEN', message, 403),

  Unauthorized: (message = 'Authentication required') =>
    new AppError('UNAUTHORIZED', message, 401),

  Conflict: (message: string) =>
    new AppError('CONFLICT', message, 409),

  BadRequest: (message: string, code = 'BAD_REQUEST') =>
    new AppError(code, message, 400),

  ValidationError: (message: string) =>
    new AppError('VALIDATION_ERROR', message, 422),

  BusinessRule: (code: string, message: string) =>
    new AppError(code, message, 422),
};
