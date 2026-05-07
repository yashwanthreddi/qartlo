export default function StatsCard({ label, value, subtext = "" }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      {typeof label === "string" && label.trim() ? (
        <p className="text-sm text-gray-500 mb-2">
          {label}
        </p>
      ) : null}

      <h2 className="text-2xl font-bold">
        {value ?? 0}
      </h2>

      {typeof subtext === "string" && subtext.trim() ? (
        <p className="text-xs text-gray-500 mt-1">
          {subtext}
        </p>
      ) : null}
    </div>
  );
}