import type { CodeStubBundle, LanguageId } from "./types";

export type DslScalarType =
  | "integer"
  | "long_integer"
  | "float"
  | "string"
  | "boolean"
  | "character"
  | "void";

export type DslArrayType =
  | "integer_array"
  | "long_integer_array"
  | "float_array"
  | "string_array"
  | "2d_integer_array"
  | "2d_long_integer_array"
  | "2d_string_array";

export type DslDataType = DslScalarType | DslArrayType;

export interface DslParam {
  type: DslDataType;
  name: string;
}

export interface DslFunctionDef {
  returnType: DslDataType;
  name: string;
  params: DslParam[];
}

export type DslAstNode =
  | { kind: "read_scalar"; dataType: Exclude<DslScalarType, "void">; name: string }
  | { kind: "read_array"; elemType: Exclude<DslScalarType, "void">; name: string; sizeExpr: string; mode: "single" | "multi" }
  | { kind: "read_2d_array"; elemType: Exclude<DslScalarType, "void">; name: string; rowsExpr: string; colsExpr: string }
  | { kind: "loop_start"; countVar: string }
  | { kind: "loop_end" }
  | { kind: "invoke"; returnType: DslDataType; targetVar: string; funcName: string; args: string[] }
  | { kind: "print"; dataType: DslDataType; varName: string };

export interface DslCompileResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  functionDef?: DslFunctionDef;
  stubs: Record<LanguageId, CodeStubBundle>;
}

export interface DslPreset {
  id: string;
  label: string;
  description: string;
  dsl: string;
}

export const DSL_PRESETS: DslPreset[] = [
  {
    id: "array_int",
    label: "1D Array -> Integer",
    description: "Reads array length n, reads n space-separated integers, invokes function, prints integer result.",
    dsl: `# Maximum Subarray / Array Reduction Pattern
function(integer, solveArray, integer n, integer_array arr)
integer(n)
Array(integer, arr, n, single)
INVOKE(integer, result, solveArray, n, arr)
print(integer, result)`,
  },
  {
    id: "multi_testcase_bool",
    label: "Loop Testcases -> Boolean",
    description: "Reads testcase count t, loops t times reading integer n, invokes boolean function, prints true/false.",
    dsl: `# Multi-Testcase Boolean Check
function(boolean, checkCondition, integer n)
loop(t)
    integer(n)
    INVOKE(boolean, result, checkCondition, n)
    print(boolean, result)
endloop`,
  },
  {
    id: "two_ints",
    label: "Two Integers -> Long Integer",
    description: "Reads two integers a and b on the same line and returns a long_integer.",
    dsl: `# Two Scalar Inputs on Same Line
function(long_integer, computePair, integer a, integer b)
integer(a) integer(b)
INVOKE(long_integer, ans, computePair, a, b)
print(long_integer, ans)`,
  },
  {
    id: "matrix_2d",
    label: "2D Matrix -> Integer",
    description: "Reads dimensions n and m, reads an n x m 2D integer matrix, and prints an integer result.",
    dsl: `# 2D Matrix Grid Traversal
function(integer, matrixSolve, integer n, integer m, 2d_integer_array grid)
integer(n) integer(m)
2DArray(integer, grid, n, m)
INVOKE(integer, result, matrixSolve, n, m, grid)
print(integer, result)`,
  },
  {
    id: "string_transform",
    label: "String Input -> String",
    description: "Reads a string token, transforms it, and prints the resulting string.",
    dsl: `# String Processing Pattern
function(string, transformString, string s)
string(s)
INVOKE(string, output, transformString, s)
print(string, output)`,
  },
];

const VALID_TYPES = new Set<string>([
  "integer",
  "long_integer",
  "float",
  "string",
  "boolean",
  "character",
  "void",
  "integer_array",
  "long_integer_array",
  "float_array",
  "string_array",
  "2d_integer_array",
  "2d_long_integer_array",
  "2d_string_array",
]);

const SCALAR_READ_TYPES = new Set<string>([
  "integer",
  "long_integer",
  "float",
  "string",
  "boolean",
  "character",
]);

function isValidIdent(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

function isArray1DType(t: DslDataType): boolean {
  return t === "integer_array" || t === "long_integer_array" || t === "float_array" || t === "string_array";
}

function isArray2DType(t: DslDataType): boolean {
  return t === "2d_integer_array" || t === "2d_long_integer_array" || t === "2d_string_array";
}

function arrayBaseType(t: DslDataType): Exclude<DslScalarType, "void"> {
  switch (t) {
    case "integer_array":
    case "2d_integer_array":
      return "integer";
    case "long_integer_array":
    case "2d_long_integer_array":
      return "long_integer";
    case "float_array":
      return "float";
    case "string_array":
    case "2d_string_array":
      return "string";
    default:
      return "integer";
  }
}

function emptyStubs(): Record<LanguageId, CodeStubBundle> {
  return {
    c: { head: "", body: "", tail: "" },
    cpp: { head: "", body: "", tail: "" },
    java: { head: "", body: "", tail: "" },
    python: { head: "", body: "", tail: "" },
  };
}

// ---------- Type mappers per language ----------

function mapTypeC(t: DslDataType): string {
  switch (t) {
    case "integer":
      return "int";
    case "long_integer":
      return "long long";
    case "float":
      return "double";
    case "boolean":
      return "bool";
    case "character":
      return "char";
    case "string":
      return "char*";
    case "void":
      return "void";
    case "integer_array":
      return "int*";
    case "long_integer_array":
      return "long long*";
    case "float_array":
      return "double*";
    case "string_array":
      return "char**";
    case "2d_integer_array":
      return "int**";
    case "2d_long_integer_array":
      return "long long**";
    case "2d_string_array":
      return "char***";
  }
}

function mapTypeCpp(t: DslDataType): string {
  switch (t) {
    case "integer":
      return "int";
    case "long_integer":
      return "long long";
    case "float":
      return "double";
    case "boolean":
      return "bool";
    case "character":
      return "char";
    case "string":
      return "string";
    case "void":
      return "void";
    case "integer_array":
      return "vector<int>";
    case "long_integer_array":
      return "vector<long long>";
    case "float_array":
      return "vector<double>";
    case "string_array":
      return "vector<string>";
    case "2d_integer_array":
      return "vector<vector<int>>";
    case "2d_long_integer_array":
      return "vector<vector<long long>>";
    case "2d_string_array":
      return "vector<vector<string>>";
  }
}

function mapTypeJava(t: DslDataType): string {
  switch (t) {
    case "integer":
      return "int";
    case "long_integer":
      return "long";
    case "float":
      return "double";
    case "boolean":
      return "boolean";
    case "character":
      return "char";
    case "string":
      return "String";
    case "void":
      return "void";
    case "integer_array":
      return "int[]";
    case "long_integer_array":
      return "long[]";
    case "float_array":
      return "double[]";
    case "string_array":
      return "String[]";
    case "2d_integer_array":
      return "int[][]";
    case "2d_long_integer_array":
      return "long[][]";
    case "2d_string_array":
      return "String[][]";
  }
}

function mapTypePythonHint(t: DslDataType): string {
  switch (t) {
    case "integer":
    case "long_integer":
      return "int";
    case "float":
      return "float";
    case "boolean":
      return "bool";
    case "character":
    case "string":
      return "str";
    case "void":
      return "None";
    case "integer_array":
    case "long_integer_array":
      return "List[int]";
    case "float_array":
      return "List[float]";
    case "string_array":
      return "List[str]";
    case "2d_integer_array":
    case "2d_long_integer_array":
      return "List[List[int]]";
    case "2d_string_array":
      return "List[List[str]]";
  }
}

function defaultReturnLiteral(lang: LanguageId, t: DslDataType): string {
  if (t === "void") return "";
  if (lang === "python") {
    switch (t) {
      case "integer":
      case "long_integer":
        return "0";
      case "float":
        return "0.0";
      case "boolean":
        return "False";
      case "character":
      case "string":
        return '""';
      default:
        return "[]";
    }
  }
  if (lang === "c") {
    switch (t) {
      case "integer":
      case "long_integer":
        return "0";
      case "float":
        return "0.0";
      case "boolean":
        return "false";
      case "character":
        return "'\\0'";
      case "string":
        return '""';
      default:
        return "NULL";
    }
  }
  if (lang === "cpp") {
    switch (t) {
      case "integer":
      case "long_integer":
        return "0";
      case "float":
        return "0.0";
      case "boolean":
        return "false";
      case "character":
        return "'\\0'";
      case "string":
        return '""';
      default:
        return "{}";
    }
  }
  // java
  switch (t) {
    case "integer":
      return "0";
    case "long_integer":
      return "0L";
    case "float":
      return "0.0";
    case "boolean":
      return "false";
    case "character":
      return "'\\0'";
    case "string":
      return '""';
    case "integer_array":
      return "new int[0]";
    case "long_integer_array":
      return "new long[0]";
    case "float_array":
      return "new double[0]";
    case "string_array":
      return "new String[0]";
    case "2d_integer_array":
      return "new int[0][0]";
    case "2d_long_integer_array":
      return "new long[0][0]";
    case "2d_string_array":
      return "new String[0][0]";
    default:
      return "null";
  }
}

// ---------- Parser ----------

export function parseDsl(dslText: string): {
  errors: string[];
  warnings: string[];
  functionDef?: DslFunctionDef;
  nodes: DslAstNode[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes: DslAstNode[] = [];
  let functionDef: DslFunctionDef | undefined;

  const lines = dslText.split(/\r?\n/);
  let loopDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let raw = lines[i].trim();
    if (!raw) continue;

    // Strip # comments (including #StartCode)
    if (raw.startsWith("#")) continue;
    const hashIdx = raw.indexOf("#");
    if (hashIdx !== -1) {
      raw = raw.slice(0, hashIdx).trim();
      if (!raw) continue;
    }

    // Handle optional braces around loop / endloop
    if (raw === "{" || raw === "}") continue;

    // Check function(...)
    if (/^function\s*\(/i.test(raw)) {
      const m = raw.match(/^function\s*\(([\s\S]*)\)\s*$/i);
      if (!m) {
        errors.push(`Line ${lineNo}: Malformed function(...) declaration.`);
        continue;
      }
      const parts = m[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (parts.length < 2) {
        errors.push(`Line ${lineNo}: function(...) requires at least return_type and function_name.`);
        continue;
      }
      const returnType = parts[0] as DslDataType;
      const funcName = parts[1];
      if (!VALID_TYPES.has(returnType)) {
        errors.push(`Line ${lineNo}: Unsupported return type "${returnType}".`);
        continue;
      }
      if (!isValidIdent(funcName)) {
        errors.push(`Line ${lineNo}: Invalid function name "${funcName}".`);
        continue;
      }
      const params: DslParam[] = [];
      for (let p = 2; p < parts.length; p++) {
        const paramTokens = parts[p].split(/\s+/).filter(Boolean);
        if (paramTokens.length !== 2) {
          errors.push(`Line ${lineNo}: Invalid parameter "${parts[p]}". Expected "<type> <name>".`);
          continue;
        }
        const [pType, pName] = paramTokens;
        if (!VALID_TYPES.has(pType) || pType === "void") {
          errors.push(`Line ${lineNo}: Unsupported parameter type "${pType}".`);
          continue;
        }
        if (!isValidIdent(pName)) {
          errors.push(`Line ${lineNo}: Invalid parameter name "${pName}".`);
          continue;
        }
        params.push({ type: pType as DslDataType, name: pName });
      }
      if (functionDef) {
        warnings.push(`Line ${lineNo}: Multiple function(...) definitions; using the latest one.`);
      }
      functionDef = { returnType, name: funcName, params };
      continue;
    }

    // Check loop(var) {?
    if (/^loop\s*\(/i.test(raw)) {
      const m = raw.match(/^loop\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*\{?\s*$/i);
      if (!m) {
        errors.push(`Line ${lineNo}: Malformed loop(variable) directive.`);
        continue;
      }
      loopDepth++;
      nodes.push({ kind: "loop_start", countVar: m[1] });
      continue;
    }

    // Check }? endloop
    if (/^(\}\s*)?endloop\s*$/i.test(raw)) {
      if (loopDepth <= 0) {
        errors.push(`Line ${lineNo}: endloop without a matching loop(...).`);
        continue;
      }
      loopDepth--;
      nodes.push({ kind: "loop_end" });
      continue;
    }

    // Check Array(Datatype, name, size, single|multi)
    if (/^Array\s*\(/i.test(raw)) {
      const m = raw.match(/^Array\s*\(([^)]+)\)\s*$/i);
      if (!m) {
        errors.push(`Line ${lineNo}: Malformed Array(...) directive.`);
        continue;
      }
      const args = m[1].split(",").map((s) => s.trim());
      if (args.length < 3 || args.length > 4) {
        errors.push(`Line ${lineNo}: Array(...) expects 3 or 4 arguments: Array(Datatype, name, size, single|multi).`);
        continue;
      }
      const [elemType, name, sizeExpr, modeRaw] = args;
      if (!SCALAR_READ_TYPES.has(elemType)) {
        errors.push(`Line ${lineNo}: Unsupported Array element type "${elemType}".`);
        continue;
      }
      if (!isValidIdent(name)) {
        errors.push(`Line ${lineNo}: Invalid array variable name "${name}".`);
        continue;
      }
      const mode = (modeRaw || "single").toLowerCase();
      if (mode !== "single" && mode !== "multi") {
        errors.push(`Line ${lineNo}: Array mode must be "single" or "multi", got "${modeRaw}".`);
        continue;
      }
      nodes.push({
        kind: "read_array",
        elemType: elemType as Exclude<DslScalarType, "void">,
        name,
        sizeExpr,
        mode: mode as "single" | "multi",
      });
      continue;
    }

    // Check 2DArray(Datatype, name, rows, cols)
    if (/^2DArray\s*\(/i.test(raw)) {
      const m = raw.match(/^2DArray\s*\(([^)]+)\)\s*$/i);
      if (!m) {
        errors.push(`Line ${lineNo}: Malformed 2DArray(...) directive.`);
        continue;
      }
      const args = m[1].split(",").map((s) => s.trim());
      if (args.length !== 4) {
        errors.push(`Line ${lineNo}: 2DArray(...) expects 4 arguments: 2DArray(Datatype, name, rows, cols).`);
        continue;
      }
      const [elemType, name, rowsExpr, colsExpr] = args;
      if (!SCALAR_READ_TYPES.has(elemType)) {
        errors.push(`Line ${lineNo}: Unsupported 2DArray element type "${elemType}".`);
        continue;
      }
      if (!isValidIdent(name)) {
        errors.push(`Line ${lineNo}: Invalid 2D array name "${name}".`);
        continue;
      }
      nodes.push({
        kind: "read_2d_array",
        elemType: elemType as Exclude<DslScalarType, "void">,
        name,
        rowsExpr,
        colsExpr,
      });
      continue;
    }

    // Check INVOKE(return_type, var_name, func_name, arg1, ...)
    if (/^INVOKE\s*\(/i.test(raw)) {
      const m = raw.match(/^INVOKE\s*\(([^)]+)\)\s*$/i);
      if (!m) {
        errors.push(`Line ${lineNo}: Malformed INVOKE(...) directive.`);
        continue;
      }
      const args = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (args.length < 3) {
        errors.push(`Line ${lineNo}: INVOKE(...) requires at least (return_type, var_name, func_name).`);
        continue;
      }
      const [retType, targetVar, funcName, ...callArgs] = args;
      if (!VALID_TYPES.has(retType)) {
        errors.push(`Line ${lineNo}: Unsupported INVOKE return type "${retType}".`);
        continue;
      }
      if (!isValidIdent(targetVar) || !isValidIdent(funcName)) {
        errors.push(`Line ${lineNo}: Invalid identifier in INVOKE(...).`);
        continue;
      }
      nodes.push({
        kind: "invoke",
        returnType: retType as DslDataType,
        targetVar,
        funcName,
        args: callArgs,
      });
      continue;
    }

    // Check print(datatype, var_name)
    if (/^print\s*\(/i.test(raw)) {
      const m = raw.match(/^print\s*\(([^)]+)\)\s*$/i);
      if (!m) {
        errors.push(`Line ${lineNo}: Malformed print(...) directive.`);
        continue;
      }
      const args = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (args.length !== 2) {
        errors.push(`Line ${lineNo}: print(...) expects 2 arguments: print(datatype, variable_name).`);
        continue;
      }
      const [dataType, varName] = args;
      if (!VALID_TYPES.has(dataType) || dataType === "void") {
        errors.push(`Line ${lineNo}: Unsupported print datatype "${dataType}".`);
        continue;
      }
      if (!isValidIdent(varName)) {
        errors.push(`Line ${lineNo}: Invalid print variable "${varName}".`);
        continue;
      }
      nodes.push({
        kind: "print",
        dataType: dataType as DslDataType,
        varName,
      });
      continue;
    }

    // Otherwise, check 1..4 scalar reads on a line: e.g. "integer(n) integer(m)"
    const scalarPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
    const matches = Array.from(raw.matchAll(scalarPattern));
    const reconstructed = matches.map((mt) => mt[0]).join(" ").replace(/\s+/g, "");
    const normalizedRaw = raw.replace(/\s+/g, "");
    if (matches.length > 0 && reconstructed === normalizedRaw) {
      if (matches.length > 4) {
        warnings.push(`Line ${lineNo}: HackerRank DSL recommends at most 4 scalar variables per line.`);
      }
      for (const mt of matches) {
        const dt = mt[1];
        const vName = mt[2];
        if (!SCALAR_READ_TYPES.has(dt)) {
          errors.push(`Line ${lineNo}: Unsupported scalar read directive "${dt}(${vName})".`);
          continue;
        }
        nodes.push({
          kind: "read_scalar",
          dataType: dt as Exclude<DslScalarType, "void">,
          name: vName,
        });
      }
      continue;
    }

    errors.push(`Line ${lineNo}: Unrecognized DSL statement "${raw}".`);
  }

  if (loopDepth > 0) {
    errors.push(`Unclosed loop(...) block — missing ${loopDepth} endloop statement(s).`);
  }
  if (!functionDef) {
    errors.push(`Missing function(return_type, function_name, ...) declaration.`);
  }

  return { errors, warnings, functionDef, nodes };
}

// ---------- Code Generators ----------

function buildCStub(fn: DslFunctionDef, nodes: DslAstNode[]): CodeStubBundle {
  const head = [
    "#include <stdio.h>",
    "#include <stdlib.h>",
    "#include <stdbool.h>",
    "#include <string.h>",
  ].join("\n");

  const returns1DArray = isArray1DType(fn.returnType);
  const cParams = fn.params.map((p) => `${mapTypeC(p.type)} ${p.name}`);
  if (returns1DArray) {
    cParams.push("int* result_count");
  }
  const paramSig = cParams.length > 0 ? cParams.join(", ") : "void";
  const retC = mapTypeC(fn.returnType);
  const retLit = defaultReturnLiteral("c", fn.returnType);

  const bodyLines = [
    `${retC} ${fn.name}(${paramSig}) {`,
    `    // Write your code here`,
  ];
  if (fn.returnType !== "void") {
    if (returns1DArray) {
      bodyLines.push(`    *result_count = 0;`);
    }
    bodyLines.push(`    return ${retLit};`);
  }
  bodyLines.push(`}`);
  const body = bodyLines.join("\n");

  // Tail (main driver)
  const tailLines: string[] = ["int main(void) {"];
  let indent = "    ";
  const declaredVars = new Set<string>();
  const arraySizeMap = new Map<string, string>(); // arrayName -> sizeExpr
  const array2DDimMap = new Map<string, { rows: string; cols: string }>();

  for (const node of nodes) {
    if (node.kind === "loop_start") {
      if (!declaredVars.has(node.countVar)) {
        tailLines.push(`${indent}int ${node.countVar} = 0;`);
        declaredVars.add(node.countVar);
      }
      tailLines.push(`${indent}if (scanf("%d", &${node.countVar}) != 1) return 0;`);
      tailLines.push(`${indent}for (int _tc_${node.countVar} = 0; _tc_${node.countVar} < ${node.countVar}; _tc_${node.countVar}++) {`);
      indent += "    ";
    } else if (node.kind === "loop_end") {
      indent = indent.slice(0, Math.max(4, indent.length - 4));
      tailLines.push(`${indent}}`);
    } else if (node.kind === "read_scalar") {
      const cType = mapTypeC(node.dataType);
      if (!declaredVars.has(node.name)) {
        if (node.dataType === "string") {
          tailLines.push(`${indent}char* ${node.name} = (char*)malloc(100005 * sizeof(char));`);
        } else if (node.dataType === "boolean") {
          tailLines.push(`${indent}bool ${node.name} = false;`);
        } else {
          tailLines.push(`${indent}${cType} ${node.name} = ${defaultReturnLiteral("c", node.dataType)};`);
        }
        declaredVars.add(node.name);
      }
      if (node.dataType === "integer") {
        tailLines.push(`${indent}scanf("%d", &${node.name});`);
      } else if (node.dataType === "long_integer") {
        tailLines.push(`${indent}scanf("%lld", &${node.name});`);
      } else if (node.dataType === "float") {
        tailLines.push(`${indent}scanf("%lf", &${node.name});`);
      } else if (node.dataType === "character") {
        tailLines.push(`${indent}scanf(" %c", &${node.name});`);
      } else if (node.dataType === "string") {
        tailLines.push(`${indent}scanf("%100004s", ${node.name});`);
      } else if (node.dataType === "boolean") {
        tailLines.push(`${indent}{ char _b[16]; scanf("%15s", _b); ${node.name} = (strcmp(_b, "true") == 0 || strcmp(_b, "1") == 0); }`);
      }
    } else if (node.kind === "read_array") {
      const baseC = mapTypeC(node.elemType);
      arraySizeMap.set(node.name, node.sizeExpr);
      tailLines.push(`${indent}${baseC}* ${node.name} = (${baseC}*)malloc((size_t)(${node.sizeExpr} > 0 ? ${node.sizeExpr} : 1) * sizeof(${baseC}));`);
      tailLines.push(`${indent}for (int _i = 0; _i < ${node.sizeExpr}; _i++) {`);
      if (node.elemType === "integer") {
        tailLines.push(`${indent}    scanf("%d", &${node.name}[_i]);`);
      } else if (node.elemType === "long_integer") {
        tailLines.push(`${indent}    scanf("%lld", &${node.name}[_i]);`);
      } else if (node.elemType === "float") {
        tailLines.push(`${indent}    scanf("%lf", &${node.name}[_i]);`);
      } else if (node.elemType === "character") {
        tailLines.push(`${indent}    scanf(" %c", &${node.name}[_i]);`);
      } else if (node.elemType === "string") {
        tailLines.push(`${indent}    ${node.name}[_i] = (char*)malloc(1024 * sizeof(char));`);
        tailLines.push(`${indent}    scanf("%1023s", ${node.name}[_i]);`);
      } else if (node.elemType === "boolean") {
        tailLines.push(`${indent}    char _b[16]; scanf("%15s", _b); ${node.name}[_i] = (strcmp(_b, "true") == 0 || strcmp(_b, "1") == 0);`);
      }
      tailLines.push(`${indent}}`);
    } else if (node.kind === "read_2d_array") {
      const baseC = mapTypeC(node.elemType);
      array2DDimMap.set(node.name, { rows: node.rowsExpr, cols: node.colsExpr });
      tailLines.push(`${indent}${baseC}** ${node.name} = (${baseC}**)malloc((size_t)(${node.rowsExpr} > 0 ? ${node.rowsExpr} : 1) * sizeof(${baseC}*));`);
      tailLines.push(`${indent}for (int _r = 0; _r < ${node.rowsExpr}; _r++) {`);
      tailLines.push(`${indent}    ${node.name}[_r] = (${baseC}*)malloc((size_t)(${node.colsExpr} > 0 ? ${node.colsExpr} : 1) * sizeof(${baseC}));`);
      tailLines.push(`${indent}    for (int _c = 0; _c < ${node.colsExpr}; _c++) {`);
      if (node.elemType === "integer") {
        tailLines.push(`${indent}        scanf("%d", &${node.name}[_r][_c]);`);
      } else if (node.elemType === "long_integer") {
        tailLines.push(`${indent}        scanf("%lld", &${node.name}[_r][_c]);`);
      } else if (node.elemType === "float") {
        tailLines.push(`${indent}        scanf("%lf", &${node.name}[_r][_c]);`);
      } else if (node.elemType === "string") {
        tailLines.push(`${indent}        ${node.name}[_r][_c] = (char*)malloc(1024 * sizeof(char));`);
        tailLines.push(`${indent}        scanf("%1023s", ${node.name}[_r][_c]);`);
      } else if (node.elemType === "character") {
        tailLines.push(`${indent}        scanf(" %c", &${node.name}[_r][_c]);`);
      } else if (node.elemType === "boolean") {
        tailLines.push(`${indent}        char _b[16]; scanf("%15s", _b); ${node.name}[_r][_c] = (strcmp(_b, "true") == 0 || strcmp(_b, "1") == 0);`);
      }
      tailLines.push(`${indent}    }`);
      tailLines.push(`${indent}}`);
    } else if (node.kind === "invoke") {
      const callArgs = [...node.args];
      if (isArray1DType(node.returnType)) {
        tailLines.push(`${indent}int _${node.targetVar}_count = 0;`);
        callArgs.push(`&_${node.targetVar}_count`);
      }
      if (node.returnType === "void") {
        tailLines.push(`${indent}${node.funcName}(${callArgs.join(", ")});`);
      } else {
        const retTypeC = mapTypeC(node.returnType);
        tailLines.push(`${indent}${retTypeC} ${node.targetVar} = ${node.funcName}(${callArgs.join(", ")});`);
      }
    } else if (node.kind === "print") {
      if (node.dataType === "integer") {
        tailLines.push(`${indent}printf("%d\\n", ${node.varName});`);
      } else if (node.dataType === "long_integer") {
        tailLines.push(`${indent}printf("%lld\\n", ${node.varName});`);
      } else if (node.dataType === "float") {
        tailLines.push(`${indent}printf("%g\\n", ${node.varName});`);
      } else if (node.dataType === "character") {
        tailLines.push(`${indent}printf("%c\\n", ${node.varName});`);
      } else if (node.dataType === "string") {
        tailLines.push(`${indent}printf("%s\\n", ${node.varName});`);
      } else if (node.dataType === "boolean") {
        tailLines.push(`${indent}printf("%s\\n", ${node.varName} ? "true" : "false");`);
      } else if (isArray1DType(node.dataType)) {
        const lenExpr = arraySizeMap.get(node.varName) ?? `_${node.varName}_count`;
        const base = arrayBaseType(node.dataType);
        const fmt = base === "long_integer" ? "%lld" : base === "float" ? "%g" : base === "string" ? "%s" : "%d";
        tailLines.push(`${indent}for (int _pi = 0; _pi < ${lenExpr}; _pi++) printf("%s${fmt}", _pi ? " " : "", ${node.varName}[_pi]);`);
        tailLines.push(`${indent}printf("\\n");`);
      } else if (isArray2DType(node.dataType)) {
        const dims = array2DDimMap.get(node.varName) ?? { rows: "n", cols: "m" };
        const base = arrayBaseType(node.dataType);
        const fmt = base === "long_integer" ? "%lld" : base === "string" ? "%s" : "%d";
        tailLines.push(`${indent}for (int _pr = 0; _pr < ${dims.rows}; _pr++) {`);
        tailLines.push(`${indent}    for (int _pc = 0; _pc < ${dims.cols}; _pc++) printf("%s${fmt}", _pc ? " " : "", ${node.varName}[_pr][_pc]);`);
        tailLines.push(`${indent}    printf("\\n");`);
        tailLines.push(`${indent}}`);
      }
    }
  }

  tailLines.push("    return 0;");
  tailLines.push("}");

  return { head, body, tail: tailLines.join("\n") };
}

function buildCppStub(fn: DslFunctionDef, nodes: DslAstNode[]): CodeStubBundle {
  const head = [
    "#include <iostream>",
    "#include <vector>",
    "#include <string>",
    "#include <algorithm>",
    "#include <climits>",
    "using namespace std;",
  ].join("\n");

  const cppParams = fn.params.map((p) => `${mapTypeCpp(p.type)} ${p.name}`).join(", ");
  const retCpp = mapTypeCpp(fn.returnType);
  const retLit = defaultReturnLiteral("cpp", fn.returnType);

  const bodyLines = [
    `${retCpp} ${fn.name}(${cppParams}) {`,
    `    // Write your code here`,
  ];
  if (fn.returnType !== "void") {
    bodyLines.push(`    return ${retLit};`);
  }
  bodyLines.push(`}`);
  const body = bodyLines.join("\n");

  const tailLines: string[] = [
    "int main() {",
    "    ios_base::sync_with_stdio(false);",
    "    cin.tie(NULL);",
  ];
  let indent = "    ";
  const declaredVars = new Set<string>();

  for (const node of nodes) {
    if (node.kind === "loop_start") {
      if (!declaredVars.has(node.countVar)) {
        tailLines.push(`${indent}int ${node.countVar} = 0;`);
        declaredVars.add(node.countVar);
      }
      tailLines.push(`${indent}if (!(cin >> ${node.countVar})) return 0;`);
      tailLines.push(`${indent}for (int _tc_${node.countVar} = 0; _tc_${node.countVar} < ${node.countVar}; _tc_${node.countVar}++) {`);
      indent += "    ";
    } else if (node.kind === "loop_end") {
      indent = indent.slice(0, Math.max(4, indent.length - 4));
      tailLines.push(`${indent}}`);
    } else if (node.kind === "read_scalar") {
      const cppType = mapTypeCpp(node.dataType);
      if (!declaredVars.has(node.name)) {
        tailLines.push(`${indent}${cppType} ${node.name};`);
        declaredVars.add(node.name);
      }
      if (node.dataType === "boolean") {
        tailLines.push(`${indent}{ string _b; cin >> _b; ${node.name} = (_b == "true" || _b == "1"); }`);
      } else {
        tailLines.push(`${indent}cin >> ${node.name};`);
      }
    } else if (node.kind === "read_array") {
      const baseCpp = mapTypeCpp(node.elemType);
      tailLines.push(`${indent}vector<${baseCpp}> ${node.name}(${node.sizeExpr});`);
      tailLines.push(`${indent}for (int _i = 0; _i < (int)(${node.sizeExpr}); _i++) {`);
      if (node.elemType === "boolean") {
        tailLines.push(`${indent}    string _b; cin >> _b; ${node.name}[_i] = (_b == "true" || _b == "1");`);
      } else {
        tailLines.push(`${indent}    cin >> ${node.name}[_i];`);
      }
      tailLines.push(`${indent}}`);
    } else if (node.kind === "read_2d_array") {
      const baseCpp = mapTypeCpp(node.elemType);
      tailLines.push(`${indent}vector<vector<${baseCpp}>> ${node.name}(${node.rowsExpr}, vector<${baseCpp}>(${node.colsExpr}));`);
      tailLines.push(`${indent}for (int _r = 0; _r < (int)(${node.rowsExpr}); _r++) {`);
      tailLines.push(`${indent}    for (int _c = 0; _c < (int)(${node.colsExpr}); _c++) {`);
      if (node.elemType === "boolean") {
        tailLines.push(`${indent}        string _b; cin >> _b; ${node.name}[_r][_c] = (_b == "true" || _b == "1");`);
      } else {
        tailLines.push(`${indent}        cin >> ${node.name}[_r][_c];`);
      }
      tailLines.push(`${indent}    }`);
      tailLines.push(`${indent}}`);
    } else if (node.kind === "invoke") {
      if (node.returnType === "void") {
        tailLines.push(`${indent}${node.funcName}(${node.args.join(", ")});`);
      } else {
        const retTypeCpp = mapTypeCpp(node.returnType);
        tailLines.push(`${indent}${retTypeCpp} ${node.targetVar} = ${node.funcName}(${node.args.join(", ")});`);
      }
    } else if (node.kind === "print") {
      if (node.dataType === "boolean") {
        tailLines.push(`${indent}cout << (${node.varName} ? "true" : "false") << "\\n";`);
      } else if (isArray1DType(node.dataType)) {
        tailLines.push(`${indent}for (size_t _pi = 0; _pi < ${node.varName}.size(); _pi++) cout << (_pi ? " " : "") << ${node.varName}[_pi];`);
        tailLines.push(`${indent}cout << "\\n";`);
      } else if (isArray2DType(node.dataType)) {
        tailLines.push(`${indent}for (size_t _pr = 0; _pr < ${node.varName}.size(); _pr++) {`);
        tailLines.push(`${indent}    for (size_t _pc = 0; _pc < ${node.varName}[_pr].size(); _pc++) cout << (_pc ? " " : "") << ${node.varName}[_pr][_pc];`);
        tailLines.push(`${indent}    cout << "\\n";`);
        tailLines.push(`${indent}}`);
      } else {
        tailLines.push(`${indent}cout << ${node.varName} << "\\n";`);
      }
    }
  }

  tailLines.push("    return 0;");
  tailLines.push("}");

  return { head, body, tail: tailLines.join("\n") };
}

function buildJavaStub(fn: DslFunctionDef, nodes: DslAstNode[]): CodeStubBundle {
  const head = [
    "import java.io.*;",
    "import java.util.*;",
  ].join("\n");

  const javaParams = fn.params.map((p) => `${mapTypeJava(p.type)} ${p.name}`).join(", ");
  const retJava = mapTypeJava(fn.returnType);
  const retLit = defaultReturnLiteral("java", fn.returnType);

  const bodyLines = [
    `class Result {`,
    `    public static ${retJava} ${fn.name}(${javaParams}) {`,
    `        // Write your code here`,
  ];
  if (fn.returnType !== "void") {
    bodyLines.push(`        return ${retLit};`);
  }
  bodyLines.push(`    }`);
  bodyLines.push(`}`);
  const body = bodyLines.join("\n");

  const tailLines: string[] = [
    "public class Main {",
    "    private static BufferedReader br = new BufferedReader(new InputStreamReader(System.in));",
    "    private static StringTokenizer st;",
    "    private static String nextToken() throws IOException {",
    "        while (st == null || !st.hasMoreTokens()) {",
    "            String line = br.readLine();",
    "            if (line == null) return null;",
    "            st = new StringTokenizer(line);",
    "        }",
    "        return st.nextToken();",
    "    }",
    "    public static void main(String[] args) throws IOException {",
  ];
  let indent = "        ";
  const declaredVars = new Set<string>();

  const readTokenExpr = (dt: Exclude<DslScalarType, "void">): string => {
    switch (dt) {
      case "integer":
        return "Integer.parseInt(nextToken())";
      case "long_integer":
        return "Long.parseLong(nextToken())";
      case "float":
        return "Double.parseDouble(nextToken())";
      case "character":
        return "nextToken().charAt(0)";
      case "string":
        return "nextToken()";
      case "boolean":
        return 'nextToken().equalsIgnoreCase("true")';
    }
  };

  for (const node of nodes) {
    if (node.kind === "loop_start") {
      if (!declaredVars.has(node.countVar)) {
        tailLines.push(`${indent}String _tStr_${node.countVar} = nextToken();`);
        tailLines.push(`${indent}if (_tStr_${node.countVar} == null) return;`);
        tailLines.push(`${indent}int ${node.countVar} = Integer.parseInt(_tStr_${node.countVar});`);
        declaredVars.add(node.countVar);
      } else {
        tailLines.push(`${indent}${node.countVar} = Integer.parseInt(nextToken());`);
      }
      tailLines.push(`${indent}for (int _tc_${node.countVar} = 0; _tc_${node.countVar} < ${node.countVar}; _tc_${node.countVar}++) {`);
      indent += "    ";
    } else if (node.kind === "loop_end") {
      indent = indent.slice(0, Math.max(8, indent.length - 4));
      tailLines.push(`${indent}}`);
    } else if (node.kind === "read_scalar") {
      const jType = mapTypeJava(node.dataType);
      const expr = readTokenExpr(node.dataType);
      if (!declaredVars.has(node.name)) {
        tailLines.push(`${indent}${jType} ${node.name} = ${expr};`);
        declaredVars.add(node.name);
      } else {
        tailLines.push(`${indent}${node.name} = ${expr};`);
      }
    } else if (node.kind === "read_array") {
      const jElem = mapTypeJava(node.elemType);
      const expr = readTokenExpr(node.elemType);
      tailLines.push(`${indent}${jElem}[] ${node.name} = new ${jElem}[${node.sizeExpr}];`);
      tailLines.push(`${indent}for (int _i = 0; _i < ${node.sizeExpr}; _i++) {`);
      tailLines.push(`${indent}    ${node.name}[_i] = ${expr};`);
      tailLines.push(`${indent}}`);
    } else if (node.kind === "read_2d_array") {
      const jElem = mapTypeJava(node.elemType);
      const expr = readTokenExpr(node.elemType);
      tailLines.push(`${indent}${jElem}[][] ${node.name} = new ${jElem}[${node.rowsExpr}][${node.colsExpr}];`);
      tailLines.push(`${indent}for (int _r = 0; _r < ${node.rowsExpr}; _r++) {`);
      tailLines.push(`${indent}    for (int _c = 0; _c < ${node.colsExpr}; _c++) {`);
      tailLines.push(`${indent}        ${node.name}[_r][_c] = ${expr};`);
      tailLines.push(`${indent}    }`);
      tailLines.push(`${indent}}`);
    } else if (node.kind === "invoke") {
      if (node.returnType === "void") {
        tailLines.push(`${indent}Result.${node.funcName}(${node.args.join(", ")});`);
      } else {
        const retTypeJ = mapTypeJava(node.returnType);
        tailLines.push(`${indent}${retTypeJ} ${node.targetVar} = Result.${node.funcName}(${node.args.join(", ")});`);
      }
    } else if (node.kind === "print") {
      if (node.dataType === "boolean") {
        tailLines.push(`${indent}System.out.println(${node.varName} ? "true" : "false");`);
      } else if (isArray1DType(node.dataType)) {
        tailLines.push(`${indent}StringBuilder _sb_${node.varName} = new StringBuilder();`);
        tailLines.push(`${indent}for (int _pi = 0; _pi < ${node.varName}.length; _pi++) {`);
        tailLines.push(`${indent}    if (_pi > 0) _sb_${node.varName}.append(" ");`);
        tailLines.push(`${indent}    _sb_${node.varName}.append(${node.varName}[_pi]);`);
        tailLines.push(`${indent}}`);
        tailLines.push(`${indent}System.out.println(_sb_${node.varName}.toString());`);
      } else if (isArray2DType(node.dataType)) {
        tailLines.push(`${indent}for (int _pr = 0; _pr < ${node.varName}.length; _pr++) {`);
        tailLines.push(`${indent}    StringBuilder _sb = new StringBuilder();`);
        tailLines.push(`${indent}    for (int _pc = 0; _pc < ${node.varName}[_pr].length; _pc++) {`);
        tailLines.push(`${indent}        if (_pc > 0) _sb.append(" ");`);
        tailLines.push(`${indent}        _sb.append(${node.varName}[_pr][_pc]);`);
        tailLines.push(`${indent}    }`);
        tailLines.push(`${indent}    System.out.println(_sb.toString());`);
        tailLines.push(`${indent}}`);
      } else {
        tailLines.push(`${indent}System.out.println(${node.varName});`);
      }
    }
  }

  tailLines.push("    }");
  tailLines.push("}");

  return { head, body, tail: tailLines.join("\n") };
}

function buildPythonStub(fn: DslFunctionDef, nodes: DslAstNode[]): CodeStubBundle {
  const head = [
    "import sys",
    "from typing import List",
  ].join("\n");

  const pyParams = fn.params.map((p) => `${p.name}: ${mapTypePythonHint(p.type)}`).join(", ");
  const retHint = mapTypePythonHint(fn.returnType);
  const retLit = defaultReturnLiteral("python", fn.returnType);

  const bodyLines = [
    `def ${fn.name}(${pyParams}) -> ${retHint}:`,
    `    # Write your code here`,
    fn.returnType === "void" ? `    pass` : `    return ${retLit}`,
  ];
  const body = bodyLines.join("\n");

  const tailLines: string[] = [
    `if __name__ == "__main__":`,
    `    _tokens = iter(sys.stdin.read().split())`,
    `    def _next():`,
    `        return next(_tokens, None)`,
  ];
  let indent = "    ";

  const pyCast = (dt: Exclude<DslScalarType, "void">, expr: string): string => {
    switch (dt) {
      case "integer":
      case "long_integer":
        return `int(${expr})`;
      case "float":
        return `float(${expr})`;
      case "boolean":
        return `(${expr}.lower() in ("true", "1"))`;
      case "character":
        return `${expr}[0]`;
      case "string":
        return `${expr}`;
    }
  };

  for (const node of nodes) {
    if (node.kind === "loop_start") {
      tailLines.push(`${indent}_t_raw = _next()`);
      tailLines.push(`${indent}if _t_raw is not None:`);
      tailLines.push(`${indent}    ${node.countVar} = int(_t_raw)`);
      tailLines.push(`${indent}    for _tc_${node.countVar} in range(${node.countVar}):`);
      indent += "        ";
    } else if (node.kind === "loop_end") {
      indent = indent.slice(0, Math.max(4, indent.length - 8));
    } else if (node.kind === "read_scalar") {
      tailLines.push(`${indent}${node.name} = ${pyCast(node.dataType, "_next()")}`);
    } else if (node.kind === "read_array") {
      const castExpr = pyCast(node.elemType, "_next()");
      tailLines.push(`${indent}${node.name} = [${castExpr} for _ in range(${node.sizeExpr})]`);
    } else if (node.kind === "read_2d_array") {
      const castExpr = pyCast(node.elemType, "_next()");
      tailLines.push(`${indent}${node.name} = [[${castExpr} for _ in range(${node.colsExpr})] for _ in range(${node.rowsExpr})]`);
    } else if (node.kind === "invoke") {
      if (node.returnType === "void") {
        tailLines.push(`${indent}${node.funcName}(${node.args.join(", ")})`);
      } else {
        tailLines.push(`${indent}${node.targetVar} = ${node.funcName}(${node.args.join(", ")})`);
      }
    } else if (node.kind === "print") {
      if (node.dataType === "boolean") {
        tailLines.push(`${indent}print("true" if ${node.varName} else "false")`);
      } else if (isArray1DType(node.dataType)) {
        tailLines.push(`${indent}print(" ".join(map(str, ${node.varName})))`);
      } else if (isArray2DType(node.dataType)) {
        tailLines.push(`${indent}for _row in ${node.varName}:`);
        tailLines.push(`${indent}    print(" ".join(map(str, _row)))`);
      } else {
        tailLines.push(`${indent}print(${node.varName})`);
      }
    }
  }

  return { head, body, tail: tailLines.join("\n") };
}

export function compileDslToStubs(dslText: string): DslCompileResult {
  const parsed = parseDsl(dslText);
  if (parsed.errors.length > 0 || !parsed.functionDef) {
    return {
      valid: false,
      errors: parsed.errors,
      warnings: parsed.warnings,
      functionDef: parsed.functionDef,
      stubs: emptyStubs(),
    };
  }

  const fn = parsed.functionDef;
  const stubs: Record<LanguageId, CodeStubBundle> = {
    c: buildCStub(fn, parsed.nodes),
    cpp: buildCppStub(fn, parsed.nodes),
    java: buildJavaStub(fn, parsed.nodes),
    python: buildPythonStub(fn, parsed.nodes),
  };

  return {
    valid: true,
    errors: [],
    warnings: parsed.warnings,
    functionDef: fn,
    stubs,
  };
}
