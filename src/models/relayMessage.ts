import type { MessageSticker } from "./message.model";

// User that's being relayed, either staff or user
export interface RelayUser {
  id: string;
  displayName: string;
  username: string;
  displayAvatarURL(): string;
}

// Attachments relayed with a message
export interface RelayAttachment {
  name: string;
  url: string;
}

// Message from user to staff
export interface UserToStaffMessage {
  id: string;
  author: RelayUser;
  content: string;
  attachments: RelayAttachment[];
  stickers: MessageSticker[];
  forwarded?: boolean;
  createdTimestamp: number;
}

// Message from staff to user
export interface StaffToUserMessage {
  id: string;
  author: RelayUser;
  content: string;
  attachments: RelayAttachment[];
  stickers: MessageSticker[];
  forwarded?: boolean;
  createdTimestamp: number;
}

// For edits (can be further split if needed)
export interface StaffToUserMessageEdit {
  id: string;
  author: RelayUser;
  content: string;
  attachments: string[]; // Array of URLs
  stickers: MessageSticker[];
  forwarded?: boolean;
  createdTimestamp: number;
}

export type StaffRelayMessage = StaffToUserMessage | StaffToUserMessageEdit;
