export class AuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
