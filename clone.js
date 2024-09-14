const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const axios = require("axios")
const bot = new Telegraf(process.env.BOT_TOKEN);

const ownerId = parseInt(process.env.OWNER_ID, 10);

// Data storage
const userIDs = loadData('users.json') || [];
const admins = loadData('admins.json') || [];
const requiredChannels = loadData('required_channels.json') || [];
const requiredGroups = loadData('required_groups.json') || [];
const messageStats = loadData('message_stats.json') || {};
let movies = loadData('movies.json') || [];
let lastMovieId = loadData('last_movie_id.json') || 0;
const userSavedMovies = loadData('userSavedMovies.json');

// Function to handle viewing channels
async function handleViewChannels(ctx) {
  const channelList = requiredChannels.length ? requiredChannels.join('\n') : 'No channels required';
  await ctx.answerCbQuery(); // Answer the callback query to acknowledge the action
  await ctx.reply(`Current Channels:\n${channelList}`);
}

// Function to handle viewing groups
async function handleViewGroups(ctx) {
  const groupList = requiredGroups.length ? requiredGroups.join('\n') : 'No groups required';
  await ctx.answerCbQuery(); // Answer the callback query to acknowledge the action
  await ctx.reply(`Current Groups:\n${groupList}`);
}

// Function to check if a user is a member of required channels and groups
const checkMembership = async (ctx) => {
  for (const channel of requiredChannels) {
    try {
      const member = await bot.telegram.getChatMember(channel, ctx.from.id);
      if (member.status !== 'member' && member.status !== 'administrator' && member.status !== 'creator') {
        return false;
      }
    } catch (error) {
      console.error('Error checking channel membership:', error);
      return false;
    }
  }
  for (const group of requiredGroups) {
    try {
      const member = await bot.telegram.getChatMember(group, ctx.from.id);
      if (member.status !== 'member' && member.status !== 'administrator' && member.status !== 'creator') {
        return false;
      }
    } catch (error) {
      console.error('Error checking group membership:', error);
      return false;
    }
  }
  return true;
};


// Initialize currentOperation
const currentOperation = {};

// Load data from JSON file
function loadData(filename) {
  const filepath = path.join(__dirname, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return [];
}

// Save data to JSON file
function saveData(filename, data) {
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(data, null, 2));
}

// Helper function to check if user is an admin or owner
const isAdminOrOwner = (userID) => {
  console.log('Checking if user is admin or owner...');
  console.log('User ID:', userID);
  console.log('Admins:', admins);
  console.log('Owner ID:', ownerId);

  // Convert userID to string for comparison
  const stringUserID = String(userID);

  return admins.includes(stringUserID) || stringUserID === String(ownerId);
};

// Function to format URLs for channels and groups
const formatLink = (username) => `https://t.me/${username.replace('@', '')}`;

// Function to format timestamp for readability
const formatDate = (date) => new Date(date).toLocaleString();

// Start command
bot.start(async (ctx) => {
  const userID = ctx.from.id;
  if (!userIDs.includes(userID)) {
    userIDs.push(userID);
    saveData('users.json', userIDs);
  }

  if (await checkMembership(ctx)) {
    ctx.reply('Click the button to open the Web App', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Asosiy Web Sahifani ochish',
              web_app: { url: 'https://kinouz.net/' } // Replace with your Web App URL
            }
          ],
          [
            {
              text: 'Saqlangan kinolar',
              switch_inline_query_current_chat: 'saved'
            }
          ],
          [
            {
              text: "Guruhga qo'shish",
              url: `https://t.me/${process.env.BOT_USERNAME}?startgroup=true`
            }
          ]

        ]
      }
    });
  } else {
    // const channelLinks = requiredChannels.map(formatLink).join('\n');
    // const groupLinks = requiredGroups.map(formatLink).join('\n');
    
    // ctx.reply(`Please join the required channels and groups to access this bot. Use the following links to join:\n\n${channelLinks}\n\n${groupLinks}`);

    const channelLinks = requiredChannels.map(formatLink);
    const groupLinks = requiredGroups.map(formatLink);

    // Combine channel and group links into buttons
    const channelButtons = channelLinks.map(link => ({
      text: 'Join Channel',
      url: link
    }));

    const groupButtons = groupLinks.map(link => ({
      text: 'Join Group',
      url: link
    }));

    // Combine all buttons into a single keyboard
    const inlineKeyboard = [
      ...channelButtons,
      ...groupButtons
    ];

    ctx.reply(
      "❌ Kechirasiz, botimizdan foydalanishdan oldin ushbu kanallarga a'zo bo'lishingiz kerak:",
      {
        reply_markup: {
          inline_keyboard: [inlineKeyboard]
        }
      }
    );



  }
});

// Admin panel command
bot.command('adminpanel', async (ctx) => {
  const userID = ctx.from.id;
  if (isAdminOrOwner(userID)) {
    const adminPanelButtons = [
      [{ text: "📊 Statistika", callback_data: 'view_total_users' }, { text: "👀 Adminlarni ko'rish", callback_data: 'view_admins' }],
      [{ text: "➕ Kanal qo'shish", callback_data: 'add_channel' }, { text: "➖ Kanalni o'chirish", callback_data: 'remove_channel' }],
      [{ text: "➕ Guruh qo'shish", callback_data: 'add_group' }, { text: "➖ Guruhni o'chirish", callback_data: 'remove_group' }],
      [{ text: "✈️ Xabar jo'natish", callback_data: 'send_message' }], [{ text: "👀 Kanallarni ko'rish", callback_data: 'view_channels' }, { text: "👀 Guruhlarni ko'rish", callback_data: 'view_groups' }],
      [{ text: "🎞 Film qo'shish", callback_data: 'add_movie' }, { text: "🎞 Film o'chirish", callback_data: 'remove_movie' }]
    ];

    if (userID === ownerId) {
      adminPanelButtons.unshift(
        [{ text: "➕ Admin qo'shish", callback_data: 'add_admin' }, { text: "➖ Admin o'chirish", callback_data: 'remove_admin' }]
      );
    }

    await ctx.reply('Admin Panel:', {
      reply_markup: {
        inline_keyboard: adminPanelButtons
      }
    });
  } else {
    await ctx.reply("Sizda ruxsat mavjud emas, bu yerga kirish uchun 🚫");
  }
});


bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userID = ctx.from.id;

  try {
    // Split data for actions related to movies
    const [action, movieIdStr] = data.split('_');
    const movieId = parseInt(movieIdStr, 10);

    if (action === 'toggle') {
      // Toggle saving movies
      if (!userSavedMovies[userID]) {
        userSavedMovies[userID] = [];
      }

      if (userSavedMovies[userID].includes(movieId)) {
        userSavedMovies[userID] = userSavedMovies[userID].filter(id => id !== movieId);
        await ctx.answerCbQuery("Film muvaffaqiyatli o'chirildi ☑️");
      } else {
        userSavedMovies[userID].push(movieId);
        await ctx.answerCbQuery("Film muvaffaqiyatli saqlandi ✅");
      }

      saveData('userSavedMovies.json', userSavedMovies);
      console.log(`Updated userSavedMovies for ${userID}: ${JSON.stringify(userSavedMovies[userID])}`);

    } else if (data === 'view_total_users') {
      const totalUsers = userIDs.length;
      const activeUsers = messageStats.activeUsers || 0;
      const inactiveUsers = messageStats.inactiveUsers || 0;
      const lastUpdated = formatDate(messageStats.lastUpdated || new Date());

      await ctx.reply(`Total Users: ${totalUsers}\nActive Users: ${activeUsers}\nInactive Users: ${inactiveUsers}\nLast Updated: ${lastUpdated}`);

    } else if (data === 'view_admins') {
      const adminList = admins.length ? admins.join('\n') : 'Adminlar mavjud emas !';
      await ctx.reply(`Admin IDs:\n${adminList}`);

    } else if (data === 'add_admin' && userID === ownerId) {
      currentOperation[userID] = { type: 'add_admin', messageId: null };
      const sentMessage = await ctx.reply("Iltimos, administrator sifatida qo'shish uchun foydalanuvchi IDisini yuboring:", {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
        }
      });
      currentOperation[userID].messageId = sentMessage.message_id;

    } else if (data === 'remove_admin' && userID === ownerId) {
      currentOperation[userID] = { type: 'remove_admin', messageId: null };
      const sentMessage = await ctx.reply('Administratordan olib tashlash uchun foydalanuvchi IDisini yuboring:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
        }
      });
      currentOperation[userID].messageId = sentMessage.message_id;

    } else if (['add_channel', 'remove_channel', 'add_group', 'remove_group'].includes(data)) {
      if (isAdminOrOwner(userID)) {
        currentOperation[userID] = { type: data, messageId: null };
        let prompt = '';

        if (data === 'add_channel') {
          prompt = "Iltimos, qo'shish uchun kanal foydalanuvchi nomini (masalan, @channelusername) yuboring:";
        } else if (data === 'remove_channel') {
          prompt = "Oʻchirish uchun kanal foydalanuvchi nomini (masalan, @channelusername) yuboring:";
        } else if (data === 'add_group') {
          prompt = "Quyidagilarni qoʻshish uchun guruh foydalanuvchi nomini (masalan, @groupusername) yuboring:";
        } else if (data === 'remove_group') {
          prompt = "Oʻchirish uchun guruh foydalanuvchi nomini (masalan, @groupusername) yuboring:";
        }

        const sentMessage = await ctx.reply(prompt, {
          reply_markup: {
            inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
          }
        });
        currentOperation[userID].messageId = sentMessage.message_id;
      }

    } else if (data === 'send_message' && isAdminOrOwner(userID)) {
      currentOperation[userID] = { type: 'send_message', messageId: null };
      const sentMessage = await ctx.reply('Iltimos, barcha foydalanuvchilarga yuborish uchun xabarni yuboring:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
        }
      });
      currentOperation[userID].messageId = sentMessage.message_id;

    } else if (data === 'cancel') {
      if (currentOperation[userID] && currentOperation[userID].messageId) {
        try {
          await ctx.deleteMessage(currentOperation[userID].messageId);
        } catch (err) {
          console.error('Failed to delete message:', err);
        }
        delete currentOperation[userID];
        await ctx.reply('Amalyot bekor qilindi');
      }

    } else if (data === 'view_channels') {
      await handleViewChannels(ctx);

    } else if (data === 'view_groups') {
      await handleViewGroups(ctx);

    } else if (data === 'add_movie' && isAdminOrOwner(userID)) {
      const message = await ctx.reply('Iltimos, Filimning nomini kiriting:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel_operation' }]]
        }
      });
      currentOperation[userID] = { type: 'add_movie', movie: {}, lastMessageId: message.message_id };

    } else if (data === 'remove_movie' && isAdminOrOwner(userID)) {
      const message = await ctx.reply('Iltimos, olib tashlash uchun film IDisini kiriting:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel_operation' }]]
        }
      });
      currentOperation[userID] = { type: 'remove_movie', lastMessageId: message.message_id };

    } else if (data === 'cancel_operation') {
      if (currentOperation[userID]) {
        const lastMessageId = currentOperation[userID].lastMessageId;
        await ctx.deleteMessage(lastMessageId); // Delete the last message
        delete currentOperation[userID];
        await ctx.reply('Amalyot bekor qilindi !');
      }
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    await ctx.answerCbQuery('Something went wrong, please try again.');
  }
});




// Handle photo messages
bot.on('photo', async (ctx) => {
  const userID = ctx.from.id;

  if (currentOperation[userID] && currentOperation[userID].type === 'add_movie') {
    const operation = currentOperation[userID];
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const filePath = await bot.telegram.getFile(fileId);

    lastMovieId += 1;
    const movieId = lastMovieId;
    const photoPath = path.join(__dirname, 'photos', `${operation.movie.name}_${movieId}.jpg`);

    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath.file_path}`;
    const response = await axios.get(url, { responseType: 'stream' });

    response.data.pipe(fs.createWriteStream(photoPath));

    operation.movie.photo = photoPath;
    operation.movie.id = movieId;

    movies.push(operation.movie);
    saveData('movies.json', movies);
    saveData('last_movie_id.json', lastMovieId);

    await ctx.reply(`Movie '${operation.movie.name}' has been added with ID ${movieId}.`);

    delete currentOperation[userID];
  }
});
// Handle text to get a movie by number (including groups)
bot.on('text', async (ctx, next) => {
  const userID = ctx.from.id;
  if (await checkMembership(ctx)) {
    if(isAdminOrOwner(userID)){
      next();
    } else {
      if (ctx.chat.type === 'private') {
        const movieId = parseInt(ctx.message.text.trim(), 10);
        const movie = movies.find(m => m.id === movieId);
        
        if (movie) {
          try {
            await ctx.replyWithPhoto(
              { source: movie.photo },
              {
                caption: `Name: ${movie.name}\nDescription: ${movie.description}`,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Kinoni ko'rish",
                        web_app: { url: movie.link }
                      },
                      {
                        text: 'Saqlash',
                        callback_data: `toggle_${movieId}`
                      }
                    ],
                    [
                      {
                        text: 'Saqlangan kinolar',
                        switch_inline_query_current_chat: 'saved'
                      }
                    ],
                    [
                      {
                        text: "Guruhga qo'shish",
                        url: `https://t.me/${process.env.BOT_USERNAME}?startgroup=true`
                      }
                    ]
                  ]
                }
              }
            );
          } catch (error) {
            console.error('Error sending photo or message:', error);
            await ctx.reply('An error occurred while processing your request. Please try again later.');
          }
        } else {
          if(isAdminOrOwner(userID)){
            next();
          } else{
            ctx.reply("Film topilmadi yoku bu film o'chirib yuborilgan!")
          }
        }
      }
    }
  } else {
    if(isAdminOrOwner(userID)){
      next();
    } else{
      const channelLinks = requiredChannels.map(formatLink);
      const groupLinks = requiredGroups.map(formatLink);
      
      // Combine channel and group links into buttons
      const channelButtons = channelLinks.map(link => ({
        text: 'Join Channel',
        url: link
      }));
      
      const groupButtons = groupLinks.map(link => ({
        text: 'Join Group',
        url: link
      }));
      
      // Combine all buttons into a single keyboard
      const inlineKeyboard = [
        ...channelButtons,
        ...groupButtons
      ];
      
      ctx.reply(
        "❌ Kechirasiz, botimizdan foydalanishdan oldin ushbu kanallarga a'zo bo'lishingiz kerak:",
        {
          reply_markup: {
            inline_keyboard: [inlineKeyboard]
          }
        }
      );
    }
      


  }
});



// Handle inline queries
bot.on('inline_query', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const savedMovies = userSavedMovies[userId] || [];

    if (savedMovies.length === 0) {
      await ctx.answerInlineQuery([], { switch_pm_text: 'You have not saved any movies.', switch_pm_parameter: 'start' });
      return;
    }

    const inlineMovies = savedMovies.map((movieId) => {
      const movie = movies.find(m => m.id === movieId);
      if (movie) {
        return {
          type: 'article',
          id: movieId.toString(),
          title: movie.name,
          description: movie.description,
          input_message_content: {
            message_text: `Name: ${movie.name}\nDescription: ${movie.description}`
          },
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Open Web App',
                  web_app: { url: movie.link }
                }
              ]
            ]
          }
        };
      }
    }).filter(Boolean);

    await ctx.answerInlineQuery(inlineMovies, {
      cache_time: 0 // Prevent caching to ensure fresh results each time
    });
  } catch (error) {
    console.error('Error during inline query:', error);
  }
});



// Handle incoming messages
bot.on('message', async (ctx) => {
  const userID = ctx.from.id;

  if (currentOperation[userID]) {
    const operation = currentOperation[userID];
    
    try {
      if (operation.type === 'add_admin') {
        if (!admins.includes(ctx.message.text)) {
          admins.push(ctx.message.text);
          saveData('admins.json', admins);
          await ctx.reply("Admin muvaffaqiyatli qo'shildi.");
        } else {
          await ctx.reply('Foydalanuvchi allaqachon administrator.');
        }
      } else if (operation.type === 'remove_admin') {
        const index = admins.indexOf(ctx.message.text);
        if (index > -1) {
          admins.splice(index, 1);
          saveData('admins.json', admins);
          await ctx.reply('Administrator muvaffaqiyatli olib tashlandi.');
        } else {
          await ctx.reply('Foydalanuvchi administrator emas.');
        }
      } else if (operation.type === 'add_channel') {
        if (!requiredChannels.includes(ctx.message.text)) {
          requiredChannels.push(ctx.message.text);
          saveData('required_channels.json', requiredChannels);
          await ctx.reply("Kanal muvaffaqiyatli qo'shildi.");
        } else {
          await ctx.reply("Kanal allaqachon ro'yxatda.");
        }
      } else if (operation.type === 'remove_channel') {
        const index = requiredChannels.indexOf(ctx.message.text);
        if (index > -1) {
          requiredChannels.splice(index, 1);
          saveData('required_channels.json', requiredChannels);
          await ctx.reply('Kanal muvaffaqiyatli olib tashlandi.');
        } else {
          await ctx.reply("Kanal ro'yxatda yo'q.");
        }
      } else if (operation.type === 'add_group') {
        if (!requiredGroups.includes(ctx.message.text)) {
          requiredGroups.push(ctx.message.text);
          saveData('required_groups.json', requiredGroups);
          await ctx.reply("Guruh muvaffaqiyatli qo'shildi.");
        } else {
          await ctx.reply("Guruh allaqachon ro'yxatda.");
        }
      } else if (operation.type === 'add_movie'){
        if (!operation.movie.name) {
          operation.movie.name = ctx.message.text;
          const message = await ctx.reply('Iltimos, film tavsifini bering:', {
            reply_markup: {
              inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel_operation' }]]
            }
          });
          currentOperation[userID].lastMessageId = message.message_id; // Update the last message ID
        } else if (!operation.movie.description) {
          operation.movie.description = ctx.message.text;
          const message = await ctx.reply('Iltimos, film havolasini taqdim eting:', {
            reply_markup: {
              inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel_operation' }]]
            }
          });
          currentOperation[userID].lastMessageId = message.message_id; // Update the last message ID
        } else if (!operation.movie.link) {
          operation.movie.link = ctx.message.text;
          const message = await ctx.reply('Iltimos, film suratini taqdim eting:', {
            reply_markup: {
              inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel_operation' }]]
            }
          });
          currentOperation[userID].lastMessageId = message.message_id; // Update the last message ID
        }
      } else if (operation.type === 'remove_movie'){
        const movieId = parseInt(ctx.message.text);
        const movieIndex = movies.findIndex(m => m.id === movieId);

        if (movieIndex !== -1) {
          const movie = movies.splice(movieIndex, 1)[0];
          saveData('movies.json', movies);
          fs.unlinkSync(movie.photo); // Remove photo from storage
          await ctx.reply(`Film '${movie.name}' o'chirib tashlandi !`);
        } else {
          await ctx.reply(`Bu id bilan ${movieId} film topilmadi !`);
      }

      delete currentOperation[userID];
      }
      else if (operation.type === 'remove_group') {
        const index = requiredGroups.indexOf(ctx.message.text);
        if (index > -1) {
          requiredGroups.splice(index, 1);
          saveData('required_groups.json', requiredGroups);
          await ctx.reply('Guruh muvaffaqiyatli olib tashlandi.');
        } else {
          await ctx.reply("Guruh ro'yxatda yo'q.");
        }
      } else if (operation.type === 'send_message') {
        let totalSent = 0;
        let successfulDeliveries = 0;
        let failedDeliveries = 0;
    
        // Reset the message statistics before sending a new message
        messageStats.totalSent = 0;
        messageStats.successfulDeliveries = 0;
        messageStats.failedDeliveries = 0;
    
        // Send initial message indicating the start of the process
        const progressMessage = await ctx.reply(`Started sending messages...\nFailed: 0 | Success: 0 | Total: 0`);
    
        // Function to send messages in parallel with real-time updates
        const sendMessagesConcurrently = async (userIDs, concurrentLimit, ctx) => {
            const chunkedUserIDs = [];
    
            // Break userIDs into smaller chunks for concurrent processing
            for (let i = 0; i < userIDs.length; i += concurrentLimit) {
                chunkedUserIDs.push(userIDs.slice(i, i + concurrentLimit));
            }
    
            // Send messages in chunks and update the progress
            for (const batch of chunkedUserIDs) {
                await Promise.all(batch.map(async (id) => {
                    try {
                        await bot.telegram.forwardMessage(id, ctx.message.chat.id, ctx.message.message_id);
                        totalSent++;
                        successfulDeliveries++;
                    } catch (e) {
                        if (e.response && e.response.error_code === 429) {
                            // Handle rate limit exceeded (429 error)
                            const retryAfter = e.response.parameters.retry_after || 1;
                            console.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds...`);
                            await new Promise(res => setTimeout(res, retryAfter * 1000)); // Wait for retry_after seconds
                        } else {
                            totalSent++;
                            failedDeliveries++;
                            console.error(`Failed to send message to user ${id}:`, e.message);
                        }
                    }
                }));
    
                // Edit the message to update the progress
                await bot.telegram.editMessageText(
                    ctx.chat.id, 
                    progressMessage.message_id, 
                    null, 
                    `Failed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}`
                );
    
                // Delay after each batch to respect Telegram's rate limits
                await new Promise(res => setTimeout(res, 1000)); // 1-second delay between batches
            }
        };
    
        const updateMessageStats = () => {
            messageStats.totalSent = totalSent;
            messageStats.successfulDeliveries = successfulDeliveries;
            messageStats.failedDeliveries = failedDeliveries;
            messageStats.lastUpdated = new Date();
            saveData('message_stats.json', messageStats);
        };
    
        // Main logic for sending messages concurrently with real-time updates
        const concurrentLimit = 30; // Adjust the number of concurrent requests
    
        try {
            await sendMessagesConcurrently(userIDs, concurrentLimit, ctx);
            updateMessageStats();
    
            // Final update once all messages are sent
            await bot.telegram.editMessageText(
                ctx.chat.id,
                progressMessage.message_id,
                null,
                `Done! Xabar jo'natildi.\nFailed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}\nLast updated: ${formatDate(messageStats.lastUpdated)}`
            );
        } catch (error) {
            console.error('Error during message sending operation:', error);
            await ctx.reply('Xabarni jo\'natishda xatolik yuz berdi.');
        } finally {
            delete currentOperation[ctx.from.id]; // Clean up the operation
        }
    }
    } catch (error) {
      console.error('Error handling message:', error);
      await ctx.reply('An error occurred while processing your request.');
    }
  } else if (ctx.message.forward_from) {
    const message = ctx.message;
    for (const id of userIDs) {
      try {
        await bot.telegram.forwardMessage(id, message.chat.id, message.message_id);
      } catch (error) {
        console.error(`Failed to forward message to user ${id}:`, error);
      }
    }
  }
});

bot.launch();
