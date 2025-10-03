export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        const base64 = Buffer.from(result).toString("base64");
        resolve(base64);
      } else {
        reject(
          new Error(
            `Failed to read file as base64. ${result} is a ${typeof result}.`,
          ),
        );
      }
    };
    reader.onerror = (e) => {
      reject(new Error(`Error reading file: ${e}`));
    };
    reader.readAsArrayBuffer(file);
  });
}

export function downloadBase64File(content: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/octet-stream;base64,${content}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
