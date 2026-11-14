/** An error that is safe to show to the frontend. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Buffer's token endpoint returned an error (invalid_grant, invalid_client, ...). */
export class BufferOAuthError extends Error {
  constructor(
    public oauthError: string,
    public description: string,
    public httpStatus: number,
  ) {
    super(`${oauthError}: ${description}`);
  }
}
