const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); // Load environment variables from .env file
const moment = require('moment-timezone'); // Add moment-timezone package

// Read and parse the configuration file
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log('Config:', config); // Debugging line to print the config

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

// Destructure the config object to get the configuration variables
const { prefix, raid_channel_name, command_channel_name, raid_size, possible_raids, commands } = config;

console.log('Raid Channel Name:', raid_channel_name); // Debugging line to check raid_channel_name
console.log('Command Channel Name:', command_channel_name); // Debugging line to check command_channel_name

let raid_schedule = [];

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
      const raid_id = uuidv4();
      raid_schedule.push({
        id: raid_id,
        name: raid_name,
        participants: [],
        time: '',
        day: '',
        extra_info: ''
      });
      message.channel.send(`Raid "${raid_name}" scheduled with ID ${raid_id}.`);
      await send_raid_info(raid_channel, null);
    } else if (command === 'settime') {
      const raid_id = args.shift();
      const time = args.join(' ');
      const raid = raid_schedule.find(r => r.id === raid_id);
      if (raid) {
        raid.time = time;
        message.channel.send(`Time for raid ID ${raid_id} set to ${time}.`);
        await send_raid_info(raid_channel, null);
      } else {
        message.channel.send(`Raid with ID ${raid_id} does not exist.`);
      }
    } else if (command === 'setday') {
      const raid_id = args.shift();
      const day = args.join(' ');
      const raid = raid_schedule.find(r => r.id === raid_id);
      if (raid) {
        raid.day = day;
        message.channel.send(`Day for raid ID ${raid_id} set to ${day}.`);
        await send_raid_info(raid_channel, null);
      } else {
        message.channel.send(`Raid with ID ${raid_id} does not exist.`);
      }
    } else if (command === 'setinfo') {
      const raid_id = args.shift();
      const extra_info = args.join(' ');
      const raid = raid_schedule.find(r => r.id === raid_id);
      if (raid) {
        raid.extra_info = extra_info;
        message.channel.send(`Extra info for raid ID ${raid_id} set to: ${extra_info}.`);
        await send_raid_info(raid_channel, null);
      } else {
        message.channel.send(`Raid with ID ${raid_id} does not exist.`);
      }
    } else if (command === 'cancelraid') {
      const raid_id = args.shift();
      const raid_index = raid_schedule.findIndex(r => r.id === raid_id);
      if (raid_index !== -1) {
        raid_schedule.splice(raid_index, 1);
        await send_raid_info(raid_channel, null);
        message.channel.send(`Raid with ID ${raid_id} has been canceled.`);
      } else {
        message.channel.send(`Raid with ID ${raid_id} does not exist.`);
      }
    }
  } 
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const [action, raid_id] = interaction.customId.split('_');

  const raid = raid_schedule.find(r => r.id === raid_id);

  if (action === 'signup' && raid) {
    if (!raid.participants.includes(interaction.user.id)) {
      raid.participants.push(interaction.user.id);
      const raid_channel = interaction.guild.channels.cache.find(channel => channel.name === raid_channel_name && channel.type === 0);
      await send_raid_info(raid_channel, interaction.user);
      await interaction.deferUpdate(); // Update the interaction without sending a response
    } else {
      await interaction.reply({ content: `You have already signed up for raid ID ${raid_id}.`, ephemeral: true });
    }
  } else if (action === 'cancel' && raid) {
    const index = raid.participants.indexOf(interaction.user.id);
    if (index !== -1) {
      raid.participants.splice(index, 1);
      const raid_channel = interaction.guild.channels.cache.find(channel => channel.name === raid_channel_name && channel.type === 0);
      await send_raid_info(raid_channel, interaction.user);
      await interaction.deferUpdate(); // Update the interaction without sending a response
    } else {
      await interaction.reply({ content: `You are not signed up for raid ID ${raid_id}.`, ephemeral: true });
    }
  } else if (['settime', 'setday', 'setinfo'].includes(action) && raid) {
    const modal = new ModalBuilder()
      .setCustomId(`${action}_${raid_id}`)
      .setTitle(`Set ${action === 'settime' ? 'Time' : action === 'setday' ? 'Day' : 'Info'}`);

    const input = new TextInputBuilder()
      .setCustomId('input')
      .setLabel(`Enter ${action === 'settime' ? 'Time (HH:mm TZ)' : action === 'setday' ? 'Day (YYYY-MM-DD)' : 'Info'}`)
      .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  const [action, raid_id] = interaction.customId.split('_');
  const raid = raid_schedule.find(r => r.id === raid_id);
  const input = interaction.fields.getTextInputValue('input');

  if (raid) {
    if (action === 'settime') {
      if (!moment(input, 'HH:mm Z', true).isValid()) {
        await interaction.reply({ content: `Invalid time format. Please enter time as HH:mm TZ (e.g., 18:00 -0500).`, ephemeral: true });
        return;
      }
      raid.time = input;
    } else if (action === 'setday') {
      if (!moment(input, 'YYYY-MM-DD', true).isValid()) {
        await interaction.reply({ content: `Invalid date format. Please enter date as YYYY-MM-DD.`, ephemeral: true });
        return;
      }
      raid.day = input;
    } else if (action === 'setinfo') {
      raid.extra_info = input;
    }
    const raid_channel = interaction.guild.channels.cache.find(channel => channel.name === raid_channel_name && channel.type === 0);
    await send_raid_info(raid_channel, interaction.user);
    await interaction.reply({ content: `${action === 'settime' ? 'Time' : action === 'setday' ? 'Day' : 'Info'} for raid ID ${raid_id} set to ${input}.`, ephemeral: true });
  } else {
    await interaction.reply({ content: `Raid with ID ${raid_id} does not exist.`, ephemeral: true });
  }
});

async function send_raid_info(channel, user) {
  await channel.bulkDelete(100, true); // Clear the channel
  const sorted_raids = raid_schedule.sort((a, b) => {
    const dateA = new Date(`${a.day} ${a.time}`);
    const dateB = new Date(`${b.day} ${b.time}`);
    return dateA - dateB;
  });

  for (const raid of sorted_raids) {
    const status = raid.participants.length >= raid_size ? '**Raid is full!**' : `**${raid_size - raid.participants.length} more needed!**`;

    const participant_embeds = await Promise.all(raid.participants.map(async userId => {
      const user = await client.users.fetch(userId);
      return new EmbedBuilder()
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setColor(0x00AE86);
    }));

    const time = raid.time ? convertTimezones(raid.time) : '';
    const day = raid.day ? `📅 **Day:** ${raid.day}` : '';
    const extra_info = raid.extra_info ? `ℹ️ **Info:** ${raid.extra_info}` : '';
    const raid_message = new EmbedBuilder()
      .setTitle(`${raid.name}`)
      .setDescription(`**Raid ID:** ${raid.id}\n\n${time}\n\n${day}\n\n${extra_info}\n\n${status}`)
      .setColor(0x00AE86);

    const buttons = new ActionRowBuilder();

    if (user && raid.participants.includes(user.id)) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`cancel_${raid.id}`)
          .setLabel('Cancel Sign Up')
          .setStyle(ButtonStyle.Danger)
      );
    } else {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`signup_${raid.id}`)
          .setLabel('Sign Up')
          .setStyle(ButtonStyle.Primary)
      );
    }

    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`settime_${raid.id}`)
        .setLabel('Set Time')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`setday_${raid.id}`)
        .setLabel('Set Day')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`setinfo_${raid.id}`)
        .setLabel('Set Info')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [raid_message, ...participant_embeds], components: [buttons] });
    await channel.send({ content: '\u200B' }); // Add extra spacing between raid posts
  }
}

function convertTimezones(time) {
  const zones = ['America/Chicago', 'America/Denver', 'America/New_York'];
  const formattedTimes = zones.map(zone => {
    const formattedTime = moment.tz(time, 'HH:mm Z', zone).format('HH:mm z');
    return `${formattedTime}`;
  }).join(' / ');
  return `🕒 **Time:** ${formattedTimes}`;
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
