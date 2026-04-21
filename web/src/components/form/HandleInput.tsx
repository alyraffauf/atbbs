import { useEffect, useState, type InputHTMLAttributes } from "react";
import { HANDLE_PLACEHOLDERS as PLACEHOLDERS } from "../../lib/shared";
import { inputStyles } from "./Form";

interface HandleInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string;
  onChange: (value: string) => void;
}

export default function HandleInput({
  value,
  onChange,
  className = "",
  ...rest
}: HandleInputProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    // Don't cycle placeholders while the user has something typed.
    if (value) return;
    const timer = setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={PLACEHOLDERS[placeholderIndex]}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      className={`${inputStyles} ${className}`}
      {...rest}
    />
  );
}
