# destiny-bot
A bot for my destiny clan server which helps with automatic raid scheduling and sign-ups.

## Startup
    
    ```node bot.js```

## Prerequisites

    Requires node.js.
    mac:
        ```brew install node```

    Requires dotenv for bot token:
    ```npm install dotenv```


## Usage:

!schedule: Schedules a new raid. Usage: !schedule <raid_name>

!settime: Sets the time for a raid. Usage: !settime <raid_name> <time>

!setday: Sets the day for a raid. Usage: !setday <raid_name> <day>

!setinfo: Adds additional info for a raid. Usage: !setinfo <raid_name> <info>

!signup: Signs up for a scheduled raid. Usage: !signup <raid_name>

!cancel: Cancels your sign-up for a raid. Usage: !cancel <raid_name>

!cancelraid: Cancels a scheduled raid. Usage: !cancelraid <raid_name> 