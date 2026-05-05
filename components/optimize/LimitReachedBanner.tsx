export default function LimitReachedBanner() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-semibold">You've used all 10 free runs.</p>
      <p className="mt-1 text-red-600">
        You've reached the free tier limit. Thank you for trying AppListify!
      </p>
    </div>
  );
}
