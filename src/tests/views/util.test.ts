import { describe, it, expect } from "bun:test";
import { Collection, EmbedBuilder } from "discord.js";
import { createAttachmentListField, quoteText } from "../../views/util";

// Helper attachment/sticker interfaces
interface Attachment {
  id: string;
  name: string;
  url: string;
}

interface Sticker {
  id: string;
  name: string;
  url: string;
}

describe("views/util", () => {
  describe("createAttachmentListField", () => {
    it("returns null for empty collection", () => {
      const attachments = new Collection<string, Attachment>();
      expect(createAttachmentListField(attachments)).toBeNull();
    });

    it("formats attachment links", () => {
      const attachments = new Collection<string, Attachment>([
        ["1", { id: "1", name: "a.txt", url: "https://a" }],
        ["2", { id: "2", name: "b.txt", url: "https://b" }],
      ]);

      const field = createAttachmentListField(attachments)!;
      expect(field.name).toBe("Original Attachments");
      expect(field.value).toContain("[a.txt](https://a)");
      expect(field.value).toContain("[b.txt](https://b)");
    });
  });

  describe("quoteText", () => {
    it("prefixes each line with >", () => {
      const input = "line1\nline2";
      expect(quoteText(input)).toBe("> line1\n> line2");
    });
  });
});
