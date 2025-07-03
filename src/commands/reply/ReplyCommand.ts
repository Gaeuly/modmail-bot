import { defaultStaffMessageOptions } from "services/MessageRelayService";
import { BaseReplyCommand } from "./BaseReplyCommand";

export class ReplyCommand extends BaseReplyCommand {
  commandName = "reply";
  subCommandName = null;
  aliases = ["r"];

  protected replyOptions = defaultStaffMessageOptions;
}
