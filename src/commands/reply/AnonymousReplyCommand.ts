import { defaultStaffMessageOptions } from "services/MessageRelayService";
import { BaseReplyCommand } from "./BaseReplyCommand";

export class AnonymousReplyCommand extends BaseReplyCommand {
  commandName = "areply";
  subCommandName = null;
  aliases = ["ar"];

  protected replyOptions = {
    ...defaultStaffMessageOptions,
    anonymous: true,
  };
}
