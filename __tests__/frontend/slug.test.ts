import { generateSlug } from "../../src/components/config/ConfigForm";

describe("generateSlug", () => {
  it("should handle a single short word", () => {
    expect(generateSlug("CX", new Set())).toBe("cx-1");
    expect(generateSlug("a", new Set())).toBe("a-1");
  });

  it("should handle a single long word", () => {
    expect(generateSlug("Javelin", new Set())).toBe("jave-1");
    expect(generateSlug("Anticheat", new Set())).toBe("anti-1");
  });

  it("should handle two words", () => {
    expect(generateSlug("Call of", new Set())).toBe("caof-1");
  });

  it("should handle two words where one is very short", () => {
    expect(generateSlug("A Team", new Set())).toBe("ate-1");
    expect(generateSlug("O k", new Set())).toBe("ok-1");
  });

  it("should ignore words beyond the first two", () => {
    expect(generateSlug("Call of Duty Warzone", new Set())).toBe("caof-1");
    expect(generateSlug("A Team Test", new Set())).toBe("ate-1");
  });

  it("should strip non-alphabetic characters before taking letters", () => {
    // "Hello-World" split by whitespace is "Hello-World", stripping gives "HelloWorld", first 4 -> "hell"
    expect(generateSlug("Hello-World", new Set())).toBe("hell-1");
    // "Javelin 2" -> "jave-1" (2 is stripped)
    expect(generateSlug("Javelin 2", new Set())).toBe("jave-1");
  });

  it("should handle names with leading/trailing spaces or punctuation", () => {
    expect(generateSlug("  Javelin!!  ", new Set())).toBe("jave-1");
    expect(generateSlug("!!! Call of Duty", new Set())).toBe("caof-1"); // "!!!" -> "", so "Call" and "of" are the first two valid words
  });

  it("should handle collision increment behavior", () => {
    const existing = new Set(["jave-1"]);
    expect(generateSlug("Javelin", existing)).toBe("jave-2");

    existing.add("jave-2");
    existing.add("jave-3");
    expect(generateSlug("Javelin", existing)).toBe("jave-4");
  });

  it("should return empty string if no valid letters are present", () => {
    expect(generateSlug("🚀 💥", new Set())).toBe("");
    expect(generateSlug("123 456", new Set())).toBe("");
  });
});
