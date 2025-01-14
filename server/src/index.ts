import express from 'express'
import cors from 'cors'

const app = express()

// 기본 미들웨어
app.use(cors())
app.use(express.json())

// 테스트 엔드포인트
app.get('/api/test', (_req, res) => {
  res.json({ message: 'Server is working' });
});

// 파일 업로드 엔드포인트 (임시)
app.post('/api/extract', (req, res) => {
  try {
    console.log('Received request to /api/extract');
    res.json({
      success: true,
      message: '테스트 응답입니다.'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다'
    });
  }
});

// 서버 시작
const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Server started on port ${port}`)
}) 