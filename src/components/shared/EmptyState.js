export default function EmptyState({ title, description }) {
  return (
    <div className="bg-white rounded-2xl border p-8 text-center">
      {typeof title === "string" && title.trim() ? (
        <h2 className="text-xl font-semibold mb-2">
          {title}
        </h2>
      ) : null}

      {typeof description === "string" && description.trim() ? (
        <p className="text-gray-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}