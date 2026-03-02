import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourcePath = path.join(rootDir, "assets/images/svg-icons.txt");
const targetPath = path.join(rootDir, "assets/images/svg-icons.json");

const normalizeIconKey = (value) => String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseName = (rawLabel) => {
    const label = String(rawLabel || "").trim();
    const match = label.match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
    const baseName = (match && match[1] ? match[1] : label).trim();
    const hint = match && match[2] ? match[2].trim() : null;
    const id = normalizeIconKey(baseName);

    return { id, name: baseName, label, hint };
};

const extractSvg = (rawSvgChunk) => {
    const chunk = String(rawSvgChunk || "");
    const startIndex = chunk.indexOf("<svg");
    const endIndex = chunk.lastIndexOf("</svg>");

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return null;
    }

    let svg = chunk.slice(startIndex, endIndex + 6).trim();
    svg = svg.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
        const cleanAttrs = attrs.replace(/\s+(width|height)="[^"]*"/gi, "");
        return `<svg${cleanAttrs}>`;
    });

    return svg;
};

const source = fs.readFileSync(sourcePath, "utf8");
const lines = source.split(/\r?\n/);
const icons = [];
const usedIds = new Set();

let currentName = null;
let currentSvgLines = [];
let sourceUrl = null;

const pushCurrentIcon = () => {
    if (!currentName) {
        return;
    }

    const rawSvg = currentSvgLines.join("\n");
    const svg = extractSvg(rawSvg);
    if (!svg) {
        currentName = null;
        currentSvgLines = [];
        return;
    }

    const parsed = parseName(currentName);
    let uniqueId = parsed.id || `icon-${icons.length + 1}`;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
        uniqueId = `${parsed.id}-${suffix}`;
        suffix += 1;
    }
    usedIds.add(uniqueId);

    icons.push({
        id: uniqueId,
        name: parsed.name,
        label: parsed.label,
        hint: parsed.hint,
        svg
    });

    currentName = null;
    currentSvgLines = [];
};

for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
        continue;
    }

    if (/^source:/i.test(trimmed)) {
        sourceUrl = trimmed.replace(/^source:\s*/i, "").trim();
        continue;
    }

    if (trimmed.startsWith("<")) {
        if (currentName) {
            currentSvgLines.push(trimmed);
        }
        continue;
    }

    if (currentName && currentSvgLines.length > 0) {
        pushCurrentIcon();
    }

    currentName = trimmed;
    currentSvgLines = [];
}

pushCurrentIcon();

const payload = {
    sourceFile: "assets/images/svg-icons.txt",
    source: sourceUrl,
    count: icons.length,
    icons
};

fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Generated ${targetPath} with ${icons.length} icons.`);
