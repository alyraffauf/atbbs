import { queryClient } from "../../app/queryClient";

export function invalidateAllCommunityCaches() {
  void queryClient.invalidateQueries({ queryKey: ["bbs"] });
  void queryClient.invalidateQueries({ queryKey: ["bbs-moderation"] });
  void queryClient.invalidateQueries({ queryKey: ["sysop-moderation"] });
}
