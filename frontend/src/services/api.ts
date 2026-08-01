const API_BASE = "http://127.0.0.1:8000";

export async function processVideo(
  file: File,
  targetLanguage: string,
  voice: string = "george"
) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_BASE}/process-video?target_lang=${targetLanguage}&voice=${voice}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Video processing failed");
  }

  return response.json();
}

export async function translateVideo(
  file: File,
  language: string,
  voice: string
) {
  const form = new FormData();

  form.append("file", file);
  form.append("target_language", language);
  form.append("voice", voice);

  const response = await fetch(`${API_BASE}/process-video`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Translation failed");
  }

  return response.json();
}