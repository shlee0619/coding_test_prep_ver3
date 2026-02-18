import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getSyncJobForUser: vi.fn(),
  getLatestSyncJob: vi.fn(),
  updateGoalForUser: vi.fn(),
  deleteGoalForUser: vi.fn(),
}));

import * as db from "../db";
import { appRouter } from "../routers";

function createCaller(userId: number = 1) {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: `boj:user-${userId}`,
      name: `user-${userId}`,
      email: null,
      loginMethod: "boj",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };

  return appRouter.createCaller(ctx);
}

describe("ownership guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses user-scoped lookup for sync.status(jobId)", async () => {
    vi.mocked(db.getSyncJobForUser).mockResolvedValueOnce({
      id: 123,
      userId: 1,
      status: "RUNNING",
      progress: 40,
      message: "running",
      startedAt: new Date(),
      endedAt: null,
      createdAt: new Date(),
    } as any);

    const caller = createCaller(1);
    const result = await caller.sync.status({ jobId: 123 });

    expect(db.getSyncJobForUser).toHaveBeenCalledWith(123, 1);
    expect(result?.id).toBe(123);
  });

  it("blocks goals.update when goal is not owned by the caller", async () => {
    vi.mocked(db.updateGoalForUser).mockResolvedValueOnce(false);

    const caller = createCaller(1);

    await expect(
      caller.goals.update({
        goalId: 999,
        status: "completed",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(db.updateGoalForUser).toHaveBeenCalledWith(1, 999, {
      title: undefined,
      currentValue: undefined,
      status: "completed",
    });
  });

  it("blocks goals.delete when goal is not owned by the caller", async () => {
    vi.mocked(db.deleteGoalForUser).mockResolvedValueOnce(false);

    const caller = createCaller(7);

    await expect(
      caller.goals.delete({
        goalId: 333,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(db.deleteGoalForUser).toHaveBeenCalledWith(7, 333);
  });

  it("updates and deletes owned goals successfully", async () => {
    vi.mocked(db.updateGoalForUser).mockResolvedValueOnce(true);
    vi.mocked(db.deleteGoalForUser).mockResolvedValueOnce(true);

    const caller = createCaller(5);

    await expect(
      caller.goals.update({
        goalId: 11,
        currentValue: 8,
      }),
    ).resolves.toEqual({ success: true });

    await expect(
      caller.goals.delete({
        goalId: 11,
      }),
    ).resolves.toEqual({ success: true });
  });
});
