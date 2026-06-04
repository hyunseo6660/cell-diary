let currentController = null;

export async function analyzeDiary(content, date, callbacks) {
  // 이전 요청 취소
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();

  const response = await fetch('/api/diary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, date }),
    signal: currentController.signal,
  });

  if (!response.ok) {
    throw new Error(`서버 오류: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // 미완성 라인 보존

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return;

      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'delta')    callbacks.onDelta?.(parsed.text);
        if (parsed.type === 'complete') callbacks.onComplete?.(parsed.result);
        if (parsed.type === 'error')    callbacks.onError?.(new Error(parsed.message));
      } catch {
        // 부분 청크 무시
      }
    }
  }
}
