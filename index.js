const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  initializeDatabase,
  getUserBalance,
  updateUserBalance,
  getUserStats,
  getAllItems,
  addActivity,
  getAllActivity,
  addToInventory,
  getUserInventory,
  removeFromInventory,
  updateUserStats,
  loadData,
  saveData
} = require('./database');
const app = express();

app.use(express.static('public'));
app.use(express.json());

// Ensure root path serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database on startup
initializeDatabase();

// Telegram Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8479679589:AAGrtH_H8gFj7GTOPaOs9W7zhjn2GmO1rrI';

// Handle Telegram webhook
app.post('/webhook', (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  const update = req.body;

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;

    if (text === '/start') {
      const welcomeMessage = `🎁 <b>Добро пожаловать в MetaGift!</b>

<b>Mini App для покупки и дарения уникальных подарков прямо в Telegram!</b>

🌟 <b>Возможности приложения:</b>
• 🛍️ Покупка эксклюзивных цифровых подарков
• 🎁 Передача подарков друзьям с личными сообщениями
• ⭐ Пополнение баланса Telegram Stars
• 👥 Реферальная программа с бонусами
• 📦 Личный инвентарь с коллекцией подарков
• 📊 Статистика покупок и активности

💎 <b>О Mini App:</b>
Полнофункциональное веб-приложение, интегрированное в Telegram. Никаких установок - все работает прямо в мессенджере!

Нажмите кнопку ниже, чтобы открыть магазин! 👇`;

      const keyboard = {
        inline_keyboard: [[
          {
            text: "🛍️ Открыть магазин",
            web_app: {
              url: "https://metagiftnew1.onrender.com/"
            }
          }
        ]]
      };

      sendTelegramMessageWithKeyboard(chatId, welcomeMessage, keyboard);
    }
  }

  res.status(200).send('OK');
});

// Currency rates and payment configuration
const CURRENCY_RATES = {
  TON_TO_STARS: 100,
  TON_TO_RUBLE: 300,
  STARS_TO_RUBLE: 3
};

const PAYMENT_METHODS = {
  STARS: {
    name: 'Telegram Stars',
    icon: 'https://i.postimg.cc/3N3f5zhH/IMG-1243.png',
    contact: '@MetaGift_support'
  },
  YOOMONEY: {
    name: 'ЮMoney',
    icon: 'https://thumb.tildacdn.com/tild6365-6562-4437-a465-306531386233/-/format/webp/4.png',
    wallet: '4100118542839036'
  },
  TON: {
    name: 'TON Wallet',
    icon: 'https://ton.org/download/ton_symbol.png',
    wallet: 'UQDy5hhPvhwcNY9g-lP-nkjdmx4rAVZGFEnhOKzdF-JcIiDW'
  }
};

// Function to send message via Telegram Bot API
async function sendTelegramMessage(userId, message, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: parse_mode
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message sent successfully to user ${userId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message to user ${userId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message to user ${userId}:`, error);
    return false;
  }
}

// Function to send message with inline keyboard
async function sendTelegramMessageWithKeyboard(chatId, message, keyboard, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parse_mode,
        reply_markup: keyboard
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message with keyboard sent successfully to chat ${chatId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message with keyboard to chat ${chatId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message with keyboard to chat ${chatId}:`, error);
    return false;
  }
}

// Data file paths
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const USER_STATS_FILE = path.join(__dirname, 'user-stats.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const PAYMENT_REQUESTS_FILE = path.join(__dirname, 'payment-requests.json');
const USER_BALANCE_FILE = path.join(__dirname, 'user-balance.json');

// Helper functions for loading and saving
function loadJSON(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(`Error loading ${filePath}, using defaults`);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`Error saving ${filePath}:`, error);
  }
}

// Load initial data
let activityItems = loadJSON(ACTIVITY_FILE, []);
let inventoryItems = loadJSON(INVENTORY_FILE, []);
let userStatsData = loadJSON(USER_STATS_FILE, {});
let referralsData = loadJSON(REFERRALS_FILE, {});
let paymentRequestsData = loadJSON(PAYMENT_REQUESTS_FILE, []);
let userBalanceData = loadJSON(USER_BALANCE_FILE, {});

// API endpoints
app.get('/api/items', async (req, res) => {
  try {
    const items = await getAllItems();
    console.log(`API: Loaded ${items.length} items`);
    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.json([]);
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const activity = await getAllActivity();
    res.json(activity);
  } catch (error) {
    console.error('Error getting activity:', error);
    res.json([]);
  }
});

app.get('/api/inventory/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!userId || isNaN(userId) || userId <= 0) {
    console.error('Invalid user ID provided:', req.params.userId);
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  try {
    console.log(`Loading inventory for user ${userId}`);
    const inventory = await getUserInventory(userId);
    
    if (!inventory) {
      console.log(`No inventory found for user ${userId}, returning empty array`);
      return res.json([]);
    }
    
    if (!Array.isArray(inventory)) {
      console.error('Inventory data is not an array:', typeof inventory);
      return res.json([]);
    }
    
    console.log(`Successfully loaded ${inventory.length} items for user ${userId}`);
    res.json(inventory);
  } catch (error) {
    console.error('Error getting user inventory:', error);
    res.status(500).json({ error: 'Failed to load inventory' });
  }
});

app.get('/api/user-stats/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const userStatsData = loadJSON(USER_STATS_FILE, {});
    const stats = userStatsData[userId] || {};

    // Return consistent format
    const formattedStats = {
      totalPurchases: stats.totalPurchases || 0,
      totalSpent: stats.totalSpent || 0,
      referralCount: stats.referralCount || 0,
      referralEarnings: stats.referralEarnings || 0,
      username: stats.username || ''
    };
    res.json(formattedStats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.json({
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    });
  }
});

app.get('/api/user-balance/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const stars = await getUserBalance(userId);
    res.json({ stars });
  } catch (error) {
    console.error('Error getting user balance:', error);
    res.json({ stars: 0 });
  }
});

// Get payment methods and converted prices for an item
app.get('/api/payment-methods/:itemId', async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const items = await getAllItems();
    const item = items.find(item => item.id === itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const paymentMethods = [];

    // Add payment methods based on item prices
    if (item.prices) {
      if (item.prices.STARS > 0) {
        paymentMethods.push({
          id: 'STARS',
          name: 'Telegram Stars',
          icon: PAYMENT_METHODS.STARS.icon,
          price: item.prices.STARS,
          contact: PAYMENT_METHODS.STARS.contact
        });
      }

      if (item.prices.RUB > 0) {
        paymentMethods.push({
          id: 'YOOMONEY',
          name: 'ЮMoney (₽)',
          icon: PAYMENT_METHODS.YOOMONEY.icon,
          price: item.prices.RUB,
          wallet: PAYMENT_METHODS.YOOMONEY.wallet
        });
      }

      if (item.prices.TON > 0) {
        paymentMethods.push({
          id: 'TON',
          name: 'TON Wallet',
          icon: PAYMENT_METHODS.TON.icon,
          price: item.prices.TON,
          wallet: PAYMENT_METHODS.TON.wallet
        });
      }
    }

    res.json({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new item (admin only)
app.post('/api/items', async (req, res) => {
  try {
    const newItem = req.body;
    const items = loadData();

    // Auto-generate ID based on highest existing ID + 1
    const maxId = items.length > 0 ? Math.max(...items.map(item => item.id)) : 0;
    newItem.id = maxId + 1;

    items.push(newItem);
    saveData(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update item (admin only)
app.put('/api/items/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const updatedItem = req.body;
    const items = loadData();

    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items[itemIndex] = { ...items[itemIndex], ...updatedItem };
    saveData(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete item (admin only)
app.delete('/api/items/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const items = loadData();

    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items.splice(itemIndex, 1);
    saveData(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Purchase with balance endpoint
app.post('/api/purchase-with-balance', async (req, res) => {
  const { itemId, userId, username, starsPrice, referrerId } = req.body;

  try {
    const items = loadData();
    const item = items.find(nft => nft.id === itemId);

    if (!item || item.stock <= 0) {
      return res.status(400).json({ error: 'Товар недоступен или распродан' });
    }

    // Check user balance
    const userBalance = await getUserBalance(userId);
    if (userBalance < starsPrice) {
      return res.status(400).json({ error: 'Недостаточно Stars на балансе' });
    }

    // Decrease user balance
    const newBalance = userBalance - starsPrice;
    await updateUserBalance(userId, newBalance, username);

    // Decrease item stock
    item.stock -= 1;
    if (item.stock === 0) {
      const newItems = items.filter(nft => nft.id !== itemId);
      saveData(newItems);
    } else {
      saveData(items);
    }

    // Calculate buyer number for this item - считаем сколько раз этот товар уже покупался
    const activity = await getAllActivity();
    const buyersForThisItem = activity.filter(a => a.id === itemId).length + 1;

    // Add to activity and inventory
    const activityData = {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      convertedPrice: starsPrice,
      prices: item.prices,
      userId: userId,
      username: username,
      buyerNumber: buyersForThisItem
    };

    const inventoryData = {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      convertedPrice: starsPrice,
      prices: item.prices,
      quantity: item.quantity,
      owner: '@' + username,
      userId: userId,
      username: username,
      status: item.status || 'Редкий',
      buyerNumber: buyersForThisItem
    };

    await addActivity(activityData);
    await addToInventory(inventoryData);
    await updateUserStats(userId, username, { price: item.price, convertedPrice: starsPrice });

    res.json({
      success: true,
      newBalance: newBalance,
      message: 'Покупка успешна!'
    });

  } catch (error) {
    console.error('Error purchasing with balance:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Payment request endpoints
app.post('/api/payment-request', (req, res) => {
  const { itemId, userId, username, price, itemName, itemImage, referrerId, paymentMethod, convertedPrice } = req.body;

  const paymentRequest = {
    id: Date.now().toString(),
    itemId: parseInt(itemId),
    userId: parseInt(userId),
    username: username,
    price: price,
    convertedPrice: convertedPrice || price,
    paymentMethod: paymentMethod || 'TON',
    itemName: itemName,
    itemImage: itemImage,
    referrerId: referrerId,
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(paymentRequest);
  saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

  res.json({ success: true });
});

app.get('/api/payment-requests', (req, res) => {
  const pendingRequests = paymentRequestsData.filter(request => request.status === 'pending');
  res.json(pendingRequests);
});

// Top up request endpoint
app.post('/api/topup-request', (req, res) => {
  const { userId, username, amount, type } = req.body;

  const topUpRequest = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    username: username,
    amount: parseInt(amount),
    type: type || 'stars_topup',
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(topUpRequest);
  saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

  res.json({ success: true });
});

// Transfer item endpoint
app.post('/api/transfer-item', async (req, res) => {
  const { itemId, fromUserId, fromUsername, toUserId, comment, item } = req.body;

  try {
    if (!item || !item.id || !item.name || !fromUserId || !fromUsername || !toUserId) {
      return res.status(400).json({ error: 'Отсутствуют обязательные данные для передачи' });
    }

    const recipientUserId = parseInt(toUserId);
    if (isNaN(recipientUserId) || recipientUserId <= 0) {
      return res.status(400).json({ error: 'Некорректный ID получателя' });
    }

    if (parseInt(fromUserId) === recipientUserId) {
      return res.status(400).json({ error: 'Нельзя передать подарок самому себе' });
    }

    // Find item in sender's inventory
    const inventory = await getUserInventory(parseInt(fromUserId));
    const inventoryItem = inventory.find(invItem =>
      invItem.inventoryId === item.inventoryId ||
      (invItem.id === item.id && invItem.name === item.name)
    );

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Предмет не найден в вашем инвентаре' });
    }

    // Remove from sender's inventory
    await removeFromInventory(inventoryItem.inventoryId, parseInt(fromUserId));

    // Add to recipient's inventory
    const newInventoryItem = {
      ...inventoryItem,
      inventoryId: Date.now() + Math.random(),
      userId: recipientUserId,
      username: `user_${recipientUserId}`, // Will be updated when user logs in
      owner: `ID: ${recipientUserId}`,
      comment: comment || null,
      transferDate: new Date().toISOString(),
      fromUsername: fromUsername
    };

    await addToInventory(newInventoryItem);

    // Send notification to recipient
    const message = `🎁 <b>Вы получили подарок!</b>\n\n` +
      `📦 Подарок: ${item.name}\n` +
      `👤 От: ${fromUsername}\n` +
      `💬 Комментарий: ${comment || 'Без комментария'}\n\n` +
      `Подарок добавлен в ваш инвентарь!`;

    sendTelegramMessage(recipientUserId, message);

    res.json({ success: true });

  } catch (error) {
    console.error('Error transferring item:', error);
    res.status(500).json({ error: 'Произошла ошибка при передаче подарка' });
  }
});

// Admin approval endpoints
app.post('/api/payment-request/:id/approve', async (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  try {
    request.status = 'approved';

    const items = loadData();
    const item = items.find(nft => nft.id === request.itemId);

    if (item && item.stock > 0) {
      item.stock -= 1;
      if (item.stock === 0) {
        const newItems = items.filter(nft => nft.id !== request.itemId);
        saveData(newItems);
      } else {
        saveData(items);
      }

      // Calculate buyer number for this item
      const activity = await getAllActivity();
      const buyersForThisItem = activity.filter(a => a.id === request.itemId).length + 1;

      // Add to activity and inventory
      const activityData = {
        id: request.itemId,
        name: request.itemName,
        image: request.itemImage,
        price: request.price,
        convertedPrice: request.convertedPrice,
        paymentMethod: request.paymentMethod,
        userId: request.userId,
        username: request.username,
        buyerNumber: buyersForThisItem
      };

      const inventoryData = {
        id: request.itemId,
        name: request.itemName,
        image: request.itemImage,
        price: request.price,
        convertedPrice: request.convertedPrice,
        quantity: item.quantity,
        owner: 'UQDy...liDW',
        userId: request.userId,
        username: request.username,
        status: 'Редкий',
        buyerNumber: buyersForThisItem
      };

      await addActivity(activityData);
      await addToInventory(inventoryData);
      await updateUserStats(request.userId, request.username, { price: request.price, convertedPrice: request.convertedPrice });
    }

    saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);
    res.json({ success: true });

  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/topup-request/:id/approve', async (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId && r.type === 'stars_topup');

  if (!request) {
    return res.status(404).json({ error: 'Top up request not found' });
  }

  try {
    request.status = 'approved';
    saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

    // Update user balance
    const currentBalance = await getUserBalance(request.userId);
    const newBalance = currentBalance + request.amount;
    await updateUserBalance(request.userId, newBalance, request.username);

    // Send notification
    const message = `💰 <b>Пополнение баланса подтверждено!</b>\n\n` +
      `⭐ Начислено: ${request.amount} Stars\n` +
      `💳 Текущий баланс: ${newBalance} Stars\n\n` +
      `Теперь вы можете покупать подарки с баланса! 🎁`;

    sendTelegramMessage(request.userId, message);

    res.json({ success: true });

  } catch (error) {
    console.error('Error approving top up:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/payment-request/:id/reject', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  request.status = 'rejected';
  saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`🌐 Mini App URL: https://metagift-market.replit.app`);
  console.log(`📱 Telegram Bot: @MetaGiftMarketBot`);
  console.log(`\nℹ️ Setup URLs:`);
  console.log(`To set webhook, visit: https://metagift-market.replit.app/set-webhook`);
  console.log(`To check webhook, visit: https://metagift-market.replit.app/webhook-info`);
});
