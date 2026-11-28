const UNAVAILABLE = 'AI asistent trenutačno nije dostupan. Nazovi nas na 098 1947 591.';

// Only a successful HTTP response with nonempty text becomes chat history.
// Never display raw error bodies or transport errors as model answers.
export async function requestChatReply(messages, send = fetch) {
  try {
    const response = await send('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!response.ok) {
      const error = response.status === 429
        ? 'Poslali ste previše poruka. Pokušajte ponovno malo kasnije.'
        : response.status === 400 || response.status === 413
          ? 'Poruka nije valjana ili je prevelika. Skrati je i pokušaj ponovno.'
          : UNAVAILABLE;
      return { error };
    }
    const data = await response.json();
    if (typeof data?.reply !== 'string' || !data.reply.trim()) return { error: UNAVAILABLE };
    return { reply: data.reply.trim() };
  } catch {
    return { error: UNAVAILABLE };
  }
}
