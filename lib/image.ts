export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다"));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했습니다"));
    };
    img.src = url;
  });
}

export async function compressImage(file: File, maxSize = 900, quality = 0.75): Promise<string> {
  const type = (file.type || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif") || type.includes("webp")) {
    throw new Error("HEIC/HEIF/WEBP는 지원하지 않습니다\nJPG 또는 PNG로 저장 후 업로드해주세요");
  }
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("캔버스를 생성하지 못했습니다");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 변환에 실패했습니다"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("이미지 변환에 실패했습니다"));
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    });
  } catch {
    return fileToDataURL(file);
  }
}
