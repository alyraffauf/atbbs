import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/auth";
import { PIN } from "../../../atbbs/schema/collections";
import { createPin } from "../data/pinRecords";
import { deleteRecord } from "../../../atproto/repository";
import { findPinRkey } from "../data/pins";
import { pinsQuery } from "../../../frontend/features/community/queries";
import { ActionButton } from "../../../shared/ui/ActionButton";
import { Pin, PinOff } from "lucide-react";

interface PinButtonProps {
  bbsDid: string;
}

export default function PinButton({ bbsDid }: PinButtonProps) {
  const { user, repo } = useAuth();
  const queryClient = useQueryClient();
  const pinsOptions = pinsQuery(user?.pdsUrl ?? "", user?.did ?? "");
  const pins = useQuery({ ...pinsOptions, enabled: !!user });
  const pinRkey = pins.data ? findPinRkey(pins.data, bbsDid) : null;

  const togglePin = useMutation({
    mutationFn: async () => {
      if (!repo) throw new Error("Not signed in");
      if (pinRkey) return deleteRecord(repo, PIN, pinRkey);
      return createPin(repo, bbsDid);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: pinsOptions.queryKey }),
  });

  if (!user) return null;

  return (
    <ActionButton
      onClick={() => togglePin.mutate()}
      icon={pinRkey ? PinOff : Pin}
      disabled={pins.isPending || togglePin.isPending}
    >
      {pinRkey ? "unpin" : "pin"}
    </ActionButton>
  );
}
