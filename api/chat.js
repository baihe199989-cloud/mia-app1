export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { message } = req.body;

  try {
    // 第一步：发起对话
    const chatRes = await fetch('https://api.coze.com/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COZE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bot_id: process.env.BOT_ID,
        user_id: 'user_mia',
        stream: false,
        auto_save_history: true,
        additional_messages: [{
          role: 'user',
          content: message,
          content_type: 'text'
        }]
      })
    });

    const chatJson = await chatRes.json();
    console.log('Chat response:', JSON.stringify(chatJson));

    // 兼容不同的返回格式
    const chatId = chatJson?.data?.id || chatJson?.id;
    const convId = chatJson?.data?.conversation_id || chatJson?.conversation_id;

    if (!chatId || !convId) {
      console.error('Missing chatId or convId:', chatJson);
      return res.json({ reply: '对话初始化失败，请稍后再试。' });
    }

    // 第二步：轮询等待回复
    let reply = '能量正在传递中…';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 800));

      const statusRes = await fetch(
        `https://api.coze.com/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${convId}`,
        { headers: { 'Authorization': `Bearer ${process.env.COZE_TOKEN}` } }
      );
      const statusJson = await statusRes.json();
      console.log('Status:', statusJson?.data?.status || statusJson?.status);

      const status = statusJson?.data?.status || statusJson?.status;

      if (status === 'completed') {
        const msgRes = await fetch(
          `https://api.coze.com/v3/chat/message/list?chat_id=${chatId}&conversation_id=${convId}`,
          { headers: { 'Authorization': `Bearer ${process.env.COZE_TOKEN}` } }
        );
        const msgJson = await msgRes.json();
        console.log('Messages:', JSON.stringify(msgJson));

        const messages = msgJson?.data || msgJson?.messages || [];
        const aiMsg = messages.find(m =>
          m.role === 'assistant' && m.type === 'answer'
        );
        if (aiMsg) reply = aiMsg.content;
        break;
      }

      if (status === 'failed' || status === 'error') {
        console.error('Chat failed:', statusJson);
        break;
      }
    }

    res.json({ reply });

  } catch (e) {
    console.error('Handler error:', e.message);
    res.status(500).json({ reply: '链接暂时中断，请稍后再试。' });
  }
}
