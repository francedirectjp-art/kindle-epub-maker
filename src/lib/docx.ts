import * as mammoth from "mammoth/mammoth.browser";
import type { Chapter, ConversionOptions, ExtractedImage } from "./types";

export interface ParsedDocx {
  chapters: Chapter[];
  images: ExtractedImage[];
  messages: string[];
}

// Word の段落スタイルを意味のある HTML 見出しにマッピングする
const STYLE_MAP = [
  "p[style-name='Title'] => h1.title:fresh",
  "p[style-name='Subtitle'] => p.subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='見出し 1'] => h1:fresh",
  "p[style-name='見出し 2'] => h2:fresh",
  "p[style-name='見出し 3'] => h3:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
];

const MEDIA_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

function mediaTypeToExt(mediaType: string): string {
  return MEDIA_EXT[mediaType.toLowerCase()] ?? "bin";
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * DOM ノード群を整形式 (well-formed) XHTML フラグメント文字列にする。
 * XML ドキュメントへ importNode してから直列化することで、
 * void 要素 (<img/>, <br/>) が正しく自己終端され、
 * 名前空間宣言はラッパに 1 度だけ付く。
 */
function serializeFragment(nodes: Node[]): string {
  const xmlDoc = document.implementation.createDocument(
    "http://www.w3.org/1999/xhtml",
    "div",
    null,
  );
  const wrapper = xmlDoc.documentElement;
  for (const n of nodes) {
    wrapper.appendChild(xmlDoc.importNode(n, true));
  }
  let s = new XMLSerializer().serializeToString(wrapper);
  s = s.replace(/^<div[^>]*>/, "").replace(/<\/div>\s*$/, "");
  return s.trim();
}

function splitIntoChapters(
  body: HTMLElement,
  options: ConversionOptions,
): Chapter[] {
  const chapters: Chapter[] = [];
  let current: { title: string; nodes: Node[] } | null = null;
  let index = 0;

  const pushCurrent = () => {
    if (!current) return;
    const html = serializeFragment(current.nodes);
    if (!html) return;
    index++;
    chapters.push({
      id: `chapter${index}`,
      filename: `chapter${index}.xhtml`,
      title: current.title,
      html,
    });
  };

  const nodes = Array.from(body.childNodes);
  for (const node of nodes) {
    const isH1 =
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName.toLowerCase() === "h1";

    if (isH1 && options.splitByHeading) {
      pushCurrent();
      current = {
        title: (node as Element).textContent?.trim() ?? "",
        nodes: [],
      };
      if (options.includeChapterTitle) current.nodes.push(node);
    } else {
      if (!current) current = { title: "", nodes: [] };
      // 先頭が h1 でないコンテンツ群の最初の見出しをタイトルにする
      if (!current.title && node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase();
        if (tag === "h1" || tag === "h2") {
          current.title = (node as Element).textContent?.trim() ?? "";
        }
      }
      current.nodes.push(node);
    }
  }
  pushCurrent();

  if (chapters.length === 0) {
    chapters.push({
      id: "chapter1",
      filename: "chapter1.xhtml",
      title: "",
      html: "<p></p>",
    });
  }
  return chapters;
}

export async function parseDocx(
  arrayBuffer: ArrayBuffer,
  options: ConversionOptions,
): Promise<ParsedDocx> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    { styleMap: STYLE_MAP, ignoreEmptyParagraphs: true },
  );
  const messages = result.messages.map((m) => m.message);

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${result.value}</body></html>`,
    "text/html",
  );
  const body = doc.body;

  // data URI 画像を抽出して別ファイル参照に書き換える
  const images: ExtractedImage[] = [];
  let imgCounter = 0;
  body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const m = src.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      imgCounter++;
      const mediaType = m[1];
      const filename = `image${imgCounter}.${mediaTypeToExt(mediaType)}`;
      images.push({
        id: `img${imgCounter}`,
        filename,
        mediaType,
        data: base64ToUint8(m[2]),
      });
      img.setAttribute("src", `../images/${filename}`);
    }
    if (img.getAttribute("alt") === null) img.setAttribute("alt", "");
  });

  const chapters = splitIntoChapters(body, options);
  return { chapters, images, messages };
}

/** docx からプレビュー用の生テキスト先頭を取り出す（任意） */
export async function previewText(arrayBuffer: ArrayBuffer): Promise<string> {
  const res = await mammoth.extractRawText({ arrayBuffer });
  return res.value.slice(0, 600);
}

/**
 * 縦書き向けに「字と字のあいだ」を広げる。
 * letter-spacing は Safari / Kindle Previewer の縦書きで効かないため、
 * 本文ブロック内の各文字を span でくるみ、padding-bottom を当てる。
 * 縦書きでは padding-bottom が「次の文字の手前のアキ」になるので確実に効く。
 * 見出し (h1〜h4) と img/br/コード等はスキップして読みやすさを保つ。
 */
const SKIP_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "img",
  "br",
  "code",
  "pre",
]);

export function applyVerticalCharSpacing(
  html: string,
  spacingEm: number,
): string {
  if (spacingEm <= 0) return html;

  const xmlDoc = new DOMParser().parseFromString(
    `<root xmlns="http://www.w3.org/1999/xhtml">${html}</root>`,
    "application/xhtml+xml",
  );
  if (xmlDoc.getElementsByTagName("parsererror").length > 0) return html;

  const NS = "http://www.w3.org/1999/xhtml";
  const styleValue = `padding-bottom:${spacingEm}em;`;

  const wrap = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.nodeValue ?? "";
        if (!text || !text.trim()) continue;
        const frag = xmlDoc.createDocumentFragment();
        for (const ch of Array.from(text)) {
          if (ch === "\n" || ch === " " || ch === "\t" || ch === "　") {
            frag.appendChild(xmlDoc.createTextNode(ch));
            continue;
          }
          const span = xmlDoc.createElementNS(NS, "span");
          span.setAttribute("style", styleValue);
          span.textContent = ch;
          frag.appendChild(span);
        }
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) continue;
        wrap(child);
      }
    }
  };

  wrap(xmlDoc.documentElement);

  let s = new XMLSerializer().serializeToString(xmlDoc.documentElement);
  s = s.replace(/^<root[^>]*>/, "").replace(/<\/root>\s*$/, "");
  return s;
}
