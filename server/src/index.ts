import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import dotenv from 'dotenv'

// 환경변수 설정
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client/dist')));

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 기본 상태 체크 엔드포인트
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV,
    time: new Date().toISOString()
  });
});

// 파일 업로드 테스트 엔드포인트
app.post('/api/test-upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    res.json({
      success: true,
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Upload test error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Upload test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 메인 엔드포인트는 일단 간단한 응답만
app.post('/api/extract', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    // 일단 파일 정보만 반환
    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다.',
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Extract failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Current directory:', __dirname);
}); 