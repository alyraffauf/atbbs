import { Paperclip } from "lucide-react";
interface AttachmentLinkProps {
  downloadUrl: string;
  name: string;
}

export default function AttachmentLink({
  downloadUrl,
  name,
}: AttachmentLinkProps) {
  async function download(e: React.MouseEvent) {
    e.preventDefault();
    try {
      const resp = await fetch(downloadUrl);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(downloadUrl, "_blank");
    }
  }

  return (
    <a
      href={downloadUrl}
      onClick={download}
      className="text-xs text-neutral-400 hover:text-neutral-300 inline-flex items-center gap-1 mt-3 cursor-pointer"
    >
      <Paperclip size={11} /> {name}
    </a>
  );
}
