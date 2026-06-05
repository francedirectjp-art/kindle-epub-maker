export interface BookMetadata {
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  language: string; // "ja" | "en"
  identifier: string; // ISBN or custom; empty => random uuid
  description: string;
}

export interface ConversionOptions {
  /** 見出し1で章を自動分割する */
  splitByHeading: boolean;
  /** 縦書き / 横書き */
  writingMode: "horizontal" | "vertical";
  /** 本文の先頭に章見出しを表示する */
  includeChapterTitle: boolean;
}

export interface Chapter {
  id: string; // "chapter1"
  filename: string; // "chapter1.xhtml"
  title: string; // 章タイトル(目次用)
  /** well-formed XHTML フラグメント(body の中身) */
  html: string;
}

export interface ExtractedImage {
  id: string; // "img1"
  filename: string; // "image1.png"
  mediaType: string; // "image/png"
  data: Uint8Array;
}

export interface CoverImage {
  filename: string; // "cover.jpg"
  mediaType: string; // "image/jpeg"
  data: ArrayBuffer;
}

export const DEFAULT_METADATA: BookMetadata = {
  title: "",
  subtitle: "",
  author: "",
  publisher: "",
  language: "ja",
  identifier: "",
  description: "",
};

export const DEFAULT_OPTIONS: ConversionOptions = {
  splitByHeading: true,
  writingMode: "horizontal",
  includeChapterTitle: true,
};
