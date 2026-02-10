import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock axios
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from "axios";
import { getUserProfile, getUserSolvedProblems, getProblemsById, getTierName, getTierColor } from "../solvedac";

describe("solved.ac API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserProfile", () => {
    it("should fetch user info from solved.ac API", async () => {
      const mockUserData = {
        handle: "tourist",
        tier: 31,
        rating: 3500,
        solvedCount: 1500,
        maxStreak: 100,
        rank: 1,
      };

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockUserData });

      const result = await getUserProfile("tourist");

      expect(axios.get).toHaveBeenCalledWith(
        "https://solved.ac/api/v3/user/show",
        expect.objectContaining({
          params: { handle: "tourist" },
        })
      );
      expect(result).toEqual(mockUserData);
    });

    it("should return null when user not found", async () => {
      vi.mocked(axios.get).mockRejectedValueOnce({
        response: { status: 404 },
      });

      const result = await getUserProfile("nonexistent_user");

      expect(result).toBeNull();
    });
  });

  describe("getUserSolvedProblems", () => {
    it("should fetch solved problems with pagination", async () => {
      const mockResponse = {
        count: 2,
        items: [
          { problemId: 1000 },
          { problemId: 1001 },
        ],
      };

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockResponse });

      const result = await getUserSolvedProblems("tourist");

      expect(axios.get).toHaveBeenCalledWith(
        "https://solved.ac/api/v3/search/problem",
        expect.objectContaining({
          params: expect.objectContaining({
            query: "solved_by:tourist",
            page: 1,
          }),
        })
      );
      expect(result).toEqual([1000, 1001]);
    });
  });

  describe("getProblemsById", () => {
    it("should fetch problems by IDs", async () => {
      const mockProblems = [
        { problemId: 1000, titleKo: "A+B", level: 1, tags: [] },
        { problemId: 1001, titleKo: "A-B", level: 1, tags: [] },
      ];

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockProblems });

      const result = await getProblemsById([1000, 1001]);

      expect(axios.get).toHaveBeenCalledWith(
        "https://solved.ac/api/v3/problem/lookup",
        expect.objectContaining({
          params: { problemIds: "1000,1001" },
        })
      );
      expect(result).toEqual(mockProblems);
    });

    it("should return empty array for empty input", async () => {
      const result = await getProblemsById([]);
      expect(result).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe("getTierName", () => {
    it("should return correct tier names", () => {
      expect(getTierName(0)).toBe("Unrated");
      expect(getTierName(1)).toBe("Bronze V");
      expect(getTierName(5)).toBe("Bronze I");
      expect(getTierName(6)).toBe("Silver V");
      expect(getTierName(11)).toBe("Gold V");
      expect(getTierName(16)).toBe("Platinum V");
      expect(getTierName(21)).toBe("Diamond V");
      expect(getTierName(26)).toBe("Ruby V");
      expect(getTierName(31)).toBe("Master");
    });
  });

  describe("getTierColor", () => {
    it("should return correct tier colors", () => {
      expect(getTierColor(0)).toBe("#2D2D2D");
      expect(getTierColor(1)).toBe("#AD5600"); // Bronze
      expect(getTierColor(6)).toBe("#435F7A"); // Silver
      expect(getTierColor(11)).toBe("#EC9A00"); // Gold
      expect(getTierColor(16)).toBe("#27E2A4"); // Platinum
      expect(getTierColor(21)).toBe("#00B4FC"); // Diamond
      expect(getTierColor(26)).toBe("#FF0062"); // Ruby
    });
  });
});
