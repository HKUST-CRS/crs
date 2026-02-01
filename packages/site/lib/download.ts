"use client";

/**
 * Downloads a blob as a file with the specified filename.
 *
 * @param filename The name of the file to be downloaded.
 * @param content The blob content to be downloaded.
 */
export function download(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);

  const a = document.createElement("a");
  a.style.display = "none";
  document.body.appendChild(a);

  a.href = url;
  a.download = filename;

  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 0);
}
