import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

type EvidenceFile = {
  path: string;
  size: number;
  mtime: string;
  sha256: string;
};

type EvidenceCategory = {
  key: string;
  description: string;
  matcher: (filePath: string) => boolean;
  selectLatestOnly?: boolean;
};

type Manifest = {
  generatedAt: string;
  repoRoot: string;
  items: Record<string, {
    status: "collected" | "missing";
    description: string;
    files: EvidenceFile[];
  }>;
};

const repoRoot = path.resolve(__dirname, "..");
const evidenceOutputDir = path.join(repoRoot, "docs", "ato", "evidence");
const manifestPath = path.join(evidenceOutputDir, "manifest.json");

const categories: EvidenceCategory[] = [
  {
    key: "sbom",
    description: "Latest Software Bill of Materials export.",
    matcher: (filePath) => path.basename(filePath) === "sbom.json",
    selectLatestOnly: true,
  },
  {
    key: "sca",
    description: "Software Composition Analysis results.",
    matcher: (filePath) => path.basename(filePath) === "sca.json",
    selectLatestOnly: true,
  },
  {
    key: "redteam_reports",
    description: "Red team assessment artefacts.",
    matcher: (filePath) => /red[-_]?team|red[-_]?report/i.test(path.basename(filePath)),
  },
  {
    key: "golden_reports",
    description: "Golden path / positive control reports.",
    matcher: (filePath) => /golden/i.test(path.basename(filePath)) && /report/i.test(path.basename(filePath)),
  },
  {
    key: "otel_samples",
    description: "OTEL telemetry samples captured from evidence collectors.",
    matcher: (filePath) => filePath.includes(`${path.sep}evidence${path.sep}`) && path.basename(filePath).startsWith("otel-") && path.extname(filePath) === ".json",
  },
  {
    key: "audit_log_samples",
    description: "Immutable audit log extracts for verification.",
    matcher: (filePath) => filePath.includes(`${path.sep}artifacts${path.sep}`) && path.basename(filePath) === "audit-sample.ndjson",
    selectLatestOnly: true,
  },
];

const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "tmp",
  "__pycache__",
]);

async function walk(root: string, onFile: (filePath: string) => void | Promise<void>): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        return;
      }
      await walk(entryPath, onFile);
    } else if (entry.isFile()) {
      await onFile(entryPath);
    }
  }));
}

async function collectFiles(): Promise<Map<string, EvidenceFile[]>> {
  const matches = new Map<string, EvidenceFile[]>();
  for (const category of categories) {
    matches.set(category.key, []);
  }

  await walk(repoRoot, async (filePath) => {
    for (const category of categories) {
      if (category.matcher(filePath)) {
        const stats = await fs.stat(filePath);
        const fileBuffer = await fs.readFile(filePath);
        const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
        const record: EvidenceFile = {
          path: path.relative(repoRoot, filePath),
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          sha256,
        };
        matches.get(category.key)!.push(record);
      }
    }
  });

  for (const category of categories) {
    const files = matches.get(category.key)!;
    files.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    if (category.selectLatestOnly && files.length > 1) {
      matches.set(category.key, [files[0]]);
    }
  }

  return matches;
}

async function writeManifest(matches: Map<string, EvidenceFile[]>): Promise<void> {
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    items: {},
  };

  for (const category of categories) {
    const files = matches.get(category.key) ?? [];
    manifest.items[category.key] = {
      status: files.length > 0 ? "collected" : "missing",
      description: category.description,
      files,
    };
  }

  await fs.mkdir(evidenceOutputDir, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main(): Promise<void> {
  const matches = await collectFiles();
  await writeManifest(matches);
}

main().catch((error) => {
  console.error("Evidence collection failed", error);
  process.exitCode = 1;
});
