export const MAX_EVALUATION_FILE_BYTES = 5_000_000;

const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  zip: [0x50, 0x4b, 0x03, 0x04],
  ole: [0xd0, 0xcf, 0x11, 0xe0],
} as const;

export type EvaluationFileType = {
  extension: "pdf" | "doc" | "docx" | "jpg" | "jpeg" | "png";
  mimeType: string;
};

export function inspectEvaluationFile(
  fileName: string,
  bytes: Uint8Array,
): { ok: true; file: EvaluationFileType } | { ok: false; error: string } {
  if (bytes.byteLength < 4 || bytes.byteLength > MAX_EVALUATION_FILE_BYTES) {
    return { ok: false, error: "The file must be between 4 bytes and 5 MB." };
  }
  const extension = fileName.split(".").pop()?.toLowerCase();
  const file = fileType(extension);
  if (!file) {
    return { ok: false, error: "Upload a PDF, Word document, or JPG/PNG image." };
  }
  const matches =
    (file.extension === "pdf" && startsWith(bytes, SIGNATURES.pdf))
    || ((file.extension === "jpg" || file.extension === "jpeg") && startsWith(bytes, SIGNATURES.jpeg))
    || (file.extension === "png" && startsWith(bytes, SIGNATURES.png))
    || (file.extension === "docx" && startsWith(bytes, SIGNATURES.zip))
    || (file.extension === "doc" && startsWith(bytes, SIGNATURES.ole));
  if (!matches) {
    return { ok: false, error: "The file contents do not match its extension." };
  }
  return { ok: true, file };
}

function fileType(extension: string | undefined): EvaluationFileType | null {
  if (extension === "pdf") {
    return { extension, mimeType: "application/pdf" };
  }
  if (extension === "doc") {
    return { extension, mimeType: "application/msword" };
  }
  if (extension === "docx") {
    return {
      extension,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  if (extension === "jpg" || extension === "jpeg") {
    return { extension, mimeType: "image/jpeg" };
  }
  if (extension === "png") {
    return { extension, mimeType: "image/png" };
  }
  return null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}
