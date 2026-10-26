// The one way the screens call our API. Throws an Error with the server's message.

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (response.status === 401 && path !== '/api/auth/login') {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
