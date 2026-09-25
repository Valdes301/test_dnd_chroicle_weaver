'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        'prose prose-invert max-w-none break-words leading-relaxed',
        'prose-headings:font-headline prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-xl sm:prose-h1:text-2xl prose-h1:border-b prose-h1:border-border/40 prose-h1:pb-2 prose-h1:mt-4 prose-h1:mb-2',
        'prose-h2:text-lg sm:prose-h2:text-xl prose-h2:border-b prose-h2:border-border/30 prose-h2:pb-1.5 prose-h2:mt-4 prose-h2:mb-2',
        'prose-h3:text-base sm:prose-h3:text-lg prose-h3:text-foreground/95 prose-h3:mt-3 prose-h3:mb-1.5',
        'prose-h4:text-sm sm:prose-h4:text-base prose-h4:font-medium prose-h4:mt-2.5 prose-h4:mb-1',
        'prose-p:my-2 prose-p:text-foreground/90 leading-relaxed',
        'prose-strong:text-foreground prose-strong:font-bold prose-strong:text-amber-300/90 dark:prose-strong:text-amber-200/95',
        'prose-em:italic prose-em:text-foreground/85',
        'prose-ul:my-2.5 prose-ul:list-disc prose-ul:pl-5 prose-ul:space-y-1',
        'prose-ol:my-2.5 prose-ol:list-decimal prose-ol:pl-5 prose-ol:space-y-1',
        'prose-li:my-0.5 prose-li:text-foreground/90',
        'prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-3 prose-blockquote:text-muted-foreground',
        'prose-hr:my-4 prose-hr:border-border/50',
        'prose-table:my-3 prose-table:w-full prose-table:border-collapse',
        'prose-th:border prose-th:border-border/60 prose-th:p-2 prose-th:bg-muted/30 prose-th:text-left prose-th:font-semibold',
        'prose-td:border prose-td:border-border/40 prose-td:p-2',
        'prose-code:bg-muted/40 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
