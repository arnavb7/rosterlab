"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <h1 className="text-xl font-semibold">This page could not be loaded.</h1>
      <button className="mt-3 rounded-md border border-line px-3 py-2 text-sm" type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
