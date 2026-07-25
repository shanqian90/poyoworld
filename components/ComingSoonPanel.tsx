import Link from "next/link";

export default function ComingSoonPanel({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">
          {emoji} {title}
        </div>
      </div>
      <div className="border-2 border-dashed border-neutral-300 rounded-2xl px-6 py-10 text-center">
        <div className="text-3xl mb-2">🚧</div>
        <div className="text-sm font-bold text-neutral-600 mb-1">준비 중인 기능입니다</div>
        <div className="text-xs text-neutral-400 whitespace-pre-line max-w-md mx-auto">{description}</div>
      </div>
    </div>
  );
}
