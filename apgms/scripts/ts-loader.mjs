import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const extensions = new Set([".ts", ".tsx"]);

export async function resolve(specifier, context, defaultResolve) {
  const ext = path.extname(specifier);
  if (extensions.has(ext)) {
    const url = new URL(specifier, context.parentURL ?? pathToFileURL(process.cwd() + "/"));
    return { url: url.href, shortCircuit: true };
  }
  if (!ext && (specifier.startsWith("./") || specifier.startsWith("../"))) {
    const withTs = new URL(`${specifier}.ts`, context.parentURL ?? pathToFileURL(process.cwd() + "/"));
    return { url: withTs.href, shortCircuit: true };
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (extensions.has(path.extname(url))) {
    const filename = fileURLToPath(url);
    const source = await readFile(filename, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        sourceMap: true,
        inlineSourceMap: true,
        inlineSources: true,
      },
      fileName: filename,
    });
    return {
      format: "module",
      source: transpiled.outputText,
      shortCircuit: true,
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
