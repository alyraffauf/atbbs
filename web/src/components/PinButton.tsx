import { useCallback, useState } from "react";
import { useAuth } from "../lib/auth";
import { PIN } from "../lib/lexicon";
import { parseAtUri } from "../lib/util";
import { createPin, deleteRecord } from "../lib/writes";
import { ActionButton } from "./nav/ActionButton";
import { Pin, PinOff } from "lucide-react";

interface PinButtonProps {
  bbsDid: string;
  initialRkey: string | null;
}

export default function PinButton({ bbsDid, initialRkey }: PinButtonProps) {
  const { user, repo } = useAuth();
  const [pinRkey, setPinRkey] = useState(initialRkey);

  const handleTogglePin = useCallback(async () => {
    if (!repo) return;
    if (pinRkey) {
      await deleteRecord(repo, PIN, pinRkey);
      setPinRkey(null);
    } else {
      const record = await createPin(repo, bbsDid);
      setPinRkey(parseAtUri(record.uri).rkey);
    }
  }, [repo, bbsDid, pinRkey]);

  if (!user) return null;

  return (
    <ActionButton onClick={handleTogglePin} icon={pinRkey ? PinOff : Pin}>
      {pinRkey ? "unpin" : "pin"}
    </ActionButton>
  );
}
