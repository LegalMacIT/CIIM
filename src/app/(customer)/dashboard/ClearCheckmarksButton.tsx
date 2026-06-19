"use client";

export default function ClearCheckmarksButton({
  fieldKeys,
  idPrefix = "",
}: {
  fieldKeys: string[];
  idPrefix?: string;
}) {
  function handleClear() {
    for (const key of fieldKeys) {
      const input = document.getElementById(`${idPrefix}${key}`) as HTMLInputElement | null;
      if (input?.checked) input.click();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClear}
      className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
    >
      Clear all checkmarks
    </button>
  );
}
