const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extracts plain text from various document formats (PDF, Word DOCX, Plain text).
 * Handles base64 Data URLs, raw buffers, and text.
 */
async function extractTextFromDocument({ text, fileData, fileName, fileType }) {
  // 1. If base64 file data is provided
  if (fileData && typeof fileData === "string") {
    let base64Content = fileData;
    let mimeType = fileType || "";

    if (fileData.startsWith("data:")) {
      const parts = fileData.split(",");
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      base64Content = parts[1] || "";
    }

    try {
      const buffer = Buffer.from(base64Content, "base64");
      const name = (fileName || "").toLowerCase();

      // Check for PDF
      if (
        mimeType.includes("pdf") ||
        name.endsWith(".pdf") ||
        buffer.slice(0, 5).toString("ascii").startsWith("%PDF")
      ) {
        const parsed = await pdfParse(buffer);
        if (parsed && parsed.text && parsed.text.trim().length > 0) {
          return parsed.text.trim();
        }
      }

      // Check for Word DOCX
      if (
        mimeType.includes("word") ||
        mimeType.includes("officedocument") ||
        name.endsWith(".docx") ||
        name.endsWith(".doc")
      ) {
        const parsed = await mammoth.extractRawText({ buffer });
        if (parsed && parsed.value && parsed.value.trim().length > 0) {
          return parsed.value.trim();
        }
      }

      // Plain text or markdown
      const textFromBuffer = buffer.toString("utf-8");
      if (textFromBuffer && !textFromBuffer.startsWith("%PDF")) {
        return textFromBuffer.trim();
      }
    } catch (err) {
      console.warn("Document parse error (fileData):", err.message);
    }
  }

  // 2. If raw text was provided
  if (text && typeof text === "string") {
    const trimmed = text.trim();

    // Check if the text is actually a binary PDF passed as a string (e.g. from file.text())
    if (trimmed.startsWith("%PDF-") || trimmed.slice(0, 100).includes("%PDF-")) {
      try {
        const buffer = Buffer.from(text, "latin1");
        const parsed = await pdfParse(buffer);
        if (parsed && parsed.text && parsed.text.trim().length > 0) {
          return parsed.text.trim();
        }
      } catch (pdfErr) {
        console.warn("Failed to parse binary PDF text:", pdfErr.message);
      }
    }

    return trimmed;
  }

  return "";
}

module.exports = { extractTextFromDocument };
