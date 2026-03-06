function isAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const err = error as { name?: string; message?: string };
  const isMessageAuthError = err.message
    ? err.message.includes("token expired") ||
      err.message.includes("InvalidToken") ||
      err.message.includes("Token-0")
    : false;

  return err.name === "ExpiredToken" || isMessageAuthError;
}

export { isAuthError };
