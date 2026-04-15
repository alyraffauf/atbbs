/** Shared focus/blur and keyboard navigation for dropdown menus. */

import { useRef, useState } from "react";

export function useDropdown(optionCount: number) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  function onFocus() {
    clearTimeout(blurTimeout.current);
    setFocused(true);
  }

  function onBlur() {
    blurTimeout.current = setTimeout(() => {
      setFocused(false);
      setActiveIndex(-1);
    }, 150);
  }

  function onKeyDown(
    event: React.KeyboardEvent,
    onSelect: (index: number) => void,
  ) {
    if (optionCount === 0 || !focused) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev < optionCount - 1 ? prev + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : optionCount - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      onSelect(activeIndex);
    } else if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
    }
  }

  function close() {
    setFocused(false);
    setActiveIndex(-1);
  }

  return { focused, activeIndex, onFocus, onBlur, onKeyDown, close };
}
