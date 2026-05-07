export default function Loader({ text = "Loading..." }) {
  const safeText =
    typeof text === "string" && text.trim()
      ? text
      : "Loading...";

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">
        {safeText}
      </p>
    </main>
  );
}