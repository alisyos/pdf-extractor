import express from 'express'
import cors from 'cors'

const app = express()
const port = process.env.PORT || 3001

// 기본 미들웨어
app.use(cors())
app.use(express.json())

// 루트 경로
app.get('/', (_req, res) => {
  res.send('Server is running');
});

// 테스트 엔드포인트
app.get('/api/test', (_req, res) => {
  res.json({ 
    message: 'Server is working',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
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
app.listen(port, () => {
  console.log('=== Server Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Port:', port);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Current directory:', __dirname);
  console.log('=====================');
});

// 예기치 않은 오류 처리
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
}); 