import type { Request } from "express";

export interface ParsedFile {
  fieldName: string;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export interface ParsedMultipart {
  fields: Record<string, string>;
  file?: ParsedFile;
}

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * Robust stream-based multipart/form-data parser for Express
 */
export async function parseMultipartFormData(req: Request): Promise<ParsedMultipart> {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Invalid Content-Type, expected multipart/form-data");
  }

  // Extract boundary
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("No boundary found in multipart/form-data Content-Type header");
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const delimiter = Buffer.from(`--${boundary}`);
  const closeDelimiter = Buffer.from(`--${boundary}--`);

  // Read full request body into buffer
  const chunks: Buffer[] = [];
  let totalLength = 0;

  for await (const chunk of req) {
    totalLength += (chunk as Buffer).length;
    if (totalLength > MAX_UPLOAD_SIZE) {
      throw new Error("File exceeds maximum allowed size limit of 15MB");
    }
    chunks.push(Buffer.from(chunk));
  }

  const rawBuffer = Buffer.concat(chunks);
  const fields: Record<string, string> = {};
  let uploadedFile: ParsedFile | undefined;

  let start = 0;

  while (start < rawBuffer.length) {
    const delimIdx = rawBuffer.indexOf(delimiter, start);
    if (delimIdx === -1) break;

    const nextDelimIdx = rawBuffer.indexOf(delimiter, delimIdx + delimiter.length);
    if (nextDelimIdx === -1) break;

    // Check if close delimiter
    if (rawBuffer.subarray(delimIdx, delimIdx + closeDelimiter.length).equals(closeDelimiter)) {
      break;
    }

    const partBuffer = rawBuffer.subarray(delimIdx + delimiter.length, nextDelimIdx);

    // Skip leading CRLF
    let headerStart = 0;
    if (partBuffer[0] === 13 && partBuffer[1] === 10) {
      headerStart = 2;
    } else if (partBuffer[0] === 10) {
      headerStart = 1;
    }

    // Find end of headers (CRLF CRLF or LF LF)
    let headerEnd = -1;
    let bodyOffset = -1;

    for (let i = headerStart; i < partBuffer.length - 3; i++) {
      if (partBuffer[i] === 13 && partBuffer[i + 1] === 10 && partBuffer[i + 2] === 13 && partBuffer[i + 3] === 10) {
        headerEnd = i;
        bodyOffset = i + 4;
        break;
      }
      if (partBuffer[i] === 10 && partBuffer[i + 1] === 10) {
        headerEnd = i;
        bodyOffset = i + 2;
        break;
      }
    }

    if (headerEnd !== -1 && bodyOffset !== -1) {
      const headerText = partBuffer.toString("utf8", headerStart, headerEnd);
      let bodyBuffer = partBuffer.subarray(bodyOffset);

      // Strip trailing CRLF from body
      if (bodyBuffer.length >= 2 && bodyBuffer[bodyBuffer.length - 2] === 13 && bodyBuffer[bodyBuffer.length - 1] === 10) {
        bodyBuffer = bodyBuffer.subarray(0, bodyBuffer.length - 2);
      } else if (bodyBuffer.length >= 1 && bodyBuffer[bodyBuffer.length - 1] === 10) {
        bodyBuffer = bodyBuffer.subarray(0, bodyBuffer.length - 1);
      }

      // Parse Content-Disposition
      const dispositionMatch = headerText.match(/content-disposition:\s*form-data;?([^\r\n]*)/i);
      if (dispositionMatch) {
        const params = dispositionMatch[1];
        const nameMatch = params.match(/name="([^"]+)"/i);
        const filenameMatch = params.match(/filename="([^"]+)"/i);

        if (nameMatch) {
          const fieldName = nameMatch[1];

          if (filenameMatch) {
            // File field
            const originalFilename = filenameMatch[1];
            const mimeMatch = headerText.match(/content-type:\s*([^\r\n;]+)/i);
            const mimeType = mimeMatch ? mimeMatch[1].trim() : "application/octet-stream";

            uploadedFile = {
              fieldName,
              originalFilename,
              mimeType,
              buffer: bodyBuffer,
              size: bodyBuffer.length,
            };
          } else {
            // Text field
            fields[fieldName] = bodyBuffer.toString("utf8").trim();
          }
        }
      }
    }

    start = nextDelimIdx;
  }

  return { fields, file: uploadedFile };
}
