import { queryClient } from "../../app/queryClient";

export function invalidateAllCommunityCaches() {
  void queryClient.invalidateQueries({ queryKey: ["bbs"] });
  void queryClient.invalidateQueries({ queryKey: ["bbs-moderation"] });
  void queryClient.invalidateQueries({ queryKey: ["sysop-moderation"] });
  void queryClient.invalidateQueries({ queryKey: ["board-threads"] });
  void queryClient.invalidateQueries({ queryKey: ["thread-root"] });
  void queryClient.invalidateQueries({ queryKey: ["thread-page"] });
  void queryClient.invalidateQueries({ queryKey: ["thread-refs"] });
}
