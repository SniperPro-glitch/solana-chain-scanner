// Telegram foto caption: ~1024 karakter (görünür metin, HTML tag'leri hariç).

const { wrapEmojis } = require('./emojiPack');

const CAPTION_LIMIT = 1024;
const SAFE_VISIBLE = 1000;

function visibleLength(html) {
  return String(html || '').replace(/<[^>]+>/g, '').length;
}

function measureCardCaption(html, chain = 'solana') {
  const wrapped = wrapEmojis(html, chain);
  return {
    raw: wrapped.length,
    visible: visibleLength(wrapped),
    wrapped,
    overSafe: visibleLength(wrapped) > SAFE_VISIBLE,
    overHard: visibleLength(wrapped) > CAPTION_LIMIT,
  };
}

/**
 * Caption sığmazsa ortadan satır kırpar; son satırlar (disclaimer + bot yorumu) korunur.
 */
function trimForCaption(html, chain = 'solana', maxVisible = SAFE_VISIBLE) {
  let wrapped = wrapEmojis(html, chain);
  if (visibleLength(wrapped) <= maxVisible) {
    return { text: wrapped, trimmed: false, visible: visibleLength(wrapped) };
  }

  const lines = wrapped.split('\n');
  const tailReserve = 4;
  let trimmed = true;

  while (lines.length > tailReserve && visibleLength(lines.join('\n')) > maxVisible) {
    const removeAt = Math.max(1, Math.floor(lines.length / 2) - 1);
    lines.splice(removeAt, 1);
  }

  wrapped = lines.join('\n');
  if (visibleLength(wrapped) > maxVisible) {
    wrapped = wrapped.slice(0, Math.max(800, wrapped.length - (visibleLength(wrapped) - maxVisible) * 3));
    trimmed = true;
  }

  return { text: wrapped, trimmed, visible: visibleLength(wrapped) };
}

module.exports = {
  CAPTION_LIMIT,
  SAFE_VISIBLE,
  visibleLength,
  measureCardCaption,
  trimForCaption,
};
