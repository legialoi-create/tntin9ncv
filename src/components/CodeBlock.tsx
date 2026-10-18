import React from 'react';
import { Terminal } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  selectable?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'python', selectable = false }) => {
  if (!code) return null;

  const getLangBadge = (lang?: string) => {
    switch (lang?.toLowerCase()) {
      case 'python':
        return { label: 'Python 3', bg: 'bg-emerald-600' };
      case 'pascal':
        return { label: 'Free Pascal', bg: 'bg-indigo-600' };
      case 'cpp':
      case 'c++':
        return { label: 'C++', bg: 'bg-blue-600' };
      case 'scratch':
        return { label: 'Scratch / Khối lệnh', bg: 'bg-amber-600' };
      default:
        return { label: 'Đoạn mã code', bg: 'bg-slate-700' };
    }
  };

  const badge = getLangBadge(language);

  return (
    <div
      className={`my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-sm ${
        selectable ? '' : 'select-none pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono font-medium">{badge.label}</span>
        </div>
        <div className="flex space-x-1">
          <span className="w-2 h-2 rounded-full bg-red-500/70 inline-block"></span>
          <span className="w-2 h-2 rounded-full bg-amber-500/70 inline-block"></span>
          <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block"></span>
        </div>
      </div>
      <div className="p-3 text-sm font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </div>
    </div>
  );
};
