require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const OpenAI = require('openai');

console.log('API Key:', process.env.OPENAI_API_KEY);

const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // Vite 개발 서버 주소
  credentials: true
}));
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
});

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/analyze-pdf', upload.single('pdf'), async (req, res) => {
  try {
    // PDF 파일 읽기
    const pdfData = await pdf(req.file.buffer);
    const text = pdfData.text;

    // OpenAI API를 사용하여 텍스트 분석
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `다음 텍스트를 분석하고 다음 기준에 따라 분류해주세요: ${req.body.description}`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const analysis = response.choices[0].message.content;

    // 엑셀 파일 생성
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([{
      원본텍스트: text,
      분석결과: analysis
    }]);
    
    xlsx.utils.book_append_sheet(wb, ws, "분석결과");
    
    // 엑셀 파일 전송
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=analyzed_results.xlsx');
    res.send(buffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('파일 처리 중 오류가 발생했습니다.');
  }
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('파일 크기는 10MB를 초과할 수 없습니다.');
    }
  }
  res.status(500).send('서버 에러가 발생했습니다.');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 