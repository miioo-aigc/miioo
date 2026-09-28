import { authFetch } from './request.js';
import { throwResponseError } from './error.js';

export async function apiGenerateCanvasText({ messages, model, signal }) {
  const response = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/llm/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }), signal,
  });
  if (!response.ok) await throwResponseError(response, '文本创作失败，请重试');
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('模型未返回有效文本，请重试');
  return content;
}
