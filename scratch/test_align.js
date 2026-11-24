function cleanMd(md) {
  let text = md;
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^#{1,6}\s*/gm, '');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');
  text = text.replace(/^>\s*/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  return text.trim();
}

function tokenize(text) {
  const tokens = text.split(/([^\s\p{P}]+)/u);
  return tokens.filter(t => /[^\s\p{P}]+/u.test(t));
}

const sample = '### Welcome\nHere is a list of features:\n- Natural speech\n- **Accurate** synchronization\n\n```python\nprint(123)\n```\nVisit [Yash](https://yash.ai).';
const cleaned = cleanMd(sample);
console.log('Cleaned:');
console.log(cleaned);
console.log('Words:', tokenize(cleaned));
