export interface BookMetadata {
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  language: string; // "ja" | "en"
  identifier: string; // ISBN or custom; empty => random uuid
  description: string;
}

/** 行間の段階 */
export type LineHeightLevel = "tight" | "normal" | "relaxed" | "loose";
/** 段落間アキの段階 */
export type ParagraphSpacingLevel = "none" | "normal" | "relaxed";

export const LINE_HEIGHT_VALUES: Record<LineHeightLevel, number> = {
  tight: 1.5,
  normal: 1.8,
  relaxed: 2.1,
  loose: 2.5,
};

/**
 * 縦書き時に line-height だけだと「列と列の幅」しか広がらず、
 * 読み手が期待する「字と字のあいだ」の空きが見えない。
 * そこで縦書き時のみ letter-spacing を連動させて視覚的な「行間」を表現する。
 */
export const VERTICAL_LETTER_SPACING_VALUES: Record<LineHeightLevel, number> = {
  tight: 0,
  normal: 0.05,
  relaxed: 0.12,
  loose: 0.2,
};

export const PARAGRAPH_SPACING_VALUES: Record<ParagraphSpacingLevel, number> = {
  none: 0,
  normal: 0.6,
  relaxed: 1.2,
};

export interface ConversionOptions {
  /** 見出し1で章を自動分割する */
  splitByHeading: boolean;
  /** 縦書き / 横書き */
  writingMode: "horizontal" | "vertical";
  /** 本文の先頭に章見出しを表示する */
  includeChapterTitle: boolean;
  /** 行間 */
  lineHeight: LineHeightLevel;
  /** 段落間のアキ */
  paragraphSpacing: ParagraphSpacingLevel;
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
  lineHeight: "normal",
  paragraphSpacing: "none",
};
