"use client";
// تبدیل فایل به Data URL؛ تصاویر برای صرفه‌جویی در حجم کوچک می‌شوند
export function fileToDataUrl(file: File, maxDim = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      if (file.size > 3 * 1024 * 1024) return reject(new Error("حجم فایل غیرتصویری باید کمتر از ۳ مگابایت باشد."));
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("خطا در خواندن فایل"));
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => reject(new Error("خطا در خواندن تصویر"));
    img.src = url;
  });
}
