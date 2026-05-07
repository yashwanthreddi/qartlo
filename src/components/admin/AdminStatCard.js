export default function AdminStatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      {typeof label === "string" && label.trim() ? (
        <p className="text-sm text-gray-500 mb-1">
          {label}
        </p>
      ) : null}

      <h2 className="text-2xl font-bold">
        {value ?? 0}
      </h2>
    </div>
  );
}