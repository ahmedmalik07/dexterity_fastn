// Conversation intent is independent of whichever dashboard mode was last selected.
function conversationRequest(text, previous = null) {
 if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Error('Ask a question in under 4,000 characters.');
 const goal = text.trim();
 const continuing = /^(yes[,.! ]*|ok(?:ay)?[,.! ]*)?(continue|next(?: step)?|i (?:did|have done|finished)|done|what(?:’s|'s| is) next|go on)\b/i.test(goal);
 const teaching = /\b(teach me|show me how|walk me through|how (?:do|can|should) i|how to|where (?:is|are|do i)|show me where)\b/i.test(goal);
 const mode = teaching || (continuing && previous?.mode === 'teach') ? 'teach' : 'answer';
 return { goal, mode, companion: true, screen: previous?.screen !== false,
  windowId: previous?.windowId || '', remembered: true,
  rootGoal: continuing && previous?.rootGoal ? previous.rootGoal : goal };
}
module.exports = { conversationRequest };
