"use client";

export default function SelectAllCheckmarksButton({
  fieldKeys,
  idPrefix = "",
}: {
  fieldKeys: string[];
  idPrefix?: string;
}) {
  function handleSelectAll() {
    for (const key of fieldKeys) {
      const input = document.getElementById(`${idPrefix}${key}`) as HTMLInputElement | null;
      if (input && !input.checked) input.click();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSelectAll}
      className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
    >
      Select all checkmarks
    </button>
  );
}
