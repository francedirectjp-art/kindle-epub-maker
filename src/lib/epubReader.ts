import JSZip from "jszip";
import { htmlToBlocks } from "./docx";
import type {
  BookMetadata,
  ConversionOptions,
  CoverImage,
  EditableChapter,
  ExtractedImage,
} from "./types";

export interface LoadedEpub {
  metadata: Partial<BookMetadata>;
  options: Partial<ConversionOptions>;
  chapters: EditableChapter[];
  images: ExtractedImage[];
  cover: CoverImage | null;
  warnings: string[];
}

function resolvePath(baseDir: string, href: string): string {
  if (!baseDir) return href;
  const parts = `${baseDir}/${href}`.split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p && p !== ".") stack.push(p);
  }
  return stack.join("/");
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.substring(0, i) : "";
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim();
}

/** OPF/XHTML を XML としてパースしつつ、ダメなら HTML として再試行する */
function parseDoc(xml: string): Document | null {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length === 0) return xmlDoc;
  const htmlDoc = new DOMParser().parseFromString(xml, "text/html");
  return htmlDoc;
}

export async function loadEpub(file: File): Promise<LoadedEpub> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const warnings: string[] = [];

  // 1) container.xml → rootfile(OPF)
  const containerXml = await zip
    .file("META-INF/container.xml")
    ?.async("string");
  if (!containerXml) {
    throw new Error(
      "META-INF/container.xml が見つかりません。EPUB として開けません。",
    );
  }
  const containerDoc = parseDoc(containerXml);
  const rootfile =
    containerDoc?.querySelector("rootfile")?.getAttribute("full-path") ?? "";
  if (!rootfile) {
    throw new Error("container.xml に rootfile が指定されていません。");
  }

  // 2) OPF を読む
  const opfXml = await zip.file(rootfile)?.async("string");
  if (!opfXml) throw new Error(`${rootfile} が見つかりません。`);
  const opfDoc = parseDoc(opfXml);
  if (!opfDoc) throw new Error("OPF のパースに失敗しました。");
  const opfDir = dirOf(rootfile);

  // 3) メタデータ復元
  const metadata: Partial<BookMetadata> = {};
  const metaEl = opfDoc.querySelector("metadata");
  if (metaEl) {
    metadata.title = textOf(metaEl.querySelector("title"));
    metadata.author = textOf(metaEl.querySelector("creator"));
    metadata.language = textOf(metaEl.querySelector("language")) || "ja";
    metadata.publisher = textOf(metaEl.querySelector("publisher"));
    metadata.description = textOf(metaEl.querySelector("description"));
    const idRaw = textOf(metaEl.querySelector("identifier"));
    metadata.identifier = idRaw.replace(/^urn:(uuid|isbn):/i, "");
    // subtitle (dc:title id="subtitle" を独自に出している場合)
    const subEl = Array.from(metaEl.querySelectorAll("title")).find(
      (t) => t.getAttribute("id") === "subtitle",
    );
    if (subEl) metadata.subtitle = textOf(subEl);
  }

  // 4) spine から書字方向
  const spine = opfDoc.querySelector("spine");
  const ppd = spine?.getAttribute("page-progression-direction") ?? "";
  const options: Partial<ConversionOptions> = {
    writingMode: ppd === "rtl" ? "vertical" : "horizontal",
  };

  // 5) manifest 解析
  interface ManifestItem {
    id: string;
    href: string;
    fullPath: string;
    mediaType: string;
    properties: string;
  }
  const manifestById = new Map<string, ManifestItem>();
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id") ?? "";
    const href = item.getAttribute("href") ?? "";
    const mediaType = item.getAttribute("media-type") ?? "";
    const properties = item.getAttribute("properties") ?? "";
    manifestById.set(id, {
      id,
      href,
      fullPath: resolvePath(opfDir, href),
      mediaType,
      properties,
    });
  });

  // 6) 画像と表紙を取得
  const images: ExtractedImage[] = [];
  let cover: CoverImage | null = null;
  let imgCounter = 0;
  for (const item of manifestById.values()) {
    if (!item.mediaType.startsWith("image/")) continue;
    const data = await zip.file(item.fullPath)?.async("uint8array");
    if (!data) {
      warnings.push(`画像が見つからない: ${item.href}`);
      continue;
    }
    const filename = basename(item.href);
    if (item.properties.includes("cover-image")) {
      // CoverImage は ArrayBuffer 専用バッファ
      const ab = new ArrayBuffer(data.byteLength);
      new Uint8Array(ab).set(data);
      cover = { filename, mediaType: item.mediaType, data: ab };
    } else {
      imgCounter++;
      images.push({
        id: item.id || `img${imgCounter}`,
        filename,
        mediaType: item.mediaType,
        data,
      });
    }
  }

  // 7) spine 順に本文章を取得
  const chapters: EditableChapter[] = [];
  let chapterIdx = 0;
  const spineRefs = Array.from(spine?.querySelectorAll("itemref") ?? []);
  for (const itemref of spineRefs) {
    const idref = itemref.getAttribute("idref") ?? "";
    const item = manifestById.get(idref);
    if (!item) continue;
    if (!/xhtml|html/.test(item.mediaType)) continue;
    // ナビ / 表紙ページは本文章としては扱わない
    if (item.properties.includes("nav")) continue;
    if (idref === "cover" || idref === "nav") continue;

    const xhtml = await zip.file(item.fullPath)?.async("string");
    if (!xhtml) {
      warnings.push(`章ファイルが見つからない: ${item.href}`);
      continue;
    }
    const doc = parseDoc(xhtml);
    if (!doc) {
      warnings.push(`章のパース失敗: ${item.href}`);
      continue;
    }
    const body =
      doc.querySelector("body") ??
      (doc.documentElement?.tagName.toLowerCase() === "body"
        ? doc.documentElement
        : null);
    if (!body) {
      warnings.push(`<body> が見つからない: ${item.href}`);
      continue;
    }

    // 画像 src を「../images/xxx」形式に統一する
    body.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      const name = basename(src);
      if (name) img.setAttribute("src", `../images/${name}`);
    });

    // タイトル抽出
    const title =
      textOf(body.querySelector("h1,h2,h3")) ||
      textOf(doc.querySelector("title")) ||
      "";

    // body 内の HTML を取得して ParagraphBlock に分解
    const html = body.innerHTML;
    const blocks = htmlToBlocks(html);

    chapterIdx++;
    chapters.push({
      id: `chapter${chapterIdx}`,
      filename: `chapter${chapterIdx}.xhtml`,
      title,
      blocks,
    });
  }

  if (chapters.length === 0) {
    warnings.push(
      "本文章が1つも取得できませんでした。EPUB の構造が独特な可能性があります。",
    );
  }

  return { metadata, options, chapters, images, cover, warnings };
}
