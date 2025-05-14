//
//
// The translation from French to English is not yet finished ;)
//
//



const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildScheduledEvents
  ]
});

const fs = require('fs');
const path = require('path');

async function sendLog(title, description, color = '#0099FF', fields = [], thumbnail = null) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }
  
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  try {
    const logChannel = await client.channels.fetch(config.logChannelId);
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

async function sendSystemLog(title, description, color = '#FFA500') {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`⚙️ ${title}`)
    .setDescription(description)
    .setTimestamp();

  try {
    const logChannel = await client.channels.fetch(config.logChannelId);
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending system log:', error);
  }
}

const warnsDB = new Map();

function createHelpEmbed() {
  return new EmbedBuilder()
    .setColor('#122e2f')
    .setTitle('📝 Bot Commands')
    .setDescription('Here are all available commands:')
    .addFields(
      { name: '📨 Invitations', value: '$invite @member - Sends a permanent invitation\n$inviteall @server - Generates an invitation for an entire server' },
      { name: '📩 Messages', value: '$dmcustom user @mention "message"\n$dmcustom server @server "message"' },
      { name: 'ℹ️ Information', value: '$serverinfo - Server information\n$userinfo @member - Member information\n$ping - Checks latency' },
      { name: '🎉 Fun', value: '$meme - Sends a random meme\n$coinflip - Flips a coin\n$dice [faces] - Rolls a die\n$love @user1 @user2 - Affinity calculator' },
      { name: '📊 Polls', value: '$poll "question" "choice1" "choice2" - Creates a poll' },
      { name: '🤖 gpt-3.5-turbo', value: '$question "question" - Ask a question' },
      { name: '🛠️ Basic Moderation', value: '$kick @member [reason]\n$ban @member [reason]\n$mute @member [duration]\n$warn @member [reason]\n$logs [number]\n$clear [number] - Deletes messages' },
      { name: '🔒 Advanced Moderation', value: '$slowmode [duration] - Activates slowmode\n$lock / $unlock - Locks a channel\n$giveaway [duration] [reward] - Starts a giveaway\n$qr "text" - Generates a QR code\n$banall @user - Bans the user from all servers' }
    )
    .setFooter({ text: 'Bot developed by 7Joris' });
}

async function setupTicketSystem() {
  try {
    const ticketChannel = await client.channels.fetch(config.ticketChannelId);
    const messages = await ticketChannel.messages.fetch();
    
    messages.forEach(async msg => {
      if (msg.author.id === client.user.id && msg.embeds.length > 0 && msg.embeds[0].title === 'Ticket System') {
        await msg.delete();
      }
    });

    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle('Ticket System')
      .setDescription('Click on the button corresponding to your request to make a ticket.\n\n• 🛒 Purchase\n• 🔧 Technical Support')
      .setFooter({ text: 'Tickets are private and will only be visible to you and staff.' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_achat')
          .setLabel('Purchase')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛒'),
        new ButtonBuilder()
          .setCustomId('ticket_technique')
          .setLabel('Technical Support')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔧')
      );

    await ticketChannel.send({ 
      embeds: [embed], 
      components: [row] 
    });

  } catch (error) {
    console.error('Error configuring ticket system:', error);
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('ticket_')) {
    const type = interaction.customId.split('_')[1];
    const user = interaction.user;
    const guild = interaction.guild;

    const existingChannel = guild.channels.cache.find(ch => 
      ch.name === `ticket-${user.username.toLowerCase()}` ||
      ch.topic === user.id
    );

    if (existingChannel) {
      return interaction.reply({ 
        content: `You already have an open ticket: ${existingChannel.toString()}`, 
        ephemeral: true 
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const categoryId = config.ticketCategories[type];
      const ticketName = `ticket-${user.username.toLowerCase()}`;
      
      const channel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: user.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels
            ]
          }
        ]
      });

      let ticketType;
      switch(type) {
        case 'purchase': ticketType = '🛒 Purchase'; break;
        case 'technical': ticketType = '🔧 Technical Support'; break;
        default: ticketType = 'Ticket';
      }

      const ticketEmbed = new EmbedBuilder()
        .setColor('#122e2f')
        .setTitle(ticketType)
        .setDescription(`Good morning ${user.toString()}!\n\nA staff member will take care of you quickly.\n\nYou can describe your problem or request here.`)
        .addFields(
          { name: 'User', value: user.tag, inline: true },
          { name: 'ID', value: user.id, inline: true }
        )
        .setFooter({ text: 'Ticket created on' })
        .setTimestamp();

      const closeButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

      await channel.send({ 
        content: `${user.toString()} <@&1362063720800321717>`,
        embeds: [ticketEmbed],
        components: [closeButton]
      });

      await interaction.editReply({ 
        content: `Your ticket has been created: ${channel.toString()}`, 
        ephemeral: true 
      });

      await sendLog(
        '🎫 Ticket created',
        `${user.tag} created a ticket`,
        '#00FF00',
        [
          { name: 'Type', value: ticketType, inline: true },
          { name: 'Channel', value: channel.toString(), inline: true },
          { name: 'User ID', value: user.id, inline: true }
        ],
        user.displayAvatarURL()
      );

    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.editReply({ 
        content: 'An error occurred while creating your ticket.', 
        ephemeral: true 
      });
    }
  }

  if (interaction.customId === 'close_ticket') {
    const channel = interaction.channel;
    const user = interaction.user;

    if (!channel.name.startsWith('ticket-') && !channel.topic) {
      return interaction.reply({ 
        content: 'This is not a ticket lounge.', 
        ephemeral: true 
      });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && channel.topic !== user.id) {
      return interaction.reply({ 
        content: 'You do not have permission to close this ticket.', 
        ephemeral: true 
      });
    }

    try {
      await interaction.deferReply();

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Ticket closed')
        .setDescription(`This ticket was closed by ${user.toString()}`)
        .setFooter({ text: 'The room will be deleted in 10 seconds' });

      await channel.send({ embeds: [embed] });
      await interaction.editReply({ content: 'The ticket has been closed.' });

      setTimeout(() => {
        channel.delete().catch(console.error);
      }, 10000);

      await sendLog(
        '🎫 Ticket closed',
        `${user.tag} closed a ticket`,
        '#FF0000',
        [
          { name: 'Channel', value: channel.name, inline: true },
          { name: 'User ID', value: channel.topic || 'Unknown', inline: true }
        ],
        user.displayAvatarURL()
      );

    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.editReply({ 
        content: 'An error occurred while closing the ticket.', 
        ephemeral: true 
      });
    }
  }
});

async function updateMemberCountStatus(client) {
  try {
    let totalMembers = 0;
    const memberIds = new Set();

    for (const guild of client.guilds.cache.values()) {
      const members = await guild.members.fetch();
      members.forEach(member => memberIds.add(member.id));
    }
    
    totalMembers = memberIds.size;

    await client.user.setPresence({
      activities: [{
        name: `${totalMembers.toLocaleString()} members`,
        type: ActivityType.Watching
      }],
      status: 'online'
    });

    console.log(`[Status] Updated: ${totalMembers} unique members`);
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

async function fetchRandomMeme() {
  try {
    const response = await fetch('https://meme-api.com/gimme');
    const data = await response.json();
    return data.url || 'https://i.imgur.com/8QZQZQZ.png';
  } catch {
    return 'https://i.imgur.com/8QZQZQZ.png';
  }
}

function calculateLove(name1, name2) {
  const combined = (name1 + name2).toLowerCase();
  let score = 0;
  for (let i = 0; i < combined.length; i++) {
    score += combined.charCodeAt(i);
  }
  return (score % 100) + 1;
}

client.on('ready', () => {
  console.log(`✅ Bot started`);

  sendSystemLog('Bot started', `New session started at ${new Date().toLocaleString()}`);
  
  updateMemberCountStatus(client);
  setInterval(() => updateMemberCountStatus(client), 3600000);

  setupTicketSystem();
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '$paypal') {
    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle('💳 PayPal Information')
      .setDescription('PayPal Only F&F')
      .addFields(
        { name: 'Email', value: '```paypal@paypal```', inline: false }
      )
      .setFooter({ text: 'Thanks for your support!' });
  
    await message.reply({ embeds: [embed] });
  }

  if (message.content === '$crypto') {
    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle('💳 Crypto Information')
      .setDescription('Crypto Only LTC')
      .addFields(
        { name: 'LTC', value: '```xXxXxXxXxXx```', inline: false }
      )
      .setFooter({ text: 'Thanks for your support!' });
  
    await message.reply({ embeds: [embed] });
  }

  if (message.content.startsWith('$question ')) {
    const input = message.content.match(/\$question\s+"(.+?)"/);
    if (!input) return message.reply('❌ Use : `$question "your question"`');
  
    const question = input[1];
  
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openAiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant in a Discord server." },
            { role: "user", content: question }
          ]
        })
      });
  
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "❌ No response generated.";
      await message.reply(answer);
    } catch (error) {
      console.error("Error IA:", error);
      await message.reply("❌ An error occurred while requesting AI.");
    }
  }

  if (message.content === '$help') {
    return message.reply({ embeds: [createHelpEmbed()] });
  }

  if (message.content.startsWith('$invite')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Only administrators can use this command');
    }

    if (message.content.startsWith('$invite ')) {
      const member = message.mentions.members.first();
      if (!member) return message.reply('❌ Mention a member');

      try {
        const invite = await message.channel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true
        });
        await member.send(`🔗 Invitation for ${message.guild.name}:\n${invite.url}`);
        message.reply(`✅ Invitation sent to ${member.user.tag}`);
      } catch (error) {
        message.reply('❌ Error creating invitation');
      }
    }
    
    if (message.content.startsWith('$inviteall ')) {
      const targetGuildId = message.content.split(' ')[1];
      if (!targetGuildId) return message.reply('❌ Specify the server ID');

      try {
        const targetGuild = await client.guilds.fetch(targetGuildId);
        const invite = await message.channel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true
        });

        let successCount = 0;
        let errorCount = 0;
        
        const members = await targetGuild.members.fetch();
        members.forEach(async member => {
          try {
            await member.send(`🔗 Invitation for ${message.guild.name}:\n${invite.url}`);
            successCount++;
          } catch (err) {
            errorCount++;
          }
        });

        message.reply(`✅ Invitations sent to ${successCount} members (${errorCount} error)`);
      } catch (error) {
        message.reply('❌ Error: Server not found or insufficient permissions');
      }
    }
  }

  if (message.content.startsWith('$dmcustom')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Only administrators can use this command');
    }

    const args = message.content.split(' ').slice(1);

    if (args[0] === 'user' && message.mentions.users.first()) {
      const targetUser = message.mentions.users.first();
      const customMessage = message.content.split('"')[1] || "No message specified";
    
      try {
        await targetUser.send(customMessage);
        message.reply(`✅ Message sent to ${targetUser.tag}`);
      } catch (error) {
        message.reply(`❌ Unable to send message to ${targetUser.tag}`);
      }
    }

    else if (args[0] === 'server' && args[1]) {
      const targetGuildId = args[1];
      const customMessage = message.content.split('"')[1] || "No message specified";
    
      try {
        const targetGuild = await client.guilds.fetch(targetGuildId);
        const members = await targetGuild.members.fetch();
      
        let successCount = 0;
        let errorCount = 0;
      
        members.forEach(async member => {
          try {
            await member.send(customMessage);
            successCount++;
          } catch (err) {
            errorCount++;
          }
        });
      
        message.reply(`✅ Messages sent to ${successCount} members (${errorCount} error)`);
      } catch (error) {
        message.reply('❌ Error: Server not found or insufficient permissions');
      }
    } else {
      message.reply('❌ Usage:\n`$dmcustom user @mention "message"`\n`$dmcustom server server_id "message"`');
    }
  }

  if (message.content === '$serverinfo') {
    const guild = message.guild;
    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle(`ℹ️ Information on ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Created on', value: guild.createdAt.toLocaleDateString(), inline: true },
        { name: '👑 Owner', value: (await guild.fetchOwner()).user.tag, inline: true },
        { name: '📊 Statistics', value: `Channels: ${guild.channels.cache.size}\nRoles: ${guild.roles.cache.size}\nEmojis: ${guild.emojis.cache.size}`, inline: false }
      )
      .setFooter({ text: `ID: ${guild.id}` });
    return message.reply({ embeds: [embed] });
  }

  if (message.content.startsWith('$userinfo')) {
    const member = message.mentions.members.first() || message.member;
    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle(`👤 ${member.user.tag}`)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: '🆔 ID', value: member.id, inline: true },
        { name: '📅 Join the', value: member.joinedAt.toLocaleDateString(), inline: true },
        { name: '🎂 Created on', value: member.user.createdAt.toLocaleDateString(), inline: true },
        { name: '🎭 Roles', value: member.roles.cache.map(r => r.name).join(', ').slice(0, 1024) || 'None', inline: false }
      )
      .setFooter({ text: `Status: ${member.presence?.status || 'unknown'}` });
    return message.reply({ embeds: [embed] });
  }

  if (message.content === '$ping') {
    const msg = await message.reply('🏓 Pong!');
    const latency = msg.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    await msg.edit(`🏓 Pong!\nBot latency: ${latency}ms\nAPI Latency: ${apiLatency}ms`);
  }

  if (message.content.startsWith('$poll')) {
    const args = message.content.split('"').filter(arg => arg.trim() !== '');
    if (args.length < 3) {
      return message.reply('❌ Usage: $poll "question" "choice1" "choice2" ...');
    }

    const question = args[1];
    const choices = args.slice(2);
    
    if (choices.length > 10) {
      return message.reply('❌ Maximum 10 choices allowed');
    }

    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle(`📊 Survey: ${question}`)
      .setDescription(choices.map((choice, i) => `${i+1}. ${choice}`).join('\n'))
      .setFooter({ text: `Survey created by ${message.author.tag}` });

    const pollMessage = await message.channel.send({ embeds: [embed] });
    
    for (let i = 0; i < choices.length; i++) {
      await pollMessage.react(`${i+1}️⃣`);
    }

    await message.delete();
  }

  if (message.content.startsWith('$clear')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You do not have permission to manage messages');
    }

    const amount = parseInt(message.content.split(' ')[1]) || 10;
    if (amount > 100) return message.reply('❌ Maximum 100 messages at a time');

    await message.channel.bulkDelete(amount + 1, true);
    const reply = await message.channel.send(`✅ ${amount} deleted messages`);
    setTimeout(() => reply.delete(), 3000);
  }

  if (message.content === '$meme') {
    const memeUrl = await fetchRandomMeme();
    await message.reply(memeUrl);
  }

  if (message.content === '$coinflip') {
    const result = Math.random() > 0.5 ? 'Heads' : 'tails';
    await message.reply(`🪙 Result: **${result}**`);
  }

  if (message.content.startsWith('$dice')) {
    const faces = parseInt(message.content.split(' ')[1]) || 6;
    if (faces < 2 || faces > 100) {
      return message.reply('❌ The die must have between 2 and 100 faces');
    }
    const result = Math.floor(Math.random() * faces) + 1;
    await message.reply(`🎲 Result (d${faces}): **${result}**`);
  }

  if (message.content.startsWith('$love')) {
    const users = message.mentions.users;
    if (users.size !== 2) {
      return message.reply('❌ Mention exactly 2 users');
    }
    
    const [user1, user2] = users.map(u => u.username);
    const score = calculateLove(user1, user2);
    
    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle('💖 Affinity calculation')
      .setDescription(`**${user1}** ❤️ **${user2}**`)
      .addFields({ name: 'Score', value: `${score}%`, inline: true })
      .setFooter({ text: 'This is just for fun!' });
    
    await message.reply({ embeds: [embed] });
  }

  if (message.content.startsWith('$kick')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ You do not have permission to kick members');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to be expelled');

    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason specified';

    try {
      await member.kick(reason);
      await message.reply(`✅ ${member.user.tag} was expelled. Reason: ${reason}`);
    } catch (error) {
      await message.reply('❌ Unable to kick this member');
    }
  }

  if (message.content.startsWith('$ban')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ You do not have permission to ban members');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to ban');

    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason specified';

    try {
      await member.ban({ reason });
      await message.reply(`✅ ${member.user.tag} has been banned. Reason: ${reason}`);
    } catch (error) {
      await message.reply('❌ Unable to ban this member');
    }
  }

  if (message.content.startsWith('$mute')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply('❌ You do not have permission to mute members.');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to mute');

    const duration = message.content.split(' ')[2] || '60m';
    let time = parseInt(duration) * 60000;

    if (duration.includes('h')) time = parseInt(duration) * 3600000;
    if (duration.includes('d')) time = parseInt(duration) * 86400000;

    try {
      await member.timeout(time);
      await message.reply(`✅ ${member.user.tag} was rendered mute for ${duration}`);
    } catch (error) {
      await message.reply('❌ Unable to mute this member');
    }
  }

  if (message.content.startsWith('$warn')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ You do not have permission to notify members');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to notify');

    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason specified';

    if (!warnsDB.has(member.id)) {
      warnsDB.set(member.id, []);
    }

    warnsDB.get(member.id).push({
      moderator: message.author.tag,
      reason,
      date: new Date().toISOString()
    });

    const warnCount = warnsDB.get(member.id).length;
    await message.reply(`⚠️ ${member.user.tag} received a warning (Total: ${warnCount}). Reason: ${reason}`);
  }

  if (message.content.startsWith('$logs')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
      return message.reply('❌ You do not have permission to view the logs');
    }

    const limit = parseInt(message.content.split(' ')[1]) || 5;
    const logs = await message.guild.fetchAuditLogs({ limit });

    const embed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle(`📜 Latest ${limit} moderator actions`)
      .setDescription(logs.entries.map(entry => {
        return `**${entry.action}** - ${entry.executor?.tag || 'Unknown'}\nTarget: ${entry.target?.tag || 'Unknown'}\nReason: ${entry.reason || 'Unknown'}\n`;
      }).join('\n'))
      .setFooter({ text: `Requested by ${message.author.tag}` });

    await message.reply({ embeds: [embed] });
  }

  if (message.content.startsWith('$slowmode')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ You must have the "Manage Rooms" permission."');
    }

    const duration = message.content.split(' ')[1];
    if (!duration) return message.reply('❌ Specify a duration (eg: 5s, 10m)');

    let seconds;
    if (duration.endsWith('s')) seconds = parseInt(duration);
    else if (duration.endsWith('m')) seconds = parseInt(duration) * 60;
    else if (duration.endsWith('h')) seconds = parseInt(duration) * 3600;
    else seconds = parseInt(duration);

    if (isNaN(seconds)) return message.reply('❌ Invalid duration');;
    if (seconds < 0 || seconds > 21600) return message.reply('❌ Duration must be between 0s and 6h');

    try {
      await message.channel.setRateLimitPerUser(seconds);
      message.reply(`✅ Slowmode activated: ${seconds} seconds`);
    } catch (error) {
      message.reply('❌ Error configuring slowmode');
    }
  }

  if (message.content === '$lock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ You must have the "Manage Rooms" permission');
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      message.reply('🔒 Locked Channels');
    } catch (error) {
      message.reply('❌ Error while locking');
    }
  }

  if (message.content === '$unlock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ You must have the "Manage Channels" permission');
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });
      message.reply('🔓 Unlocked Channels');
    } catch (error) {
      message.reply('❌ Error while unlocking');
    }
  }

  if (message.content.startsWith('$giveaway')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You must have the "Manage Messages" permission."');
    }

    const args = message.content.split(' ').slice(1);
    if (args.length < 2) {
      return message.reply('❌ Usage: $giveaway [duration] [reward] (eg: $giveaway 1h Nitro)');
    }

    const duration = args[0];
    const prize = args.slice(1).join(' ');

    let timeMs;
    if (duration.endsWith('s')) timeMs = parseInt(duration) * 1000;
    else if (duration.endsWith('m')) timeMs = parseInt(duration) * 60000;
    else if (duration.endsWith('h')) timeMs = parseInt(duration) * 3600000;
    else if (duration.endsWith('d')) timeMs = parseInt(duration) * 86400000;
    else timeMs = parseInt(duration) * 60000;

    if (isNaN(timeMs)) return message.reply('❌ Invalid duration');

    const endTime = Date.now() + timeMs;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(`Reward: **${prize}**\nEnd: <t:${Math.floor(endTime/1000)}:R>\nReact with 🎁 to participate!`)
      .setFooter({ text: `Organized by ${message.author.tag}` });

    const giveawayMsg = await message.channel.send({ embeds: [embed] });
    await giveawayMsg.react('🎁');

    setTimeout(async () => {
      const finishedMsg = await message.channel.messages.fetch(giveawayMsg.id);
      const reaction = finishedMsg.reactions.cache.get('🎁');
      const participants = await reaction.users.fetch();

      const validParticipants = participants.filter(u => !u.bot);
      
      if (validParticipants.size === 0) {
        return message.channel.send('❌ No one participated in the giveaway...');
      }

      const winner = validParticipants.random();
      
      const resultEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 GIVEAWAY FINISHED 🎉')
        .setDescription(`Congratulations ${winner}!\nYou won: **${prize}**`)
        .setFooter({ text: `${validParticipants.size} participants` });

      message.channel.send({ 
        content: `🎉 ${winner} won **${prize}**!`,
        embeds: [resultEmbed]
      });
    }, timeMs);

    message.delete();
  }

  if (message.content.startsWith('$qr')) {
    const text = message.content.split('"')[1] || message.content.split(' ')[1];
    if (!text) return message.reply('❌ Specify a text (eg: $qr "https://google.com")');

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
    
    const embed = new EmbedBuilder()
      .setColor('#000000')
      .setTitle('QR Code Generated')
      .setImage(qrUrl)
      .setFooter({ text: `Requested by ${message.author.tag}` });

      message.reply({ embeds: [embed] });
  }

  if (message.content.startsWith('$banall')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('❌ Only administrators can use this command');
    }

    const user = message.mentions.users.first();
    if (!user) return message.reply('❌ Mention a user to ban from all servers');

    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason specified';

    try {
        let banCount = 0;
        let failCount = 0;
        const guilds = client.guilds.cache;

        const progressMsg = await message.reply(`⚙️ Attempting to ban ${user.tag} on ${guilds.size} servers...`);

        for (const [guildId, guild] of guilds) {
            try {
                const me = await guild.members.fetch(client.user.id);
                if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                    failCount++;
                    continue;
                }

                await guild.bans.create(user.id, { reason: `[BanAll] ${reason}` });
                banCount++;

                if (banCount % 5 === 0 || banCount + failCount === guilds.size) {
                    await progressMsg.edit(`⚙️ Progress: ${banCount + failCount}/${guilds.size} processed servers (${banCount} successful bans, ${failCount} error)`);
                }
            } catch (error) {
                failCount++;
            }
        }

        await progressMsg.edit(`✅ ${user.tag} was banned from ${banCount} servers (${failCount} error)`);
    } catch (error) {
        console.error('Errorr BanAll:', error);
        message.reply('❌ An error occurred during the BanAll operation');
    }
}

});

client.on('guildMemberAdd', async member => {
  const accountAge = Math.floor((Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24));
  
  await sendLog(
    '👤 New member',
    `${member.user.tag} joined the server`,
    '#00FF00',
    [
      { name: 'ID', value: member.id, inline: true },
      { name: 'Account created', value: `${member.user.createdAt.toLocaleString()} (${accountAge} days)`, inline: true },
      { name: 'Number of members', value: member.guild.memberCount.toString(), inline: true }
    ],
    member.user.displayAvatarURL()
  );

  try {
    const welcomeChannel = await client.channels.fetch(config.welcomeChannelId);
    
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#122e2f')
      .setTitle(`Welcome to ${member.guild.name} !`)
      .setDescription(`**A new member joined us :** ${member.toString()}\n\nWe are now **${member.guild.memberCount}** !`)
      .setThumbnail(member.user.displayAvatarURL())
      .setImage('https://cdn.discordapp.com/attachments/1119003467034406934/1363315610091524237/Nouveau_projet_1.png?ex=6805961a&is=6804449a&hm=e54f5a0d94632babbdb51088ed90aa942c298799a3355f628905f4b73febcad3&')
      .addFields(
        { 
          name: '📋 Informations', 
          value: `**Account created:** ${member.user.createdAt.toLocaleDateString()} (${accountAge} days)`,
          inline: false 
        },
        { 
          name: '👋 First steps', 
          value: 'Introduce yourself in <#1362063107064598653> !',
          inline: false 
        }
      )
      .setFooter({ text: `Have fun ${member.user.username} !` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🛒 Purchase')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.com/channels/1362059253963165757/1362568685361037332')
    );

    await welcomeChannel.send({ 
      embeds: [welcomeEmbed], 
      components: [row] 
    });

  } catch (error) {
    console.error('Error :', error);
  }
});

client.on('guildMemberRemove', async member => {
  const joinedDays = member.joinedAt ? Math.floor((Date.now() - member.joinedAt) / (1000 * 60 * 60 * 24)) : 'Unknown';
  
  await sendLog(
    '👤 Member left',
    `${member.user.tag} left the server`,
    '#FF0000',
    [
      { name: 'ID', value: member.id, inline: true },
      { name: 'Joined the', value: member.joinedAt?.toLocaleString() || 'Unknown', inline: true },
      { name: 'Was a member during', value: `${joinedDays} days`, inline: true },
      { name: 'Roles', value: member.roles.cache.size > 1 ? member.roles.cache.map(r => r.name).filter(name => name !== '@everyone').join(', ') : 'None', inline: false }
    ],
    member.user.displayAvatarURL()
  );
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const changes = [];

  if (oldMember.nickname !== newMember.nickname) {
    changes.push({
      name: '📝 Nickname changed',
      value: `**Before:** ${oldMember.nickname || 'None'}\n**After:** ${newMember.nickname || 'None'}`,
      inline: false
    });
  }

  if (!oldMember.roles.cache.equals(newMember.roles.cache)) {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    
    if (addedRoles.size > 0) {
      changes.push({
        name: '➕ Added roles',
        value: addedRoles.map(role => role.name).join(', '),
        inline: true
      });
    }
    
    if (removedRoles.size > 0) {
      changes.push({
        name: '➖ Roles removed',
        value: removedRoles.map(role => role.name).join(', '),
        inline: true
      });
    }
  }

  if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
    if (newMember.communicationDisabledUntil) {
      changes.push({
        name: '⏳ Mute applied',
        value: `Until: ${newMember.communicationDisabledUntil.toLocaleString()}`,
        inline: false
      });
    } else {
      changes.push({
        name: '🔊 Mute removed',
        value: 'Member is no longer muted',
        inline: false
      });
    }
  }
  
  if (changes.length > 0) {
    await sendLog(
      '👤 Member updated',
      `${newMember.user.tag} has been modified`,
      '#FFFF00',
      [
        { name: 'ID', value: newMember.id, inline: true },
        ...changes
      ],
      newMember.user.displayAvatarURL()
    );
  }
});

client.on('channelCreate', async channel => {
  const channelType = {
    [ChannelType.GuildText]: 'Textuel',
    [ChannelType.GuildVoice]: 'Vocal',
    [ChannelType.GuildCategory]: 'Catégorie',
    [ChannelType.GuildNews]: 'Annonces',
    [ChannelType.GuildStageVoice]: 'Scène',
    [ChannelType.GuildForum]: 'Forum',
  }[channel.type] || 'Unknown';

  await sendLog(
    '📌 Salon créé',
    `Un nouveau salon a été créé`,
    '#00FF00',
    [
      { name: 'Nom', value: channel.name, inline: true },
      { name: 'Type', value: channelType, inline: true },
      { name: 'ID', value: channel.id, inline: true }
    ]
  );
});

client.on('channelDelete', async channel => {
  const channelType = {
    [ChannelType.GuildText]: 'Textuel',
    [ChannelType.GuildVoice]: 'Vocal',
    [ChannelType.GuildCategory]: 'Catégorie',
    [ChannelType.GuildNews]: 'Annonces',
    [ChannelType.GuildStageVoice]: 'Scène',
    [ChannelType.GuildForum]: 'Forum',
  }[channel.type] || 'Unknown';

  await sendLog(
    '📌 Salon supprimé',
    `Un salon a été supprimé`,
    '#FF0000',
    [
      { name: 'Nom', value: channel.name, inline: true },
      { name: 'Type', value: channelType, inline: true },
      { name: 'ID', value: channel.id, inline: true }
    ]
  );
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
  const changes = [];
  
  if (oldChannel.name !== newChannel.name) {
    changes.push({
      name: 'Nom',
      value: `${oldChannel.name} → ${newChannel.name}`,
      inline: true
    });
  }
  
  if (oldChannel.type !== newChannel.type) {
    changes.push({
      name: 'Type',
      value: `${oldChannel.type} → ${newChannel.type}`,
      inline: true
    });
  }
  
  if (oldChannel.topic !== newChannel.topic) {
    changes.push({
      name: 'Description',
      value: `**Avant:** ${oldChannel.topic || 'Aucune'}\n**Après:** ${newChannel.topic || 'Aucune'}`,
      inline: false
    });
  }
  
  if (oldChannel.parentId !== newChannel.parentId) {
    changes.push({
      name: 'Catégorie',
      value: `${oldChannel.parent?.name || 'Aucune'} → ${newChannel.parent?.name || 'Aucune'}`,
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '📌 Salon modifié',
      `Le salon ${newChannel.name} a été modifié`,
      '#FFFF00',
      [
        { name: 'ID', value: newChannel.id, inline: true },
        ...changes
      ]
    );
  }
});

client.on('roleCreate', async role => {
  await sendLog(
    '🎭 Rôle créé',
    `Un nouveau rôle a été créé`,
    '#00FF00',
    [
      { name: 'Nom', value: role.name, inline: true },
      { name: 'Couleur', value: role.hexColor, inline: true },
      { name: 'ID', value: role.id, inline: true },
      { name: 'Permissions', value: role.permissions.toArray().join(', ') || 'Aucune', inline: false }
    ]
  );
});

client.on('roleDelete', async role => {
  await sendLog(
    '🎭 Rôle supprimé',
    `Un rôle a été supprimé`,
    '#FF0000',
    [
      { name: 'Nom', value: role.name, inline: true },
      { name: 'ID', value: role.id, inline: true }
    ]
  );
});

client.on('roleUpdate', async (oldRole, newRole) => {
  const changes = [];
  
  if (oldRole.name !== newRole.name) {
    changes.push({
      name: 'Nom',
      value: `${oldRole.name} → ${newRole.name}`,
      inline: true
    });
  }
  
  if (oldRole.color !== newRole.color) {
    changes.push({
      name: 'Couleur',
      value: `${oldRole.hexColor} → ${newRole.hexColor}`,
      inline: true
    });
  }
  
  if (!oldRole.permissions.equals(newRole.permissions)) {
    const added = newRole.permissions.missing(oldRole.permissions);
    const removed = oldRole.permissions.missing(newRole.permissions);
    
    if (added.length > 0) {
      changes.push({
        name: 'Permissions ajoutées',
        value: added.join(', '),
        inline: false
      });
    }
    
    if (removed.length > 0) {
      changes.push({
        name: 'Permissions retirées',
        value: removed.join(', '),
        inline: false
      });
    }
  }
  
  if (oldRole.hoist !== newRole.hoist) {
    changes.push({
      name: 'Affichage séparé',
      value: `${oldRole.hoist ? 'Oui' : 'Non'} → ${newRole.hoist ? 'Oui' : 'Non'}`,
      inline: true
    });
  }
  
  if (oldRole.mentionable !== newRole.mentionable) {
    changes.push({
      name: 'Mentionnable',
      value: `${oldRole.mentionable ? 'Oui' : 'Non'} → ${newRole.mentionable ? 'Oui' : 'Non'}`,
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '🎭 Rôle modifié',
      `Le rôle ${newRole.name} a été modifié`,
      '#FFFF00',
      [
        { name: 'ID', value: newRole.id, inline: true },
        ...changes
      ]
    );
  }
});

client.on('messageDelete', async message => {
  if (message.author.bot) return;
  
  await sendLog(
    '🗑️ Message supprimé',
    `Un message a été supprimé`,
    '#FF0000',
    [
      { name: 'Auteur', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'Salon', value: message.channel.toString(), inline: true },
      { name: 'Contenu', value: message.content || 'Aucun contenu textuel', inline: false },
      { name: 'Pièces jointes', value: message.attachments.size > 0 ? message.attachments.map(a => a.url).join('\n') : 'Aucune', inline: false }
    ],
    message.author.displayAvatarURL()
  );
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author.bot || oldMessage.content === newMessage.content) return;
  
  await sendLog(
    '✏️ Message édité',
    `Un message a été modifié`,
    '#FFFF00',
    [
      { name: 'Auteur', value: `${oldMessage.author.tag} (${oldMessage.author.id})`, inline: true },
      { name: 'Salon', value: oldMessage.channel.toString(), inline: true },
      { name: 'Ancien contenu', value: oldMessage.content || 'Aucun contenu textuel', inline: false },
      { name: 'Nouveau contenu', value: newMessage.content || 'Aucun contenu textuel', inline: false },
      { name: 'Lien', value: `[Aller au message](${newMessage.url})`, inline: false }
    ],
    oldMessage.author.displayAvatarURL()
  );
});

client.on('messageDeleteBulk', async messages => {
  const firstMessage = messages.first();
  
  await sendLog(
    '🗑️ Messages supprimés en masse',
    `${messages.size} messages ont été supprimés dans ${firstMessage.channel}`,
    '#FF0000',
    [
      { name: 'Salon', value: firstMessage.channel.toString(), inline: true },
      { name: 'Premier auteur', value: firstMessage.author.tag, inline: true },
      { name: 'Dernier message supprimé', value: messages.last().content?.slice(0, 100) || 'Aucun contenu textuel', inline: false }
    ]
  );
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  
  await sendLog(
    '👍 Réaction ajoutée',
    `Une réaction a été ajoutée à un message`,
    '#00FF00',
    [
      { name: 'Utilisateur', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Salon', value: reaction.message.channel.toString(), inline: true },
      { name: 'Réaction', value: reaction.emoji.toString(), inline: true },
      { name: 'Lien', value: `[Aller au message](${reaction.message.url})`, inline: false }
    ],
    user.displayAvatarURL()
  );
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  
  await sendLog(
    '👎 Réaction retirée',
    `Une réaction a été retirée d'un message`,
    '#FF0000',
    [
      { name: 'Utilisateur', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Salon', value: reaction.message.channel.toString(), inline: true },
      { name: 'Réaction', value: reaction.emoji.toString(), inline: true },
      { name: 'Lien', value: `[Aller au message](${reaction.message.url})`, inline: false }
    ],
    user.displayAvatarURL()
  );
});

client.on('inviteCreate', async invite => {
  await sendLog(
    '📨 Invitation créée',
    `Une nouvelle invitation a été créée`,
    '#00FF00',
    [
      { name: 'Créée par', value: invite.inviter?.tag || 'Unknown', inline: true },
      { name: 'Code', value: invite.code, inline: true },
      { name: 'Salon', value: invite.channel.toString(), inline: true },
      { name: 'Utilisations max', value: invite.maxUses.toString(), inline: true },
      { name: 'Expiration', value: invite.expiresAt?.toLocaleString() || 'Jamais', inline: true }
    ],
    invite.inviter?.displayAvatarURL()
  );
});

client.on('inviteDelete', async invite => {
  await sendLog(
    '📨 Invitation supprimée',
    `Une invitation a été supprimée`,
    '#FF0000',
    [
      { name: 'Code', value: invite.code, inline: true },
      { name: 'Salon', value: invite.channel.toString(), inline: true }
    ]
  );
});

client.on('guildBanAdd', async ban => {
  await sendLog(
    '🔨 Membre banni',
    `${ban.user.tag} a été banni du serveur`,
    '#FF0000',
    [
      { name: 'ID', value: ban.user.id, inline: true },
      { name: 'Raison', value: ban.reason || 'Aucune raison spécifiée', inline: false }
    ],
    ban.user.displayAvatarURL()
  );
});

client.on('guildBanRemove', async ban => {
  await sendLog(
    '🔓 Membre débanni',
    `${ban.user.tag} a été débanni du serveur`,
    '#00FF00',
    [
      { name: 'ID', value: ban.user.id, inline: true }
    ],
    ban.user.displayAvatarURL()
  );
});

client.on('guildUpdate', async (oldGuild, newGuild) => {
  const changes = [];
  
  if (oldGuild.name !== newGuild.name) {
    changes.push({
      name: 'Nom',
      value: `${oldGuild.name} → ${newGuild.name}`,
      inline: true
    });
  }
  
  if (oldGuild.icon !== newGuild.icon) {
    changes.push({
      name: 'Icône',
      value: 'Modifiée',
      inline: true
    });
  }
  
  if (oldGuild.banner !== newGuild.banner) {
    changes.push({
      name: 'Bannière',
      value: 'Modifiée',
      inline: true
    });
  }
  
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
    changes.push({
      name: 'Salon AFK',
      value: `${oldGuild.afkChannel?.name || 'Aucun'} → ${newGuild.afkChannel?.name || 'Aucun'}`,
      inline: true
    });
  }
  
  if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
    changes.push({
      name: 'Timeout AFK',
      value: `${oldGuild.afkTimeout} → ${newGuild.afkTimeout}`,
      inline: true
    });
  }
  
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
    changes.push({
      name: 'Niveau de vérification',
      value: `${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`,
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '⚙️ Serveur modifié',
      `Des paramètres du serveur ont été changés`,
      '#FFFF00',
      changes
    );
  }
});

client.on('webhookUpdate', async channel => {
  await sendLog(
    '🪝 Webhooks mis à jour',
    `Les webhooks du salon ${channel.name} ont été mis à jour`,
    '#FFFF00',
    [
      { name: 'Salon', value: channel.toString(), inline: true },
      { name: 'ID', value: channel.id, inline: true }
    ]
  );
});

client.on('guildScheduledEventCreate', async event => {
  await sendLog(
    '📅 Événement créé',
    `Un nouvel événement a été programmé`,
    '#00FF00',
    [
      { name: 'Nom', value: event.name, inline: true },
      { name: 'Créé par', value: event.creator?.tag || 'Unknown', inline: true },
      { name: 'Début', value: event.scheduledStartAt.toLocaleString(), inline: true },
      { name: 'Description', value: event.description || 'Aucune description', inline: false }
    ],
    event.creator?.displayAvatarURL()
  );
});

client.on('guildScheduledEventDelete', async event => {
  await sendLog(
    '📅 Événement supprimé',
    `Un événement programmé a été supprimé`,
    '#FF0000',
    [
      { name: 'Nom', value: event.name, inline: true },
      { name: 'Début prévu', value: event.scheduledStartAt.toLocaleString(), inline: true }
    ]
  );
});

client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
  const changes = [];
  
  if (oldEvent.name !== newEvent.name) {
    changes.push({
      name: 'Nom',
      value: `${oldEvent.name} → ${newEvent.name}`,
      inline: true
    });
  }
  
  if (oldEvent.description !== newEvent.description) {
    changes.push({
      name: 'Description',
      value: 'Modifiée',
      inline: true
    });
  }
  
  if (oldEvent.scheduledStartAt !== newEvent.scheduledStartAt) {
    changes.push({
      name: 'Début',
      value: `${oldEvent.scheduledStartAt.toLocaleString()} → ${newEvent.scheduledStartAt.toLocaleString()}`,
      inline: true
    });
  }
  
  if (oldEvent.status !== newEvent.status) {
    changes.push({
      name: 'Statut',
      value: `${oldEvent.status} → ${newEvent.status}`,
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '📅 Événement modifié',
      `Un événement programmé a été modifié`,
      '#FFFF00',
      [
        { name: 'Nom', value: newEvent.name, inline: true },
        ...changes
      ]
    );
  }
});

client.on('guildScheduledEventUserAdd', async (event, user) => {
  await sendLog(
    '📅 Participation in an event',
    `${user.tag} joined an event`,
    '#00FF00',
    [
      { name: 'Event', value: event.name, inline: true },
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Beginning', value: event.scheduledStartAt.toLocaleString(), inline: true }
    ],
    user.displayAvatarURL()
  );
});

client.on('guildScheduledEventUserRemove', async (event, user) => {
  await sendLog(
    '📅 Cancellation of an event',
    `${user.tag} left an event`,
    '#FF0000',
    [
      { name: 'Event', value: event.name, inline: true },
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true }
    ],
    user.displayAvatarURL()
  );
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const changes = [];
  
  if (oldState.channelId !== newState.channelId) {
    if (!oldState.channelId) {
      changes.push({
        name: '🔊 Join a voice chat',
        value: newState.channel.toString(),
        inline: true
      });
    } else if (!newState.channelId) {
      changes.push({
        name: '🔇 Left a voice chat',
        value: oldState.channel.toString(),
        inline: true
      });
    } else {
      changes.push({
        name: '🔄 Changed voice chat',
        value: `${oldState.channel} → ${newState.channel}`,
        inline: true
      });
    }
  }
  
  if (oldState.mute !== newState.mute) {
    changes.push({
      name: '🎤 Microphone',
      value: newState.mute ? 'Disabled' : 'Enabled',
      inline: true
    });
  }

  if (oldState.deaf !== newState.deaf) {
    changes.push({
      name: '🎧 Helmet',
      value: newState.deaf ? 'Disabled' : 'Enabled',
      inline: true
    });
  }

  if (oldState.streaming !== newState.streaming) {
    changes.push({
      name: '📺 Stream',
      value: newState.streaming ? 'Started' : 'Arrested',
      inline: true
    });
  }
  
  if (oldState.selfVideo !== newState.selfVideo) {
    changes.push({
      name: '📷 Camera',
      value: newState.selfVideo ? 'On' : 'Off',
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '🎤 Voice status updated',
      `${newState.member.user.tag} changed his vocal state`,
      '#FFFF00',
      [
        { name: 'Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
        ...changes
      ],
      newState.member.user.displayAvatarURL()
    );
  }
});

client.on('threadCreate', async thread => {
  await sendLog(
    '🧵 Thread created',
    `A new thread has been created`,
    '#00FF00',
    [
      { name: 'Name', value: thread.name, inline: true },
      { name: 'Parent channel', value: thread.parent.toString(), inline: true },
      { name: 'Created by', value: thread.ownerId ? `<@${thread.ownerId}>` : 'Unknown', inline: true }
    ]
  );
});

client.on('threadDelete', async thread => {
  await sendLog(
    '🧵 Thread deleted',
    `A thread has been deleted`,
    '#FF0000',
    [
      { name: 'Name', value: thread.name, inline: true },
      { name: 'Parent channel', value: thread.parent.toString(), inline: true }
    ]
  );
});

client.on('threadUpdate', async (oldThread, newThread) => {
  const changes = [];
  
  if (oldThread.name !== newThread.name) {
    changes.push({
      name: 'Name',
      value: `${oldThread.name} → ${newThread.name}`,
      inline: true
    });
  }
  
  if (oldThread.archived !== newThread.archived) {
    changes.push({
      name: 'Status',
      value: newThread.archived ? 'Archive' : 'Unarchived',
      inline: true
    });
  }
  
  if (oldThread.locked !== newThread.locked) {
    changes.push({
      name: 'Lockdown',
      value: newThread.locked ? 'Locked' : 'Unlocked',
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '🧵 Thread modified',
      `A thread has been modified`,
      '#FFFF00',
      [
        { name: 'Name', value: newThread.name, inline: true },
        { name: 'Parent channel', value: newThread.parent.toString(), inline: true },
        ...changes
      ]
    );
  }
});

client.on('threadMemberUpdate', async (oldMember, newMember) => {
  const changes = [];
  
  if (oldMember.flags !== newMember.flags) {
    changes.push({
      name: 'Notifications',
      value: newMember.flags.has('SUPPRESS_NOTIFICATIONS') ? 'Disabled' : 'Enabled',
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '🧵 Thread member updated',
      `${newMember.user?.tag || 'User Unknown'} was modified in a thread`,
      '#FFFF00',
      [
        { name: 'Members', value: newMember.user?.tag || 'User Unknown', inline: true },
        { name: 'Thread', value: newMember.thread.name, inline: true },
        ...changes
      ],
      newMember.user?.displayAvatarURL()
    );
  }
});

client.on('threadMembersUpdate', async (addedMembers, removedMembers, thread) => {
  const changes = [];
  
  if (addedMembers.size > 0) {
    changes.push({
      name: 'Members added',
      value: addedMembers.map(m => `<@${m.id}>`).join(', '),
      inline: false
    });
  }
  
  if (removedMembers.size > 0) {
    changes.push({
      name: 'Members removed',
      value: removedMembers.map(m => `<@${m.id}>`).join(', '),
      inline: false
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '🧵 Thread members updated',
      `Members have joined/left the thread ${thread.name}`,
      '#FFFF00',
      [
        { name: 'Thread', value: thread.toString(), inline: true },
        ...changes
      ]
    );
  }
});

client.on('guildIntegrationsUpdate', async guild => {
  await sendLog(
    '🔌 Updated integrations',
    `Server integrations have been updated`,
    '#FFFF00',
    [
      { name: 'Server', value: guild.name, inline: true },
      { name: 'ID', value: guild.id, inline: true }
    ]
  );
});

client.on('stickerCreate', async sticker => {
  await sendLog(
    '🖼️ Sticker created',
    `A new sticker has been added`,
    '#00FF00',
    [
      { name: 'Name', value: sticker.name, inline: true },
      { name: 'Description', value: sticker.description || 'None', inline: true },
      { name: 'ID', value: sticker.id, inline: true }
    ]
  );
});

client.on('stickerDelete', async sticker => {
  await sendLog(
    '🖼️ Sticker removed',
    `A sticker has been removed`,
    '#FF0000',
    [
      { name: 'Name', value: sticker.name, inline: true },
      { name: 'ID', value: sticker.id, inline: true }
    ]
  );
});

client.on('stickerUpdate', async (oldSticker, newSticker) => {
  const changes = [];
  
  if (oldSticker.name !== newSticker.name) {
    changes.push({
      name: 'Nom',
      value: `${oldSticker.name} → ${newSticker.name}`,
      inline: true
    });
  }
  
  if (oldSticker.description !== newSticker.description) {
    changes.push({
      name: 'Description',
      value: `${oldSticker.description || 'Aucune'} → ${newSticker.description || 'Aucune'}`,
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '🖼️ Sticker modifié',
      `Un sticker a été modifié`,
      '#FFFF00',
      [
        { name: 'ID', value: newSticker.id, inline: true },
        ...changes
      ]
    );
  }
});

client.on('guildEmojiCreate', async emoji => {
  await sendLog(
    '😀 Emoji created',
    `A new emoji has been added`,
    '#00FF00',
    [
      { name: 'Name', value: emoji.name, inline: true },
      { name: 'ID', value: emoji.id, inline: true },
      { name: 'Animed', value: emoji.animated ? 'Yes' : 'No', inline: true }
    ]
  );
});

client.on('guildEmojiDelete', async emoji => {
  await sendLog(
    '😀 Deleted emoji',
    `An emoji has been deleted`,
    '#FF0000',
    [
      { name: 'Name', value: emoji.name, inline: true },
      { name: 'ID', value: emoji.id, inline: true }
    ]
  );
});

client.on('guildEmojiUpdate', async (oldEmoji, newEmoji) => {
  const changes = [];
  
  if (oldEmoji.name !== newEmoji.name) {
    changes.push({
      name: 'Name',
      value: `${oldEmoji.name} → ${newEmoji.name}`,
      inline: true
    });
  }
  
  if (changes.length > 0) {
    await sendLog(
      '😀 Emoji modified',
      `An emoji has been modified`,
      '#FFFF00',
      [
        { name: 'ID', value: newEmoji.id, inline: true },
        ...changes
      ]
    );
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  await sendLog(
    '💻 Slash command used',
    `A slash command was executed`,
    '#00FF00',
    [
      { name: 'Order', value: interaction.commandName, inline: true },
      { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'Channel', value: interaction.channel.toString(), inline: true },
      { name: 'Options', value: interaction.options.data.map(opt => `${opt.name}: ${opt.value}`).join('\n') || 'None', inline: false }
    ],
    interaction.user.displayAvatarURL()
  );
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('warn', info => {
  console.warn('Discord Client Warning:', info);
});

client.login(config.token).catch(error => {
  console.error('Connection error:', error);
  process.exit(1);
});

client.login(config.token).catch(error => {
  console.error('Connection error:', error);
  process.exit(1);
});