export default function HydrateFallback() {
  return (
    <div className="flex flex-col h-dvh">
      <div
        className="fixed top-0 left-0 right-0 h-0.5 bg-neutral-400 z-50"
        style={{ animation: "atbbs-progress 1.5s ease-out infinite" }}
      />
    </div>
  );
}
