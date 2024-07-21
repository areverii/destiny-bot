# destiny-bot
A bot for my destiny clan server which helps with automatic raid scheduling and sign-ups.

## Startup
    
    ```node bot.js```

Debug:
    ```nodemon bot.js```

## Prerequisites

    Requires node.js.
    mac:
        ```brew install node```

    Required npm installs:
    ```npm install discord.js dotenv uuid moment-timezone```


## Usage:

The main command is schedule, since the embedded raid posts have UI for editing info.

    ```!schedule: Schedules a new raid. Usage: !schedule <raid_name>```

Other plumbing commands if needed:

    ```!settime: Sets the time for a raid. Usage: !settime <raid_name> <time>```

    ```!setday: Sets the day for a raid. Usage: !setday <raid_name> <day>```

    ```!setinfo: Adds additional info for a raid. Usage: !setinfo <raid_name> <info>```

    ```!signup: Signs up for a scheduled raid. Usage: !signup <raid_name>```

    ```!cancel: Cancels your sign-up for a raid. Usage: !cancel <raid_name>```

    ```!cancelraid: Cancels a scheduled raid. Usage: !cancelraid <raid_name>```