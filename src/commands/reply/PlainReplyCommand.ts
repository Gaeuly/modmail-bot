import { defaultStaffMessageOptions } from "services/MessageRelayService";
import { BaseReplyCommand } from "./BaseReplyCommand";

export class PlainReplyCommand extends BaseReplyCommand {
  commandName = "preply";
  subCommandName = null;
  aliases = ["pr"];

  protected replyOptions = {
    ...defaultStaffMessageOptions,
    plainText: true,
  };
}
