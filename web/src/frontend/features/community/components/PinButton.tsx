import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/auth";
import { findPinRkey } from "../../../../atbbs/community/pins";
import { pinsQuery } from "../../../features/community/queries";
import { ActionButton } from "../../../app/ActionButton";
import { Pin, PinOff } from "lucide-react";

interface PinButtonProps {
  bbsDid: string;
}

export default function PinButton({ bbsDid }: PinButtonProps) {
  const { user, writer } = useAuth();
  const queryClient = useQueryClient();
  const pinsOptions = pinsQuery(user?.pdsUrl ?? "", user?.did ?? "");
  const pins = useQuery({ ...pinsOptions, enabled: !!user });
  const pinRkey = pins.data ? findPinRkey(pins.data, bbsDid) : null;

  const togglePin = useMutation({
    mutationFn: async () => {
      if (!writer) throw new Error("Not signed in");
      if (pinRkey) return writer.unpinCommunity(pinRkey);
      return writer.pinCommunity(bbsDid);
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
