import { matchesGlob } from "./files.js";

export function globsCovering(included: readonly string[], excluded: readonly string[]): string[] {
  const present = [...new Set(included)].sort();
  if (present.length === 0) {
    return [];
  }
  return cover("", present, new Set(excluded));
}

function cover(dir: string, included: readonly string[], excluded: ReadonlySet<string>): string[] {
  const inTree = included.filter((file) => isUnder(file, dir));
  if (inTree.length === 0) {
    return [];
  }
  const excludedInTree = [...excluded].filter((file) => isUnder(file, dir));
  if (excludedInTree.length === 0) {
    return [patternFor(dir, inTree, true)];
  }

  const direct = inTree.filter((file) => parentDir(file) === dir);
  const nested = inTree.filter((file) => parentDir(file) !== dir);
  const result: string[] = [];
  if (direct.length > 0) {
    const directExcluded = excludedInTree.filter((file) => parentDir(file) === dir);
    result.push(...(directExcluded.length === 0 ? [patternFor(dir, direct, false)] : direct));
  }
  const children = [...new Set(nested.map((file) => firstChild(file, dir)))].sort();
  for (const child of children) {
    result.push(...cover(child, included, excluded));
  }
  return result.filter((pattern) => inTree.some((file) => matchesGlob(file, pattern)));
}

function patternFor(dir: string, files: readonly string[], nested: boolean): string {
  const extension = extensionPattern(files);
  const deep = nested && files.some((file) => parentDir(file) !== dir);
  if (dir === "") {
    return deep ? `**/*${extension}` : `*${extension}`;
  }
  return deep ? `${dir}/**/*${extension}` : `${dir}/*${extension}`;
}

function extensionPattern(files: readonly string[]): string {
  const extensions = [...new Set(files.map((file) => file.slice(file.lastIndexOf("."))))].sort();
  if (extensions.length === 1) {
    return extensions[0] ?? "";
  }
  return `.{${extensions.map((extension) => extension.slice(1)).join(",")}}`;
}

function isUnder(file: string, dir: string): boolean {
  return dir === "" || file === dir || file.startsWith(`${dir}/`);
}

function parentDir(file: string): string {
  const index = file.lastIndexOf("/");
  return index === -1 ? "" : file.slice(0, index);
}

function firstChild(file: string, dir: string): string {
  const rest = dir === "" ? file : file.slice(dir.length + 1);
  const segment = rest.split("/")[0] ?? rest;
  return dir === "" ? segment : `${dir}/${segment}`;
}
