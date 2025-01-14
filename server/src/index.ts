import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'

const app = express()
const port = process.env.PORT || 3001

// 미들웨어
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../client/dist')))

// 파일 업로드 설정
const upload = multer({ storage: multer.memoryStorage() })

// 상태 확인
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// 파일 업로드
app.post('/api/extract', upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      })
    }

    // 파일 정보 반환
    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다.',
      file: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      error: '파일 처리 중 오류가 발생했습니다.'
    })
  }
})

// 서버 시작
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
}) 