"use client";

import {
  autocompletion,
  completeAnyWord,
  completeFromList,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import React, { useMemo } from "react";
import type { LanguageId } from "@/lib/types";

interface CodeEditorProps {
  language: LanguageId;
  value: string;
  onChange: (value: string) => void;
  themeMode: "dark" | "light";
  fontSize: number;
  wordWrap: boolean;
  readOnly?: boolean;
  extraSymbols?: string[];
  onRunShortcut?: () => void;
}

const LANG_COMPLETIONS: Record<LanguageId, Completion[]> = {
  c: [
    { label: "printf", type: "function", detail: "stdio.h", apply: 'printf("%d\\n", );' },
    { label: "scanf", type: "function", detail: "stdio.h", apply: 'scanf("%d", &);' },
    { label: "malloc", type: "function", detail: "stdlib.h" },
    { label: "calloc", type: "function", detail: "stdlib.h" },
    { label: "free", type: "function", detail: "stdlib.h" },
    { label: "strlen", type: "function", detail: "string.h" },
    { label: "strcmp", type: "function", detail: "string.h" },
    { label: "memset", type: "function", detail: "string.h" },
    { label: "memcpy", type: "function", detail: "string.h" },
    { label: "for", type: "keyword", apply: "for (int i = 0; i < n; i++) {\n    \n}" },
    { label: "while", type: "keyword", apply: "while () {\n    \n}" },
    { label: "if", type: "keyword", apply: "if () {\n    \n}" },
    { label: "return", type: "keyword" },
    { label: "bool", type: "type" },
    { label: "long long", type: "type" },
    { label: "INT_MAX", type: "constant" },
    { label: "INT_MIN", type: "constant" },
  ],
  cpp: [
    { label: "vector", type: "class", detail: "std::vector<T>" },
    { label: "unordered_map", type: "class", detail: "std::unordered_map" },
    { label: "unordered_set", type: "class", detail: "std::unordered_set" },
    { label: "map", type: "class", detail: "std::map" },
    { label: "set", type: "class", detail: "std::set" },
    { label: "pair", type: "class", detail: "std::pair" },
    { label: "priority_queue", type: "class", detail: "std::priority_queue" },
    { label: "stack", type: "class", detail: "std::stack" },
    { label: "queue", type: "class", detail: "std::queue" },
    { label: "sort", type: "function", apply: "sort(.begin(), .end());" },
    { label: "max", type: "function" },
    { label: "min", type: "function" },
    { label: "push_back", type: "method" },
    { label: "emplace_back", type: "method" },
    { label: "size", type: "method" },
    { label: "for", type: "keyword", apply: "for (int i = 0; i < n; i++) {\n    \n}" },
    { label: "for_each", type: "keyword", apply: "for (auto x : arr) {\n    \n}" },
    { label: "while", type: "keyword" },
    { label: "auto", type: "keyword" },
    { label: "long long", type: "type" },
    { label: "INT_MAX", type: "constant" },
    { label: "INT_MIN", type: "constant" },
  ],
  java: [
    { label: "System.out.println", type: "function", apply: "System.out.println();" },
    { label: "Math.max", type: "function" },
    { label: "Math.min", type: "function" },
    { label: "Math.abs", type: "function" },
    { label: "Arrays.sort", type: "function" },
    { label: "Collections.sort", type: "function" },
    { label: "HashMap", type: "class" },
    { label: "HashSet", type: "class" },
    { label: "ArrayList", type: "class" },
    { label: "PriorityQueue", type: "class" },
    { label: "ArrayDeque", type: "class" },
    { label: "StringBuilder", type: "class" },
    { label: "Integer.MAX_VALUE", type: "constant" },
    { label: "Integer.MIN_VALUE", type: "constant" },
    { label: "for", type: "keyword", apply: "for (int i = 0; i < n; i++) {\n    \n}" },
    { label: "public static", type: "keyword" },
    { label: "return", type: "keyword" },
  ],
  python: [
    { label: "len", type: "function" },
    { label: "range", type: "function" },
    { label: "enumerate", type: "function" },
    { label: "zip", type: "function" },
    { label: "sorted", type: "function" },
    { label: "sum", type: "function" },
    { label: "max", type: "function" },
    { label: "min", type: "function" },
    { label: "abs", type: "function" },
    { label: "append", type: "method" },
    { label: "defaultdict", type: "class" },
    { label: "Counter", type: "class" },
    { label: "deque", type: "class" },
    { label: "heapq", type: "namespace" },
    { label: "bisect", type: "namespace" },
    { label: "def", type: "keyword" },
    { label: "for", type: "keyword", apply: "for i in range(n):\n    " },
    { label: "while", type: "keyword" },
    { label: "return", type: "keyword" },
    { label: "True", type: "keyword" },
    { label: "False", type: "keyword" },
  ],
};

export function CodeEditor({
  language,
  value,
  onChange,
  themeMode,
  fontSize,
  wordWrap,
  readOnly = false,
  extraSymbols = [],
  onRunShortcut,
}: CodeEditorProps) {
  const extensions = useMemo(() => {
    const langExt =
      language === "python"
        ? python()
        : language === "java"
        ? java()
        : cpp();

    const symbolCompletions: Completion[] = extraSymbols.map((sym) => ({
      label: sym,
      type: "variable",
      detail: "DSL symbol",
    }));

    const customSource = completeFromList([
      ...symbolCompletions,
      ...LANG_COMPLETIONS[language],
    ]);

    const wordAndCustomSource = async (context: CompletionContext) => {
      return customSource(context);
    };

    const runKeymap = keymap.of([
      indentWithTab,
      ...(onRunShortcut
        ? [
            {
              key: "Mod-Enter",
              run: () => {
                onRunShortcut();
                return true;
              },
            },
          ]
        : []),
    ]);

    const fontTheme = EditorView.theme({
      "&": {
        fontSize: `${fontSize}px`,
        height: "100%",
        backgroundColor: themeMode === "dark" ? "#1A0F0A" : "#F5E6D3",
      },
      ".cm-gutters": {
        backgroundColor: themeMode === "dark" ? "#23140D" : "#E8D5BC",
        borderRight: "1px solid #5C3D2E",
        color: themeMode === "dark" ? "#BFA98A" : "#5C3D2E",
      },
      ".cm-content, .cm-gutter": {
        fontFamily: "var(--font-fira-code), ui-monospace, SFMono-Regular, monospace",
      },
    });

    const exts = [
      langExt,
      indentUnit.of("    "),
      autocompletion({
        override: [wordAndCustomSource, completeAnyWord],
        activateOnTyping: true,
      }),
      runKeymap,
      fontTheme,
    ];

    if (wordWrap) {
      exts.push(EditorView.lineWrapping);
    }

    return exts;
  }, [language, fontSize, wordWrap, themeMode, extraSymbols, onRunShortcut]);

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={themeMode === "dark" ? oneDark : "light"}
      extensions={extensions}
      editable={!readOnly}
      onChange={(val) => onChange(val)}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        highlightActiveLine: true,
        tabSize: 4,
      }}
      className="h-full w-full overflow-hidden"
    />
  );
}
