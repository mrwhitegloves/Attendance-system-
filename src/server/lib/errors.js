// Errors are plain objects made here; the API wrapper turns them into a JSON answer.

/**
 * @param {number} status HTTP status (400, 401, 403, 404, 409 …)
 * @param {string} message A sentence the user can read.
 * @param {string} [code] A short fixed code the screens can check.
 */
export function createAppError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code ?? defaultCode(status);
  error.isAppError = true;
  return error;
}

function defaultCode(status) {
  return (
    { 400: 'bad_request', 401: 'signed_out', 403: 'forbidden', 404: 'not_found', 409: 'conflict' }[
      status
    ] ?? 'error'
  );
}

export const notFound = (what = 'Record') => createAppError(404, `${what} not found.`);
