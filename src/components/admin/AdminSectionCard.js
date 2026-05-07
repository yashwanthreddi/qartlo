export default function AdminSectionCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      {typeof title === "string" && title.trim() ? (
        <h2 className="text-lg font-semibold mb-4">
          {title}
        </h2>
      ) : null}

      {children ?? null}
    </div>
  );
}