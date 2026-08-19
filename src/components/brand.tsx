import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-3 font-semibold tracking-[-0.02em] text-[#14231d]">
      <span className="grid size-9 place-items-center rounded-xl bg-[#14231d] text-sm font-bold text-[#d8ff5f]">H</span>
      <span>Hermes Platform</span>
    </Link>
  );
}
