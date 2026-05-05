interface RunCounterProps {
  runsUsed: number;
  limit?: number;
}

export default function RunCounter({ runsUsed, limit = 10 }: RunCounterProps) {
  const remaining = limit - runsUsed;
  const isLow = remaining <= 3;
  const isEmpty = remaining === 0;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
        isEmpty
          ? "bg-red-100 text-red-700"
          : isLow
            ? "bg-yellow-100 text-yellow-700"
            : "bg-indigo-50 text-indigo-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isEmpty ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-indigo-500"
        }`}
      />
      {isEmpty ? "No runs left" : `${remaining} / ${limit} runs remaining`}
    </div>
  );
}
