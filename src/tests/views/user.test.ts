import { describe, it, expect } from "bun:test";
import { formatUserIdentity } from "../../views/user";

describe("formatUserIdentity", () => {
  it("returns username with id when no nickname", () => {
    const result = formatUserIdentity("123", "ExampleUser");
    expect(result).toBe("ExampleUser (ID: 123)");
  });

  it("includes nickname when provided", () => {
    const result = formatUserIdentity("123", "ExampleUser", "Nick");
    expect(result).toBe("Nick ~ ExampleUser (ID: 123)");
  });
});
