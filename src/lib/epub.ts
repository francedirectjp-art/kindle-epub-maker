import JSZip from "jszip";
import {
  LINE_HEIGHT_VALUES,
  PARAGRAPH_SPACING_VALUES,
  VERTICAL_LETTER_SPACING_VALUES,
  type BookMetadata,
  type Chapter,
  type ConversionOptions,
  type CoverImage,
  type ExtractedImage,
} from "./types";

export interface BuildEpubInput {
  metadata: BookMetadata;
  options: ConversionOptions;
  chapters: Chapter[];
  images: ExtractedImage[];
  cover: CoverImage | null;
  /** ISO 8601 (秒精度・Z) の更新日時 */
  modified: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // フォールバック (crypto.getRandomValues ベース)
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function normalizeIdentifier(raw: string): string {
  const v = raw.trim();
  if (!v) return `urn:uuid:${generateUuid()}`;
  if (/^(urn:|https?:)/i.test(v)) return v;
  if (/^[0-9-]{10,17}$/.test(v)) return `urn:isbn:${v.replace(/-/g, "")}`;
  return `urn:uuid:${v}`;
}

function chapterTitle(ch: Chapter, meta: BookMetadata, index: number): string {
  return ch.title || (index === 0 ? meta.title : `${index + 1}`) || "本文";
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function styleCss(options: ConversionOptions): string {
  const vertical = options.writingMode === "vertical";
  const writing = vertical
    ? "  writing-mode: vertical-rl;\n  -epub-writing-mode: vertical-rl;\n  -webkit-writing-mode: vertical-rl;\n"
    : "";
  const lh = LINE_HEIGHT_VALUES[options.lineHeight];
  const pSpace = PARAGRAPH_SPACING_VALUES[options.paragraphSpacing];
  const ls = vertical ? VERTICAL_LETTER_SPACING_VALUES[options.lineHeight] : 0;
  const letterSpacingDecl = ls ? `\n  letter-spacing: ${ls}em;` : "";
  // 縦書きで letter-spacing をブロック要素ひとつひとつにも当てる。
  // 親 (body) からの継承が一部リーダーで効かないケースの対策。
  const verticalLetterRule = ls
    ? `\np, h1, h2, h3, h4, blockquote, li, div { letter-spacing: ${ls}em; }`
    : "";
  return `@charset "UTF-8";
html {
${writing}}
body {
  margin: 1em 1.2em;
  line-height: ${lh};${letterSpacingDecl}
  font-family: "Hiragino Mincho ProN", "Yu Mincho", serif;
}
h1 { font-size: 1.6em; margin: 1.4em 0 0.8em; font-weight: bold; line-height: 1.4; }
h2 { font-size: 1.3em; margin: 1.2em 0 0.6em; font-weight: bold; }
h3 { font-size: 1.1em; margin: 1em 0 0.5em; }
h1.title { text-align: center; font-size: 2em; }
p { margin: ${pSpace}em 0; text-indent: 1em; }
p.subtitle { text-align: center; text-indent: 0; color: #555; }
blockquote { margin: 1em 2em; color: #333; }
img { max-width: 100%; height: auto; }
ol, ul { margin: 0.5em 0 0.5em 1.5em; }
nav#toc ol { list-style: none; padding: 0; }
nav#toc li { margin: 0.4em 0; }
nav#toc a { text-decoration: none; color: #1a1a1a; }${verticalLetterRule}
`;
}

function chapterDocument(
  ch: Chapter,
  options: ConversionOptions,
  meta: BookMetadata,
  index: number,
): string {
  const lang = meta.language;
  const title = chapterTitle(ch, meta, index);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="../styles/style.css"/>
</head>
<body>
${ch.html}
</body>
</html>`;
}

function coverDocument(cover: CoverImage, meta: BookMetadata): string {
  const lang = meta.language;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>Cover</title>
<style type="text/css">
html,body{margin:0;padding:0;height:100%;text-align:center;}
.cover-wrap{height:100vh;display:flex;align-items:center;justify-content:center;}
img{max-width:100%;max-height:100vh;}
</style>
</head>
<body>
<div class="cover-wrap"><img src="../images/${cover.filename}" alt="${escapeXml(
    meta.title,
  )}"/></div>
</body>
</html>`;
}

function navDocument(
  chapters: Chapter[],
  meta: BookMetadata,
  hasCover: boolean,
): string {
  const lang = meta.language;
  const items = chapters
    .map(
      (ch, i) =>
        `      <li><a href="text/${ch.filename}">${escapeXml(
          chapterTitle(ch, meta, i),
        )}</a></li>`,
    )
    .join("\n");
  const coverLi = hasCover
    ? `      <li><a href="text/cover.xhtml">表紙</a></li>\n`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>目次</title>
<link rel="stylesheet" type="text/css" href="styles/style.css"/>
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>目次</h1>
<ol>
${coverLi}${items}
</ol>
</nav>
<nav epub:type="landmarks" hidden="hidden">
<ol>
${
    hasCover
      ? `<li><a epub:type="cover" href="text/cover.xhtml">表紙</a></li>\n`
      : ""
  }<li><a epub:type="bodymatter" href="text/${chapters[0].filename}">本文</a></li>
</ol>
</nav>
</body>
</html>`;
}

function ncxDocument(
  chapters: Chapter[],
  meta: BookMetadata,
  uid: string,
): string {
  const navPoints = chapters
    .map(
      (ch, i) => `  <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
    <navLabel><text>${escapeXml(chapterTitle(ch, meta, i))}</text></navLabel>
    <content src="text/${ch.filename}"/>
  </navPoint>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${meta.language}">
<head>
<meta name="dtb:uid" content="${escapeXml(uid)}"/>
<meta name="dtb:depth" content="1"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${escapeXml(meta.title || "Untitled")}</text></docTitle>
<navMap>
${navPoints}
</navMap>
</ncx>`;
}

function opfDocument(input: BuildEpubInput, uid: string): string {
  const { metadata, options, chapters, images, cover, modified } = input;
  const lang = metadata.language;

  const manifest: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="css" href="styles/style.css" media-type="text/css"/>`,
  ];
  if (cover) {
    manifest.push(
      `<item id="cover-image" href="images/${cover.filename}" media-type="${cover.mediaType}" properties="cover-image"/>`,
    );
    manifest.push(
      `<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>`,
    );
  }
  chapters.forEach((ch) => {
    manifest.push(
      `<item id="${ch.id}" href="text/${ch.filename}" media-type="application/xhtml+xml"/>`,
    );
  });
  images.forEach((img) => {
    manifest.push(
      `<item id="${img.id}" href="images/${img.filename}" media-type="${img.mediaType}"/>`,
    );
  });

  const spine: string[] = [];
  if (cover) spine.push(`<itemref idref="cover" linear="yes"/>`);
  spine.push(`<itemref idref="nav" linear="yes"/>`);
  chapters.forEach((ch) => spine.push(`<itemref idref="${ch.id}"/>`));

  const ppd =
    options.writingMode === "vertical"
      ? ` page-progression-direction="rtl"`
      : "";

  const meta: string[] = [
    `<dc:identifier id="bookid">${escapeXml(uid)}</dc:identifier>`,
    `<dc:title>${escapeXml(metadata.title || "Untitled")}</dc:title>`,
  ];
  if (metadata.subtitle)
    meta.push(
      `<dc:title id="subtitle">${escapeXml(metadata.subtitle)}</dc:title>`,
    );
  meta.push(
    `<dc:creator id="creator">${escapeXml(metadata.author || "Unknown")}</dc:creator>`,
  );
  meta.push(`<dc:language>${escapeXml(lang)}</dc:language>`);
  if (metadata.publisher)
    meta.push(`<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>`);
  if (metadata.description)
    meta.push(
      `<dc:description>${escapeXml(metadata.description)}</dc:description>`,
    );
  meta.push(`<meta property="dcterms:modified">${modified}</meta>`);
  if (cover) meta.push(`<meta name="cover" content="cover-image"/>`);
  if (options.writingMode === "vertical") {
    meta.push(`<meta property="rendition:layout">reflowable</meta>`);
    meta.push(`<meta property="rendition:spread">auto</meta>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}" prefix="rendition: http://www.idpf.org/vocab/rendition/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${meta.join("\n    ")}
  </metadata>
  <manifest>
    ${manifest.join("\n    ")}
  </manifest>
  <spine toc="ncx"${ppd}>
    ${spine.join("\n    ")}
  </spine>
</package>`;
}

export async function buildEpub(input: BuildEpubInput): Promise<Blob> {
  const { metadata, options, chapters, images, cover } = input;
  const uid = normalizeIdentifier(metadata.identifier);
  const zip = new JSZip();

  // mimetype は先頭・無圧縮(STORE) が EPUB 仕様の要件
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", containerXml());

  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles/style.css", styleCss(options));
  chapters.forEach((ch, i) =>
    oebps.file(`text/${ch.filename}`, chapterDocument(ch, options, metadata, i)),
  );
  images.forEach((img) => oebps.file(`images/${img.filename}`, img.data));
  if (cover) {
    oebps.file(`images/${cover.filename}`, cover.data);
    oebps.file("text/cover.xhtml", coverDocument(cover, metadata));
  }
  oebps.file("nav.xhtml", navDocument(chapters, metadata, !!cover));
  oebps.file("toc.ncx", ncxDocument(chapters, metadata, uid));
  oebps.file("content.opf", opfDocument(input, uid));

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function safeFilename(title: string): string {
  const base = (title || "book").replace(/[\\/:*?"<>|]+/g, "_").trim();
  return `${base || "book"}.epub`;
}
