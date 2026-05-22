export function getAirtableErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    if (typeof code === "number") return code;
  }
  return undefined;
}

export function isRetryableAirtableError(err: unknown): boolean {
  const status = getAirtableErrorStatus(err);
  if (status === 429) return true;
  if (status !== undefined && status >= 500 && status <= 503) return true;
  if (status === 0) return true;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("network") ||
      msg.includes("timeout")
    ) {
      return true;
    }
    if (err.name === "AirtableError") {
      const type = (err as { type?: string }).type;
      if (type === "rate-limit" || type === "server-error" || type === "network") {
        return true;
      }
    }
  }
  return false;
}

export function isPermanentAirtableError(err: unknown): boolean {
  const status = getAirtableErrorStatus(err);
  if (status === 401 || status === 403 || status === 404 || status === 422) {
    return true;
  }
  if (err instanceof Error && !isRetryableAirtableError(err)) {
    const statusKnown = status !== undefined;
    if (statusKnown) return true;
  }
  return false;
}

export function airtableErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
