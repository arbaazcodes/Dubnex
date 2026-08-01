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