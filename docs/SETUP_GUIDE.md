# ModMail Setup Guide

This guide will walk you through the initial setup of the sushii-modmail
bot, from installing the bot to configuring it for your server.

> [!TIP]
> Already have the bot running and set up and just need to know how to use it?
> Check out the [User Guide](./USER_GUIDE.md) for a walkthrough of common
> commands and features.

Once the bot is running, add the bot to your server. The invite URL will be
logged to the console when the bot starts. You can also use the following link
which includes the basic permissions needed, replacing `YOUR_BOT_ID` with your
bot's actual ID:

```
https://discord.com/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=515396455488&integration_type=0&scope=applications.commands+bot
```

In your server, use the `settings` command to set up additional configuration,
such as the channel to use for ModMail threads, roles that can use the bot, and
more.

> [!IMPORTANT]
> You'll also need to ensure the bot has permissions in the forum channel after
> you selected it in the `settings` command. This
> **needs to be done manually** in the Discord channel settings to ensure it
> works properly.
> 
> The bot by default does **not** have every permission it needs, as it only
> needs it in the single forum channel and not everywhere else in the server.

Required ModMail Forum channel permissions:
- **Manage Channel** - Creates and manage forum tags, e.g. "Open" and "Closed"
  tags.
- **Create Posts** - Create new threads in the forum channel.
- **Manage Threads** - Manage threads, including closing and locking them when
  closed.
- **Manage Messages** - Deletes staff messages after using a reply command to
  keep threads clean.

Optional permissions:
- **Mention @everyone, @here, and All Roles** - Only if you want the bot to
  be able to use a notification role **that is not already mentionable**. If
  you are using a role like `@Mod` which is already mentionable by anyone, you
  do not need to give the bot this permission.

## Additional Servers

You can add the bot to additional servers by using the same invite URL as above.

The bot is designed serve a single **primary modmail server**, where all modmail
threads are created and managed.

However, it may be useful to add the bot to additional servers, for example to
contact the staff for ban appeals.

> [!NOTE]
> Commands will **only work in the primary server**. Additional servers are not
> supported for commands and are only for allowing users more access to the bot.
>
> If you want to use the bot for a different server for it's own modmail
> channel, you will need to run a separate instance of the bot with a different
> primary server ID.
