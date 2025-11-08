function isAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as { name?: string; message?: string };
  const isMessageAuthError = err.message
    ? err.message.includes("token expired") ||
      err.message.includes("InvalidToken") ||
      err.message.includes("Token-0")
    : false;

  return err.name === "ExpiredToken" || isMessageAuthError;
}

import fs from "fs";
import path from "path";

function countTrackedDirectories(dir: string, isInsideClientCodeDir: boolean = false): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const currentDirName = path.basename(dir);
    const isClientCodeDir = /^CLIENT_CODE_\d+$/.test(currentDirName);

    if (isInsideClientCodeDir || !isClientCodeDir) {
      // If we are inside a CLIENT_CODE_ directory, or the current directory is not a CLIENT_CODE_ directory, count it.
      count++;
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countTrackedDirectories(entryPath, isInsideClientCodeDir || isClientCodeDir);
      }
    }
  } catch (err: unknown) {
    console.error(`Error counting tracked directories in ${dir}:`, err instanceof Error ? err.message : err);
  }
  return count;
}

export { isAuthError, countTrackedDirectories };
