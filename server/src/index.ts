import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'

const app = express()

// 기본 미들웨어
app.use(cors())
app.use(express.json())

// 정적 파일 제공
const clientPath = path.join(__dirname, '../../client/dist')
console.log('Client path:', clientPath)
app.use(express.static(clientPath))

// 파일 업로드 설정
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
})

// 상태 확인 엔드포인트
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  })
})

// 파일 업로드 엔드포인트
app.post('/api/extract', (req, res) => {
  console.log('Received request to /api/extract')
  
  const uploadMiddleware = upload.single('file')
  
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err)
      return res.status(400).json({
        success: false,
        error: '파일 업로드 오류',
        details: err.message
      })
    } else if (err) {
      console.error('Unknown error:', err)
      return res.status(500).json({
        success: false,
        error: '서버 오류',
        details: err.message
      })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({
        success: false,
        error: '파일이 없습니다'
      })
    }

    // 성공 응답
    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다',
      fileInfo: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      }
    })
  })
})

// 404 처리
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 페이지를 찾을 수 없습니다'
  })
})

// 에러 핸들러
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err)
  res.status(500).json({
    success: false,
    error: '서버 오류가 발생했습니다',
    details: err.message
  })
})

// 서버 시작
const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Server started on port ${port}`)
  console.log('Environment:', process.env.NODE_ENV)
  console.log('Current directory:', __dirname)
}) 