import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const builtinModuleSet = new Set(builtinModules);

const targetFiles = [
  "lib/ai/public-demo-service.ts",
  "app/api/demo/generate/route.ts",
  "app/api/demo/artifacts/route.ts",
  "components/project/PublicDemoHeader.tsx",
  "components/project/PublicServiceDemoClient.tsx",
  "components/project/MilitaryAIDemoClient.tsx",
  "app/military-ai-demo/page.tsx",
  "app/ops-radar-demo/page.tsx",
  "app/admin-doc-demo/page.tsx",
  "app/after-action-demo/page.tsx",
];

const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
  console.error("FAIL public demo TypeScript import/syntax smoke: tsconfig.json not found");
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root, {
  noEmit: false,
}, configPath);
const compilerOptions = {
  ...parsed.options,
  noEmit: false,
  sourceMap: false,
  inlineSourceMap: false,
};

function scriptKindFor(fileName) {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
}

function moduleSpecifierNodes(sourceFile) {
  const nodes = [];

  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      nodes.push(node.moduleSpecifier);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      nodes.push(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return nodes;
}

function unresolvedImportDiagnostic(sourceFile, specifierNode) {
  return {
    category: ts.DiagnosticCategory.Error,
    code: 91001,
    file: sourceFile,
    start: specifierNode.getStart(sourceFile),
    length: specifierNode.getWidth(sourceFile),
    messageText: `Unable to resolve import ${specifierNode.text}`,
  };
}

const diagnostics = [];

for (const relativePath of targetFiles) {
  const fileName = path.resolve(root, relativePath);
  if (!fs.existsSync(fileName)) {
    diagnostics.push({
      category: ts.DiagnosticCategory.Error,
      code: 91000,
      file: undefined,
      start: undefined,
      length: undefined,
      messageText: `Missing target file ${relativePath}`,
    });
    continue;
  }

  const sourceText = fs.readFileSync(fileName, "utf8");
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    compilerOptions.target ?? ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName),
  );

  diagnostics.push(...sourceFile.parseDiagnostics);

  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions,
    fileName,
    reportDiagnostics: true,
  });
  diagnostics.push(...(transpiled.diagnostics ?? []));

  for (const specifierNode of moduleSpecifierNodes(sourceFile)) {
    if (specifierNode.text.startsWith("node:") || builtinModuleSet.has(specifierNode.text)) {
      continue;
    }
    const resolved = ts.resolveModuleName(specifierNode.text, fileName, compilerOptions, ts.sys);
    if (!resolved.resolvedModule) {
      diagnostics.push(unresolvedImportDiagnostic(sourceFile, specifierNode));
    }
  }
}

if (diagnostics.length > 0) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  };
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  console.error(`FAIL public demo TypeScript import/syntax smoke: ${diagnostics.length} diagnostic(s)`);
  process.exit(1);
}

console.log(`PASS public demo TypeScript import/syntax smoke (${targetFiles.length} files)`);
