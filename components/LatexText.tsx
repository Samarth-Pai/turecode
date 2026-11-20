"use client";

import katex from "katex";
import React, { useMemo } from "react";

interface LatexTextProps {
  text: string;
  className?: string;
}

type Segment =
  | { type: "text"; content: string }
  | { type: "inline-math"; content: string }
  | { type: "display-math"; content: string }
  | { type: "code"; content: string };

function tokenizeLatex(input: string): Segment[] {
  const segments: Segment[] = [];
  // Matches $$...$$, \[...\], $...$, \(...\), and `...`
  const pattern =
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?:\\.|[^$\n])+?\$|\\\([\s\S]+?\\\)|`[^`\n]+?`)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: input.slice(lastIndex, match.index),
      });
    }

    const token = match[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      segments.push({ type: "display-math", content: token.slice(2, -2).trim() });
    } else if (token.startsWith("\\[") && token.endsWith("\\]")) {
      segments.push({ type: "display-math", content: token.slice(2, -2).trim() });
    } else if (token.startsWith("$") && token.endsWith("$")) {
      segments.push({ type: "inline-math", content: token.slice(1, -1).trim() });
    } else if (token.startsWith("\\(") && token.endsWith("\\)")) {
      segments.push({ type: "inline-math", content: token.slice(2, -2).trim() });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      segments.push({ type: "code", content: token.slice(1, -1) });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex) });
  }

  return segments;
}

/** Renders prose containing inline/display LaTeX math ($...$, $$...$$) and inline code spans. */
export function LatexText({ text, className = "" }: LatexTextProps) {
  const rendered = useMemo(() => {
    const segments = tokenizeLatex(text);
    return segments.map((seg, idx) => {
      if (seg.type === "text") {
        return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
      }
      if (seg.type === "code") {
        return (
          <code
            key={idx}
            className="rounded-[2px] border border-[#462E22] bg-[#110A07] px-1.5 py-0.5 font-fira text-[0.88em] text-[#CA8A04]"
          >
            {seg.content}
          </code>
        );
      }

      const displayMode = seg.type === "display-math";
      const html = katex.renderToString(seg.content, {
        displayMode,
        throwOnError: false,
        strict: false,
      });

      if (displayMode) {
        return (
          <span
            key={idx}
            className="my-2 block overflow-x-auto text-[#F5E6D3]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      return (
        <span
          key={idx}
          className="inline-block align-baseline text-[#F5E6D3]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  }, [text]);

  return <span className={className}>{rendered}</span>;
}
