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
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
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

const questDarkHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.controlKeyword],
    color: "#EAA92C",
    fontWeight: "600",
  },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: "#F5E6D3",
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "#FCD34D",
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name), tags.bool],
    color: "#F87171",
  },
  {
    tag: [tags.definition(tags.name), tags.separator],
    color: "#F5E6D3",
  },
  {
    tag: [tags.typeName, tags.className, tags.changed, tags.annotation, tags.self, tags.namespace],
    color: "#F59E0B",
  },
  {
    tag: [tags.number, tags.float, tags.integer],
    color: "#FB923C",
  },
  {
    tag: [tags.operator, tags.url, tags.escape, tags.regexp],
    color: "#D6A87C",
  },
  {
    tag: [tags.meta, tags.comment],
    color: "#8C735B",
    fontStyle: "italic",
  },
  {
    tag: [tags.string, tags.inserted],
    color: "#4ADE80",
  },
  {
    tag: tags.invalid,
    color: "#FCA5A5",
  },
]);

const questLightHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.controlKeyword],
    color: "#991B1B",
    fontWeight: "600",
  },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: "#2A1810",
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "#92400E",
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name), tags.bool],
    color: "#B91C1C",
  },
  {
    tag: [tags.typeName, tags.className, tags.annotation, tags.self, tags.namespace],
    color: "#B45309",
  },
  {
    tag: [tags.number, tags.float, tags.integer],
    color: "#C2410C",
  },
  {
    tag: [tags.meta, tags.comment],
    color: "#7C5E46",
    fontStyle: "italic",
  },
  {
    tag: [tags.string, tags.inserted],
    color: "#15803D",
  },
]);

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

    const isDark = themeMode === "dark";

    const questEditorTheme = EditorView.theme(
      {
        "&": {
          fontSize: `${fontSize}px`,
          height: "100%",
          backgroundColor: isDark ? "#110A07" : "#F5E6D3",
          color: isDark ? "#F5E6D3" : "#2A1810",
        },
        ".cm-content": {
          caretColor: isDark ? "#DAA520" : "#991B1B",
          fontFamily: "var(--font-fira-code), ui-monospace, SFMono-Regular, monospace",
        },
        ".cm-cursor, .cm-dropCursor": {
          borderLeftColor: isDark ? "#DAA520" : "#991B1B",
        },
        "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
          {
            backgroundColor: isDark
              ? "rgba(202, 138, 4, 0.25)"
              : "rgba(202, 138, 4, 0.28)",
          },
        ".cm-activeLine": {
          backgroundColor: isDark
            ? "rgba(202, 138, 4, 0.06)"
            : "rgba(184, 120, 10, 0.08)",
        },
        ".cm-gutters": {
          backgroundColor: isDark ? "#160C08" : "#E8D5BC",
          borderRight: "1px solid #462E22",
          color: isDark ? "#8C735B" : "#462E22",
          fontFamily: "var(--font-fira-code), ui-monospace, SFMono-Regular, monospace",
        },
        ".cm-activeLineGutter": {
          backgroundColor: isDark ? "#2A1810" : "#DEC5A3",
          color: isDark ? "#DAA520" : "#92400E",
        },
        ".cm-foldPlaceholder": {
          backgroundColor: isDark ? "#1D110B" : "#E8D5BC",
          border: "1px solid #462E22",
          color: "#CA8A04",
        },
        ".cm-tooltip": {
          backgroundColor: isDark ? "#1D110B" : "#F5E6D3",
          border: "1px solid #462E22",
          color: isDark ? "#F5E6D3" : "#2A1810",
        },
        ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
          backgroundColor: isDark ? "#2A1810" : "#E8D5BC",
          color: isDark ? "#DAA520" : "#92400E",
        },
        "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
          backgroundColor: "rgba(202, 138, 4, 0.22)",
          outline: "1px solid rgba(218, 165, 32, 0.5)",
        },
      },
      { dark: isDark }
    );

    const exts = [
      langExt,
      indentUnit.of("    "),
      autocompletion({
        override: [wordAndCustomSource, completeAnyWord],
        activateOnTyping: true,
      }),
      runKeymap,
      questEditorTheme,
      syntaxHighlighting(
        isDark ? questDarkHighlightStyle : questLightHighlightStyle
      ),
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
      theme="none"
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
