import React from 'react';
import { cn } from '../lib/utils';

const isProbablyCode = (text) => {
  if (!text) return false;
  if (text.includes('```')) return true;

  const t = String(text);
  if (t.includes('\n')) {
    if (/\n\s{2,}\S/.test(t)) return true;
    if (/[{}();<>]/.test(t) && /\n/.test(t)) return true;
  }

  if (/\b(class|def|import|from|function|const|let|var|public|private|protected|return|async|await)\b/.test(t)) {
    return true;
  }

  if (/\b(console\.log|System\.out\.println|printf)\b/i.test(t)) {
    return true;
  }

  if (/^\s*(SELECT|INSERT|UPDATE|DELETE)\b(?!\s*\()/i.test(t)) {
    return true;
  }

  if (/\b(INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|SELECT\s+.+\s+FROM)\b/i.test(t)) {
    return true;
  }

  return false;
};

const CodeAwareText = ({ text, className }) => {
  if (text == null || text === '') return null;

  const value = String(text);
  const isCode = isProbablyCode(value);

  if (isCode) {
    const content = value.includes('```')
      ? value.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```\s*$/, '')
      : value;

    return (
      <pre
        className={cn(
          'm-0 w-full min-w-0 overflow-x-auto whitespace-pre font-mono text-sm leading-relaxed rounded-lg bg-gray-100/60 dark:bg-gray-700/60 p-3',
          className
        )}
      >
        <code>{content}</code>
      </pre>
    );
  }

  return (
    <span className={cn('whitespace-pre-wrap break-words leading-relaxed', className)}>
      {value}
    </span>
  );
};

export default CodeAwareText;
