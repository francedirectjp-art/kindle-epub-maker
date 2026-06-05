declare module "mammoth/mammoth.browser" {
  export interface ConvertResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  export interface ConvertOptions {
    styleMap?: string[] | string;
    includeDefaultStyleMap?: boolean;
    convertImage?: unknown;
    ignoreEmptyParagraphs?: boolean;
  }
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: ConvertOptions,
  ): Promise<ConvertResult>;
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<ConvertResult>;
  const _default: {
    convertToHtml: typeof convertToHtml;
    extractRawText: typeof extractRawText;
  };
  export default _default;
}
