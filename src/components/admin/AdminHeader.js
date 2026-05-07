export default function AdminHeader({ title, subtitle }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">
        {title || "Dashboard"}
      </h1>

      {typeof subtitle === "string" && subtitle.trim() ? (
        <p className="mt-1 text-gray-600">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}