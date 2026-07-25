export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function readClipboardImageFile(filename = "pasted-image"): Promise<File | null> {
  if (!navigator.clipboard || !navigator.clipboard.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        const ext = imageType.split("/")[1] || "png";
        return new File([blob], `${filename}.${ext}`, { type: imageType });
      }
    }
  } catch {
    /* 클립보드 읽기 실패 - 권한 없음 등 */
  }
  return null;
}
