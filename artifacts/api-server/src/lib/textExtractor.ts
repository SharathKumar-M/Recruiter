import zlib from "node:zlib";

export interface TextExtractionResult {
  success: boolean;
  text: string;
  charCount: number;
  wordCount: number;
  mimeType: string;
  reason?: string;
}

/**
 * Clean and normalize extracted text
 */
function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Decode XML entities in DOCX text
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Extract text from DOCX buffer by finding and decompressing word/document.xml
 */
function extractFromDocx(buffer: Buffer): { success: boolean; text: string; reason?: string } {
  try {
    let offset = 0;
    while (offset < buffer.length - 30) {
      // Check for ZIP local file header signature 0x04034b50
      if (
        buffer[offset] === 0x50 &&
        buffer[offset + 1] === 0x4b &&
        buffer[offset + 2] === 0x03 &&
        buffer[offset + 3] === 0x04
      ) {
        const compressionMethod = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const fileNameLength = buffer.readUInt16LE(offset + 26);
        const extraFieldLength = buffer.readUInt16LE(offset + 28);

        const fileNameStart = offset + 30;
        const fileNameEnd = fileNameStart + fileNameLength;
        const fileName = buffer.toString("utf8", fileNameStart, fileNameEnd);

        const dataStart = fileNameEnd + extraFieldLength;

        if (fileName === "word/document.xml") {
          let xmlContent = "";
          const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

          if (compressionMethod === 0) {
            xmlContent = compressedData.toString("utf8");
          } else if (compressionMethod === 8) {
            try {
              const decompressed = zlib.inflateRawSync(compressedData);
              xmlContent = decompressed.toString("utf8");
            } catch {
              const decompressed = zlib.inflateSync(compressedData);
              xmlContent = decompressed.toString("utf8");
            }
          }

          if (xmlContent) {
            // Replace paragraph boundaries with newlines
            const formatted = xmlContent
              .replace(/<\/w:p>/gi, "\n")
              .replace(/<\/w:tr>/gi, "\n")
              .replace(/<w:tab[^>]*\/>/gi, "\t")
              .replace(/<w:br[^>]*\/>/gi, "\n");

            // Extract all <w:t> content
            const matches: string[] = [];
            const textRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi;
            let match;
            while ((match = textRegex.exec(formatted)) !== null) {
              matches.push(decodeXmlEntities(match[1]));
            }

            const rawText = matches.join(" ");
            const cleaned = cleanExtractedText(rawText);
            if (cleaned.length > 10) {
              return { success: true, text: cleaned };
            }
          }
        }

        offset = dataStart + compressedSize;
      } else {
        offset++;
      }
    }

    return {
      success: false,
      text: "",
      reason: "Could not find word/document.xml in DOCX file or document contains no text.",
    };
  } catch (err: any) {
    return {
      success: false,
      text: "",
      reason: `DOCX parsing error: ${err.message || String(err)}`,
    };
  }
}

/**
 * Decode PDF literal escaped string: (Hello \(world\))
 */
function decodePdfLiteralString(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\" && i + 1 < str.length) {
      i++;
      const nextChar = str[i];
      if (nextChar === "n") result += "\n";
      else if (nextChar === "r") result += "\r";
      else if (nextChar === "t") result += "\t";
      else if (nextChar === "b") result += "\b";
      else if (nextChar === "f") result += "\f";
      else if (nextChar === "(") result += "(";
      else if (nextChar === ")") result += ")";
      else if (nextChar === "\\") result += "\\";
      else if (/[0-7]/.test(nextChar)) {
        // Octal escape
        let octal = nextChar;
        if (i + 1 < str.length && /[0-7]/.test(str[i + 1])) {
          octal += str[++i];
          if (i + 1 < str.length && /[0-7]/.test(str[i + 1])) {
            octal += str[++i];
          }
        }
        result += String.fromCharCode(parseInt(octal, 8));
      } else {
        result += nextChar;
      }
    } else {
      result += str[i];
    }
  }
  return result;
}

/**
 * Extract text from PDF buffer
 */
function extractFromPdf(buffer: Buffer): { success: boolean; text: string; reason?: string } {
  try {
    const rawBuffer = buffer.toString("binary");
    const extractedParts: string[] = [];

    // Find all stream ... endstream blocks in PDF
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch;

    while ((streamMatch = streamRegex.exec(rawBuffer)) !== null) {
      const streamContent = streamMatch[1];
      let decompressed = "";

      // Try inflating flate stream
      try {
        const streamBuffer = Buffer.from(streamContent, "binary");
        decompressed = zlib.inflateSync(streamBuffer).toString("utf8");
      } catch {
        // If not standard zlib, try raw inflate
        try {
          const streamBuffer = Buffer.from(streamContent, "binary");
          decompressed = zlib.inflateRawSync(streamBuffer).toString("utf8");
        } catch {
          // If uncompressed text stream
          decompressed = streamContent;
        }
      }

      if (decompressed) {
        // Match string operators in text blocks: (string) Tj or ' or "
        const tjRegex = /\((?:[^()\\]|\\.)*\)\s*(?:Tj|'|")/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
          const literal = tjMatch[0].replace(/\s*(?:Tj|'|")$/, "").slice(1, -1);
          extractedParts.push(decodePdfLiteralString(literal));
        }

        // Match array operator: [(str1) -10 (str2)] TJ
        const arrayTjRegex = /\[((?:[^[\]]|\((?:[^()\\]|\\.)*\))*)\]\s*TJ/g;
        let arrayMatch;
        while ((arrayMatch = arrayTjRegex.exec(decompressed)) !== null) {
          const arrayBody = arrayMatch[1];
          const innerLiteralRegex = /\(((?:[^()\\]|\\.)*)\)/g;
          let innerMatch;
          while ((innerMatch = innerLiteralRegex.exec(arrayBody)) !== null) {
            extractedParts.push(decodePdfLiteralString(innerMatch[1]));
          }
        }
      }
    }

    let joinedText = cleanExtractedText(extractedParts.join(" "));

    // Fallback: If Tj extraction yielded very little, scan for readable ASCII chunks
    if (joinedText.length < 50) {
      const directMatches = rawBuffer.match(/\(([A-Za-z0-9 .,;:!?'"&/\\()\-+@#]{4,})\)/g);
      if (directMatches && directMatches.length > 5) {
        const directCleaned = cleanExtractedText(
          directMatches.map((m) => m.slice(1, -1)).join(" ")
        );
        if (directCleaned.length > joinedText.length) {
          joinedText = directCleaned;
        }
      }
    }

    if (joinedText.length >= 30) {
      return { success: true, text: joinedText };
    }

    return {
      success: false,
      text: "",
      reason: "No extractable text layers found. Document may be a scanned image or encrypted PDF.",
    };
  } catch (err: any) {
    return {
      success: false,
      text: "",
      reason: `PDF text extraction error: ${err.message || String(err)}`,
    };
  }
}

/**
 * Universal text extraction from file buffer based on MIME type and extension
 */
export async function extractTextFromFile(
  filename: string,
  buffer: Buffer,
  mimeType?: string
): Promise<TextExtractionResult> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const detectedMime = mimeType || (
    ext === "pdf" ? "application/pdf" :
    ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
    ext === "txt" ? "text/plain" :
    "application/octet-stream"
  );

  // Reject files over 15MB for extraction safety
  if (buffer.length > 15 * 1024 * 1024) {
    return {
      success: false,
      text: "",
      charCount: 0,
      wordCount: 0,
      mimeType: detectedMime,
      reason: "File exceeds 15MB extraction limit.",
    };
  }

  // Plain text
  if (detectedMime.includes("text") || ext === "txt") {
    try {
      const text = cleanExtractedText(buffer.toString("utf8"));
      return {
        success: true,
        text,
        charCount: text.length,
        wordCount: text ? text.split(/\s+/).length : 0,
        mimeType: "text/plain",
      };
    } catch (err: any) {
      return {
        success: false,
        text: "",
        charCount: 0,
        wordCount: 0,
        mimeType: "text/plain",
        reason: `Failed to decode text file: ${err.message || String(err)}`,
      };
    }
  }

  // DOCX
  if (
    detectedMime.includes("wordprocessingml") ||
    detectedMime.includes("officedocument") ||
    ext === "docx"
  ) {
    const result = extractFromDocx(buffer);
    const words = result.text ? result.text.split(/\s+/).length : 0;
    return {
      success: result.success,
      text: result.text,
      charCount: result.text.length,
      wordCount: words,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      reason: result.reason,
    };
  }

  // PDF
  if (detectedMime.includes("pdf") || ext === "pdf") {
    const result = extractFromPdf(buffer);
    const words = result.text ? result.text.split(/\s+/).length : 0;
    return {
      success: result.success,
      text: result.text,
      charCount: result.text.length,
      wordCount: words,
      mimeType: "application/pdf",
      reason: result.reason,
    };
  }

  return {
    success: false,
    text: "",
    charCount: 0,
    wordCount: 0,
    mimeType: detectedMime,
    reason: `File format '.${ext}' does not support automatic text extraction. Supported formats: .pdf, .docx, .txt`,
  };
}
