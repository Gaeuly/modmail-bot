import { defaultStaffMessageOptions } from "services/MessageRelayService";
import { BaseReplyCommand } from "./BaseReplyCommand";

export class AnonymousPlainReplyCommand extends BaseReplyCommand {
  commandName = "apreply";
  subCommandName = null;
  aliases = ["par", "apr"];

  protected replyOptions = {
    ...defaultStaffMessageOptions,
    anonymous: true,
    plain: true,
  };
}
