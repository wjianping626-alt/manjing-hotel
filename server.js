const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3457;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// ========== DeepSeek API (OpenAI 兼容格式) ==========
async function callDeepSeekAPI(prompt) {
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是慢境·麻黄梁艺术家酒店的AI行程规划师。酒店位于陕西榆林麻黄梁地质公园。

你需要根据用户需求生成详细、实用的旅行行程。每个时间段要具体到景点名称、活动内容、实用Tips。

关于麻黄梁区域的信息：
- 麻黄梁地质公园：黄土峡谷、丹霞地貌、亿万年地质奇观
- 慢境酒店：黄土高原上的艺术酒店，有展厅、艺术交流平台、天空露台、咖啡书吧
- 周边景点：高家堡古城、石峁遗址、红碱淖、统万城遗址、榆林老街
- 特色体验：陕北腰鼓、剪纸、泥塑、面花、柳编、刺绣等非遗艺术
- 美食：陕北羊肉面、黄米馍馍、洋芋擦擦、油旋

直接返回JSON格式，不要输出其他内容：
{
  "days": [
    {
      "dayNum": 1,
      "items": [
        {"time": "08:00", "activity": "具体活动描述，包含地点"},
        {"time": "10:00", "activity": "..."}
      ]
    }
  ]
}`
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error('DeepSeek API 返回异常：' + JSON.stringify(json)));
          }
        } catch (e) {
          reject(new Error('解析响应失败：' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ========== API 路由 ==========
async function handleAPI(req, res, url, body) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /api/generate-trip
  if (url === '/api/generate-trip' && req.method === 'POST') {
    try {
      const params = JSON.parse(body);

      // 检查 API Key
      if (!DEEPSEEK_API_KEY) {
        // Demo 模式：无 API Key 时返回示例数据
        const demo = generateDemoTrip(params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, demo: true, data: demo }));
        return;
      }

      const prompt = buildPrompt(params);
      const content = await callDeepSeekAPI(prompt);

      // 尝试解析 JSON
      let tripData;
      try {
        // 提取 JSON（可能被 ```json 包裹）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          tripData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('AI 返回中未找到 JSON');
        }
      } catch (parseErr) {
        // 解析失败，尝试用文本构造
        tripData = { rawText: content };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, data: tripData }));
    } catch (err) {
      console.error('[AI 生成失败]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
}

// ========== Prompt 构建 ==========
function buildPrompt(params) {
  const { destination = '麻黄梁', days = 2, interests = [] } = params;
  const interestNames = {
    photography: '摄影', hiking: '徒步', art: '艺术',
    food: '美食', culture: '人文', family: '亲子',
    relax: '休闲', night: '夜景',
  };
  const labels = interests.map(i => interestNames[i] || i).join('、') || '综合体验';

  return `为${destination}规划一个${days}天旅行行程。
用户偏好：${labels}

要求：
- 安排在慢境·麻黄梁艺术家酒店住宿
- 行程紧凑但不赶，有节奏感
- 融入当地特色体验和用户兴趣偏好
- 每个时间段包含具体地点和活动描述
- 适当加入实用建议`;
}

// ========== Demo 数据 ==========
function generateDemoTrip(params) {
  const { days = 2, interests = [] } = params;
  const hasPhotography = interests.includes('photography');
  const hasHiking = interests.includes('hiking');
  const hasArt = interests.includes('art');
  const hasFood = interests.includes('food');
  const hasFamily = interests.includes('family');
  const hasNight = interests.includes('night');

  const result = { days: [] };

  // Day 1
  const day1 = {
    dayNum: 1,
    items: [
      { time: '08:00', activity: '抵达麻黄梁，入住慢境酒店标准间，放下行李稍作休整' },
      { time: '09:00', activity: hasHiking
        ? '麻黄梁地质公园晨间徒步，沿峡谷栈道深入黄土沟壑，拍摄清晨光线下的丹霞地貌'
        : '麻黄梁地质公园晨间游览，坐观光车浏览黄土峡谷全景' },
      { time: '11:30', activity: hasFood
        ? '酒店自助餐厅午餐，品尝陕北特色：羊肉面、洋芋擦擦、黄米馍馍'
        : '酒店自助餐厅午餐，享用本地食材创意料理' },
      { time: '14:00', activity: hasArt
        ? '慢境酒店艺术展厅参观，欣赏陕北剪纸、泥塑、石雕等当代艺术展'
        : '酒店艺术交流平台，听艺术家驻留分享会' },
      { time: '16:00', activity: hasPhotography
        ? '前往观景阶梯拍摄黄土崖壁日落光线，推荐广角镜头记录峡谷层理'
        : '沿观景阶梯漫步，欣赏黄土高原的壮阔地貌' },
      { time: '18:30', activity: '酒店餐厅晚餐，推荐尝试黄土高原烤全羊' },
      ...(hasNight
        ? [{ time: '20:30', activity: '天空露台观星，远离光污染的黄土高原是绝佳观星地，酒店提供天文望远镜' }]
        : [{ time: '20:00', activity: '咖啡书吧阅读时光，品一杯手冲咖啡，翻阅陕北文化书籍' }]),
    ],
  };

  // Day 2
  const day2 = {
    dayNum: 2,
    items: [
      { time: '08:00', activity: '酒店早餐，享受窗外黄土峡谷晨景' },
      { time: '09:00', activity: hasFamily
        ? '非遗工坊亲子体验：亲手制作陕北剪纸和面花，感受黄土手工艺温度'
        : '非遗艺术体验：跟随当地艺人学习陕北剪纸，亲手创作一件作品' },
      { time: '11:00', activity: hasHiking
        ? '徒步前往高家堡古城（约3km），沿途欣赏黄土梁上的人文遗迹'
        : '驱车前往高家堡古城，探访这座陕北保存最完整的明代古城' },
      { time: '12:30', activity: '高家堡古镇午餐，品尝老街小吃：油旋、羊杂碎、枣糕' },
      { time: '14:30', activity: '返回酒店，天空露台享用下午茶，俯瞰麻黄梁全景' },
      { time: '16:00', activity: hasPhotography
        ? '傍晚黄金时段再赴峡谷拍摄，这次走不同角度捕捉光影变幻'
        : '酒店休闲区自由活动，或体验陕北腰鼓表演' },
      { time: '17:30', activity: '办理退房，结束慢境之旅，带走满满的黄土记忆' },
    ],
  };

  result.days.push(day1);
  if (days >= 2) result.days.push(day2);

  // Day 3（3天以上行程）
  if (days >= 3) {
    result.days.push({
      dayNum: 3,
      items: [
        { time: '08:00', activity: '酒店早餐' },
        { time: '09:30', activity: '前往石峁遗址，探访4000年前的华夏石头城，中国史前最大城址' },
        { time: '12:00', activity: '返回途中在榆林老街午餐，感受塞上古城的烟火气' },
        { time: '14:00', activity: '红碱淖沙漠湖泊体验：中国最大沙漠淡水湖，水鸟与沙丘的奇景' },
        { time: '18:00', activity: '返回酒店，天空露台看夕阳落下黄土高原' },
        { time: '19:30', activity: '告别晚宴，与驻留艺术家交流创作心得' },
      ],
    });
  }

  return result;
}

// ========== 静态文件服务 ==========
const server = http.createServer(async (req, res) => {
  try {
    // API 路由
    if (req.url.startsWith('/api/')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => handleAPI(req, res, req.url.split('?')[0], body));
      return;
    }

    // 静态文件
    let url = req.url.split('?')[0];
    url = decodeURIComponent(url);
    let f = path.join('.', url);
    if (f === '.' || f === '.\\') f = './index.html';

    const c = fs.readFileSync(f);
    const ext = path.extname(f).slice(1);
    const types = {
      'html': 'text/html;charset=utf-8',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(c);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 慢境酒店运行中: http://localhost:${PORT}`);
  console.log(DEEPSEEK_API_KEY ? '🔑 DeepSeek API 已启用' : '⚠️  未设置 DEEPSEEK_API_KEY，AI 行程为 Demo 模式');
});
