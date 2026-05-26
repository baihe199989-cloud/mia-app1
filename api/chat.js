export default async function handler(req, res) {

  // 允许跨域（必须有这几行）
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

    const chatData = await chatRes.json();
    const chatId = chatData.data.id;
    const convId = chatData.data.conversation_id;

    // 第二步：等待AI回复（最多等18秒）
    let reply = '能量正在传递中…';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 600));

      const statusRes = await fetch(
        `https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${convId}`,
        { headers: { 'Authorization': `Bearer ${process.env.COZE_TOKEN}` } }
      );
      const statusData = await statusRes.json();

      if (statusData.data.status === 'completed') {
        const msgRes = await fetch(
          `https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${convId}`,
          { headers: { 'Authorization': `Bearer ${process.env.COZE_TOKEN}` } }
        );
        const msgData = await msgRes.json();
        const aiMsg = msgData.data.find(m => m.role === 'assistant' && m.type === 'answer');
        if (aiMsg) reply = aiMsg.content;
        break;
      }

      if (statusData.data.status === 'failed') break;
    }

    res.json({ reply });

  } catch (e) {
    res.status(500).json({ reply: '链接暂时中断，请稍后再试。' });
  }
}
