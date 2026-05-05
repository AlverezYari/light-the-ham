/**
 * Magic-byte image validation.
 *
 * Browser-supplied MIME types are trivially spoofable — a `.jpg` upload could
 * actually be a binary, an HTML page, or anything else. Before we trust the
 * file enough to write it under public/uploads/ (which is then served back to
 * other visitors), we sniff the actual byte signature with `file-type` and
 * gate on the *detected* MIME, not the claimed one.
 */

import { fileTypeFromBuffer } from 'file-type';

export type ImageValidationResult =
  | { ok: true; mime: string; ext: string }
  | { ok: false; error: string };

export async function validateImage(
  buffer: Buffer | Uint8Array,
  allowedMimes: readonly string[],
): Promise<ImageValidationResult> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return { ok: false, error: 'File is not a recognized image format' };
  }
  if (!allowedMimes.includes(detected.mime)) {
    return {
      ok: false,
      error: `File type ${detected.mime} is not allowed (detected from content, not name)`,
    };
  }
  return { ok: true, mime: detected.mime, ext: detected.ext };
}
