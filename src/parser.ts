import { load, type CheerioAPI } from "cheerio";

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls",
  "default", "defer", "disabled", "hidden", "ismap", "loop", "multiple",
  "muted", "open", "readonly", "required", "reversed", "selected", "spellcheck",
]);

const ATTRIBUTE_MAP: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  contenteditable: "contentEditable",
  spellcheck: "spellCheck",
  srcset: "srcSet",
  usemap: "useMap",
  frameborder: "frameBorder",
  allowfullscreen: "allowFullScreen",
  crossorigin: "crossOrigin",
  datetime: "dateTime",
};

export interface TsxResult {
  tsx: string;
  imports: string[];
}

export function htmlToTsx(html: string): TsxResult {
  const $ = load(html, { xml: { xmlMode: false } }, false);
  const body = $("body").length ? $("body") : $.root();
  const children = (body as any).contents();
  const ctx = new TsxContext();

  children.each((_: number, el: any) => {
    ctx.tsx += nodeToTsx($, el, ctx);
  });

  return { tsx: dedent(ctx.tsx.trim()), imports: ctx.getImports() };
}

function dedent(text: string): string {
  const lines = text.split("\n");
  const nonEmpty = lines.filter((line) => line.trim() !== "");
  if (nonEmpty.length === 0) return text;
  const minIndent = Math.min(...nonEmpty.map((line) => line.length - line.trimStart().length));
  return lines
    .map((line) => (line.trim() === "" ? "" : line.slice(minIndent)))
    .join("\n");
}

class TsxContext {
  tsx = "";
  private imports = new Set<string>();
  private nextLinks = 0;

  addImport(moduleName: string, defaultName: string): void {
    this.imports.add(`import ${defaultName} from "${moduleName}";`);
  }

  requestLink(): void {
    if (this.nextLinks === 0) {
      this.addImport("next/link", "Link");
    }
    this.nextLinks++;
  }

  getImports(): string[] {
    return Array.from(this.imports).sort();
  }
}

function nodeToTsx($: CheerioAPI, node: any, ctx: TsxContext): string {
  if (node.type === "text") {
    const text = node.data || "";
    if (/^\s+$/.test(text)) {
      return text.includes("\n") ? "\n" : " ";
    }
    return escapeText(text);
  }
  if (node.type === "comment") {
    return `{/* ${escapeComment(node.data)} */}`;
  }
  if (node.type !== "tag" || !node.tagName) {
    return "";
  }

  const tag = node.tagName.toLowerCase();
  const attrs = node.attributes || [];
  let attrStr = "";
  let styleAttr = "";
  let hrefValue: string | null = null;
  let imgSrc = "";
  let imgAlt = "";
  let imgWidth = "";
  let imgHeight = "";

  for (const attr of attrs) {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    if (name === "style") {
      styleAttr = value;
      continue;
    }

    if (name === "href" && tag === "a") {
      hrefValue = value;
      continue;
    }

    if (tag === "img" && (name === "src" || name === "alt" || name === "width" || name === "height")) {
      if (name === "src") imgSrc = value;
      if (name === "alt") imgAlt = value;
      if (name === "width") imgWidth = value;
      if (name === "height") imgHeight = value;
      continue;
    }

    const jsxName = ATTRIBUTE_MAP[name] || name;

    if (BOOLEAN_ATTRIBUTES.has(name)) {
      attrStr += value === "" || value === name ? ` ${jsxName}` : ` ${jsxName}={true}`;
      continue;
    }

    if (value === "") {
      attrStr += ` ${jsxName}`;
    } else {
      attrStr += ` ${jsxName}=${formatAttributeValue(value)}`;
    }
  }

  if (styleAttr) {
    const styleObj = styleToJsx(styleAttr);
    if (styleObj) {
      attrStr += ` style={${styleObj}}`;
    }
  }

  if (tag === "img" && imgSrc && imgWidth && imgHeight) {
    ctx.addImport("next/image", "Image");
    return `<Image src=${formatAttributeValue(imgSrc)} alt=${formatAttributeValue(imgAlt)} width={${parseInt(imgWidth, 10)}} height={${parseInt(imgHeight, 10)}}${attrStr} />`;
  }

  if (tag === "img") {
    const srcAttr = imgSrc ? ` src=${formatAttributeValue(imgSrc)}` : "";
    const altAttr = imgAlt ? ` alt=${formatAttributeValue(imgAlt)}` : "";
    const widthAttr = imgWidth ? ` width=${formatAttributeValue(imgWidth)}` : "";
    const heightAttr = imgHeight ? ` height=${formatAttributeValue(imgHeight)}` : "";
    return `<img${srcAttr}${altAttr}${widthAttr}${heightAttr}${attrStr} />`;
  }

  let childrenTsx = "";
  if (node.children) {
    for (const child of node.children) {
      childrenTsx += nodeToTsx($, child, ctx);
    }
  }

  if (tag === "a" && hrefValue) {
    if (isInternalLink(hrefValue)) {
      ctx.requestLink();
      return `<Link href=${formatAttributeValue(hrefValue)}${attrStr}>${childrenTsx}</Link>`;
    }
    return `<a href=${formatAttributeValue(hrefValue)}${attrStr}>${childrenTsx}</a>`;
  }

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attrStr} />`;
  }

  return `<${tag}${attrStr}>${childrenTsx}</${tag}>`;
}

function isInternalLink(href: string): boolean {
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) {
    return true;
  }
  // Treat protocol-bearing URLs as external
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return false;
  }
  return false;
}

function formatAttributeValue(value: string): string {
  if (value.includes('"') && !value.includes("'")) {
    return `'{${value}}'`;
  }
  return `"${value.replace(/"/g, "\\\"")}"`;
}

function escapeText(text: string): string {
  if (!text.trim()) return text;

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "{'{'}")
    .replace(/}/g, "{'}'}");
}

function escapeComment(text: string): string {
  return (text || "").replace(/\*\//g, "* /");
}

function styleToJsx(style: string): string | null {
  const rules = style.split(";").filter(Boolean);
  if (rules.length === 0) return null;

  const pairs: string[] = [];
  for (const rule of rules) {
    const colonIndex = rule.indexOf(":");
    if (colonIndex === -1) continue;
    const key = rule.slice(0, colonIndex).trim();
    const value = rule.slice(colonIndex + 1).trim();
    const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    pairs.push(`${camelKey}: "${value.replace(/"/g, "\\\"")}"`);
  }

  return `{${pairs.join(", ")}}`;
}
