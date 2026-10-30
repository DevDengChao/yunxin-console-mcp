import { describe, expect, it, vi } from "vitest";
import type { FrontApiClient } from "../src/http/client.js";
import { updateImConfig } from "../src/api/im.js";

function fakeClient() {
  const post = vi.fn(async () => ({ ok: true }));
  const get = vi.fn(async () => ({ ok: true }));
  return { client: { post, get } as unknown as FrontApiClient, post, get };
}

describe("updateImConfig", () => {
  it("maps each patch field to the console endpoint", async () => {
    const { client, post, get } = fakeClient();
    const results = await updateImConfig(client, 10000001, {
      imMainSwitch: true,
      authtypeset: "0",
      kickpolicy: "0",
      deletemsgtime: 120,
      roaming: false,
      beforeHistory: false,
      pushbadgelimit: "-1",
      sendMsgCheckFriend: false,
      chatroomIONoNotify: true,
      publishoffline: false,
      chatroomMultiLogin: false,
      checkAppBundle: true,
      callbackUrl: "https://example.com/cb",
    });

    expect(results.every((item) => item.ok)).toBe(true);
    expect(get).toHaveBeenCalledWith("/frontApi/app/openfunction", {
      aid: 10000001,
      function: "IM_MAIN_SWITCH",
      opetype: "open",
    });
    const paths = post.mock.calls.map((call) => call[0]);
    expect(paths).toEqual([
      "/frontApi/app/updateAuthTypeSet",
      "/frontApi/app/updateKickpolicy",
      "/frontApi/app/updateDeletemsgtime",
      "/frontApi/app/updateRoaming",
      "/frontApi/app/updateBeforeHistory",
      "/frontApi/app/updateIosUnreadMsgUpperLimit",
      "/frontApi/app/msgfriendcheck/set",
      "/frontApi/app/updateChatroomIONoNotify",
      "/frontApi/app/updatePublishOffline",
      "/frontApi/app/updateChatroomKickpolicy",
      "/frontApi/app/updateCheckAppBundle",
      "/frontApi/app/callbackConfig/set",
    ]);
  });

  it("maps non-friend messaging to checkType 0 when allowed", async () => {
    const { client, post } = fakeClient();
    await updateImConfig(client, 1, { sendMsgCheckFriend: false });
    expect(post).toHaveBeenCalledWith("/frontApi/app/msgfriendcheck/set", {
      aid: 1,
      checkType: 0,
    });
  });

  it("keeps going and reports per-field failures", async () => {
    const { client, post } = fakeClient();
    post.mockRejectedValueOnce(new Error("boom"));
    const results = await updateImConfig(client, 1, {
      authtypeset: "0",
      deletemsgtime: 60,
    });
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toContain("boom");
    expect(results[1].ok).toBe(true);
  });
});
