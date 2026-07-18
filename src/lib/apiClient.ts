export async function apiClient<T>(
  url: string,
  projectId: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("X-Project-Id", projectId);
  if (!headers.has("Content-Type") && options.method !== "GET" && options.method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = "API error";
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMsg = errorBody.error;
    } catch (e) {
      // Ignored
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
