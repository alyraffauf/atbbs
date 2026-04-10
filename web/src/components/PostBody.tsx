import Markdown from "react-markdown";

export default function PostBody({ children }: { children: string }) {
  return (
    <div className="text-neutral-400 leading-relaxed prose prose-invert prose-sm">
      <Markdown>{children}</Markdown>
    </div>
  );
}
