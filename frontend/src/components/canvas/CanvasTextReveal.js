export function shouldRevealResult(previous, current) {
  return Boolean(previous.generating && !current.generating && !current.editing
    && current.content && current.content !== previous.content);
}

export function getRevealCharacters(content) {
  const segments = new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(content);
  return Array.from(segments, ({ segment }) => ({ text: segment }));
}

export function getRevealLines(characters) {
  const lines = [];
  for (const character of characters) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.top - character.top) < 0.1 && !previous.text.endsWith('\n')) {
      previous.text += character.text;
    } else {
      lines.push({ text: character.text, top: character.top, delay: Math.min(lines.length * 90, 600) });
    }
  }
  return lines;
}
