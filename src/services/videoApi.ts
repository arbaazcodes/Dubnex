const API = "http://127.0.0.1:8000";

export async function translateVideo(
  file: File,
  language: string,
  voice: string
) {
  const form = new FormData();

  form.append("file", file);
  form.append("target_language", language);
  form.append("voice", voice);

  const response = await fetch(`${API}/process-video`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Translation failed");
  }

  return await response.json();
}