import {
  AttachmentBuilder,
  Collection,
  ComponentType,
  MediaGalleryComponent,
  Message,
  type EmbedBuilder,
  type EmbedField,
} from "discord.js";
import { fetch } from "bun";
import {
  MediaGalleryAttachmentsID,
  MediaGalleryStickersID,
} from "./StaffThreadView";
import type { MessageSticker } from "models/message.model";

interface Attachment {
  name: string;
  url: string;
}

interface Sticker {
  id: string;
  name: string;
  url: string;
}

/**
 * Creates an embed field for attachments
 * @param attachments Collection of attachments
 * @returns EmbedField for attachments or null if no attachments
 */
export function createAttachmentListField(
  attachments: Collection<string, Attachment>
): EmbedField | null {
  if (attachments.size === 0) {
    return null;
  }

  const attachmentLinks = Array.from(attachments.values())
    .map((attachment) => `[${attachment.name}](${attachment.url})`)
    .join("\n");

  const name = attachments.size > 1 ? "Attachments" : "Attachment";

  return {
    name: `Original ${name}`,
    value: attachmentLinks,
    inline: false,
  };
}

/**
 * Downloads attachments and converts them to AttachmentBuilder objects
 * @param attachments Collection of attachments to download
 * @returns Promise resolving to an array of AttachmentBuilder objects
 */
export async function downloadAttachments(
  attachments: Attachment[]
): Promise<AttachmentBuilder[]> {
  if (attachments.length === 0) {
    return [];
  }

  const fileDownloads = attachments.map(async (file, i) => {
    const res = await fetch(file.url);
    const arrBuf = await res.arrayBuffer();

    const attachment = new AttachmentBuilder(Buffer.from(arrBuf));
    // Unique name for each attachment by adding index.
    // If the name is the same, it would show up as the same attachment when
    // referenced in embed / components.
    attachment.setName(`${i}-${file.name}`);

    return attachment;
  });

  // Download files in parallel
  return Promise.all(fileDownloads);
}

export function extractComponentImages(msg: Message): {
  attachmentUrls: string[];
  stickers: MessageSticker[];
} {
  const attachmentURLs = extractImageURLsFromComponents(msg);
  const stickerURLs = extractStickersFromComponents(msg);

  return {
    attachmentUrls: attachmentURLs,
    stickers: stickerURLs,
  };
}

export function extractImageURLsFromComponents(msg: Message): string[] {
  const containerComponent = msg.components.find(
    (c) => c.type === ComponentType.Container
  );
  if (!containerComponent) {
    throw new Error("No container component found");
  }

  const mediaGalleryComponent = containerComponent.components.find(
    (c): c is MediaGalleryComponent =>
      c.type === ComponentType.MediaGallery &&
      c.id === MediaGalleryAttachmentsID
  );

  if (!mediaGalleryComponent) {
    return [];
  }

  const imageUrls = mediaGalleryComponent.items.map((item) => {
    return item.media.url;
  });

  return imageUrls;
}

export function extractStickersFromComponents(msg: Message): MessageSticker[] {
  const containerComponent = msg.components.find(
    (c) => c.type === ComponentType.Container
  );
  if (!containerComponent) {
    throw new Error("No container component found");
  }

  const mediaGalleryComponents = containerComponent.components.find(
    (c): c is MediaGalleryComponent =>
      c.type === ComponentType.MediaGallery && c.id === MediaGalleryStickersID
  );
  if (!mediaGalleryComponents) {
    return [];
  }

  const stickers: MessageSticker[] = mediaGalleryComponents.items.map(
    (item) => {
      return {
        name: item.description || "Sticker",
        url: item.media.url,
      };
    }
  );

  return stickers;
}

export function quoteText(text: string): string {
  // Add a > to the start of each line
  return text
    .split("\n")
    .map((line) => {
      return `> ${line}`;
    })
    .join("\n");
}
