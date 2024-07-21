const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
require('dotenv').config(); // Load environment variables from .env file

// Read and parse the configuration file
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log('Config:', config); // Debugging line to print the config

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// Destructure the config object to get the configuration variables
const { prefix, raid_channel_name, command_channel_name, raid_size, possible_raids, commands } = config;

console.log('Raid Channel Name:', raid_channel_name); // Debugging line to check raid_channel_name
console.log('Command Channel Name:', command_channel_name); // Debugging line to check command_channel_name

let raid_schedule = {};
let pinnedMessageId = null;

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  const commandChannel = client.channels.cache.find(channel => channel.name === command_channel_name && channel.type === 0);

  if (commandChannel) {
    await updatePinnedMessage(commandChannel);
  }

  // List all channels for debugging
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => {
      console.log(`Channel: ${channel.name}, Type: ${channel.type}`);
    });
  });
});

client.on('messageCreate', async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'schedule' || command === 'settime' || command === 'setday' || command === 'setinfo' || command === 'cancelraid') {
    const raid_name_input = args.join(' ').toLowerCase();
    const raid_name = getRaidName(raid_name_input);
  
    if (!raid_name) {
      message.channel.send(`Invalid raid name or alias. Possible raids are: ${Object.keys(possible_raids).join(', ')}`);
      return;
    }

    const raid_channel = message.guild.channels.cache.find(channel => channel.name === raid_channel_name && channel.type === 0);
    const command_channel = message.guild.channels.cache.find(channel => channel.name === command_channel_name && channel.type === 0);

    console.log(`Raid Channel: ${raid_channel ? raid_channel.name : 'Not Found'}`);
    console.log(`Command Channel: ${command_channel ? command_channel.name : 'Not Found'}`);
    console.log(`Current Channel: ${message.channel.name}`);
    console.log(`Comparing: ${message.channel.name} === ${command_channel_name}`);

    if (!command_channel) {
      message.channel.send(`Please create a channel named #${command_channel_name} for commands.`);
      return;
    }

    if (!raid_channel) {
      message.channel.send(`Could not find the "${raid_channel_name}" channel. Please create it and try again.`);
      return;
    }

    if (command === 'schedule') {
      if (raid_schedule[raid_name]) {
        message.channel.send(`Raid "${raid_name}" is already scheduled.`);
        return;
      }
      raid_schedule[raid_name] = {
        participants: [],
        time: '',
        day: '',
        extra_info: ''
      };
      message.channel.send(`Raid "${raid_name}" scheduled.`);
      await send_raid_info(raid_channel, raid_name, null);
    } else if (command === 'settime') {
      const time = args.join(' ');
      if (raid_schedule[raid_name]) {
        raid_schedule[raid_name].time = time;
        message.channel.send(`Time for "${raid_name}" set to ${time}.`);
        await send_raid_info(raid_channel, raid_name, null);
      } else {
        message.channel.send(`Raid "${raid_name}" does not exist.`);
      }
    } else if (command === 'setday') {
      const day = args.join(' ');
      if (raid_schedule[raid_name]) {
        raid_schedule[raid_name].day = day;
        message.channel.send(`Day for "${raid_name}" set to ${day}.`);
        await send_raid_info(raid_channel, raid_name, null);
      } else {
        message.channel.send(`Raid "${raid_name}" does not exist.`);
      }
    } else if (command === 'setinfo') {
      const extra_info = args.join(' ');
      if (raid_schedule[raid_name]) {
        raid_schedule[raid_name].extra_info = extra_info;
        message.channel.send(`Extra info for "${raid_name}" set to: ${extra_info}.`);
        await send_raid_info(raid_channel, raid_name, null);
      } else {
        message.channel.send(`Raid "${raid_name}" does not exist.`);
      }
    } else if (command === 'cancelraid') {
      if (raid_schedule[raid_name]) {
        delete raid_schedule[raid_name];
        await raid_channel.bulkDelete(100, true); // Clear the raid channel
        await message.channel.send(`Raid "${raid_name}" has been canceled.`);
      } else {
        message.channel.send(`Raid "${raid_name}" does not exist.`);
      }
    }
  } 
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const [action, raid_name] = interaction.customId.split('_');

  if (action === 'signup' && raid_schedule[raid_name]) {
    if (!raid_schedule[raid_name].participants.includes(interaction.user.username)) {
      raid_schedule[raid_name].participants.push(interaction.user.username);
      const raid_channel = interaction.guild.channels.cache.find(channel => channel.name === raid_channel_name && channel.type === 0);
      await send_raid_info(raid_channel, raid_name, interaction.user.username);
      await interaction.deferUpdate(); // Update the interaction without sending a response
    } else {
      await interaction.reply({ content: `You have already signed up for "${raid_name}".`, ephemeral: true });
    }
  } else if (action === 'cancel' && raid_schedule[raid_name]) {
    const index = raid_schedule[raid_name].participants.indexOf(interaction.user.username);
    if (index !== -1) {
      raid_schedule[raid_name].participants.splice(index, 1);
      const raid_channel = interaction.guild.channels.cache.find(channel => channel.name === raid_channel_name && channel.type === 0);
      await send_raid_info(raid_channel, raid_name, interaction.user.username);
      await interaction.deferUpdate(); // Update the interaction without sending a response
    } else {
      await interaction.reply({ content: `You are not signed up for "${raid_name}".`, ephemeral: true });
    }
  }
});

async function send_raid_info(channel, raid_name, username) {
  await channel.bulkDelete(100, true); // Clear the channel
  const details = raid_schedule[raid_name];
  const status = details.participants.length >= raid_size ? '**Raid is full!**' : `**${raid_size - details.participants.length} more needed!**`;
  const participants_list = details.participants.length ? details.participants.map((user, index) => `${index + 1}. ${user}`).join('\n') : 'No one has signed up yet.';
  const time = details.time ? `🕒 **Time:** ${details.time}` : '';
  const day = details.day ? `📅 **Day:** ${details.day}` : '';
  const extra_info = details.extra_info ? `ℹ️ **Info:** ${details.extra_info}` : '';
  const message = `**${raid_name}**\nParticipants (${details.participants.length}/${raid_size}):\n${participants_list}\n\n${time}\n${day}\n${extra_info}\n\n${status}`;

  const buttons = new ActionRowBuilder();

  if (username && details.participants.includes(username)) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`cancel_${raid_name}`)
        .setLabel('Cancel Sign Up')
        .setStyle(ButtonStyle.Danger)
    );
  } else {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`signup_${raid_name}`)
        .setLabel('Sign Up')
        .setStyle(ButtonStyle.Primary)
    );
  }

  await channel.send({ content: message, components: [buttons] });
}

async function updatePinnedMessage(channel) {
  const newContent = getCommandList();

  // Check for existing pinned messages
  const pinnedMessages = await channel.messages.fetchPinned();
  let existingMessage = null;

  pinnedMessages.forEach(msg => {
    if (msg.author.id === client.user.id) {
      existingMessage = msg;
    }
  });

  if (existingMessage) {
    // Check if content has changed
    if (existingMessage.content !== newContent) {
      await existingMessage.edit(newContent);
    }
  } else {
    // No existing message, send a new one
    const newMessage = await channel.send(newContent);
    await newMessage.pin();
  }
}

function getCommandList() {
  let commandList = '**Raid Bot Commands**\n\n';
  for (const [command, description] of Object.entries(commands)) {
    commandList += `**!${command}**: ${description}\n\n`;
  }
  return commandList.trim();
}

function getRaidName(input) {
  input = input.toLowerCase();
  for (const [raid, aliases] of Object.entries(possible_raids)) {
    if (raid.toLowerCase() === input || aliases.map(alias => alias.toLowerCase()).includes(input)) {
      return raid;
    }
  }
  return null;
}

client.login(process.env.DISCORD_BOT_TOKEN);
