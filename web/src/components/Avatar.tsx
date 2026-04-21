interface AvatarProps {
  url?: string;
  name: string;
  size?: number;
}

export default function Avatar({ url, name, size = 24 }: AvatarProps) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        className="rounded-full shrink-0 object-cover"
      />
    );
  }
  return (
    <div
      style={style}
      className="rounded-full shrink-0 bg-neutral-800 text-neutral-500 text-xs flex items-center justify-center uppercase"
    >
      {name.charAt(0) || "?"}
    </div>
  );
}
