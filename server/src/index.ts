import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import pdfParse from 'pdf-parse'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// 환경변수 설정
dotenv.config()

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// 타입 정의
interface FileRequest extends Request {
  file?: Express.Multer.File
  body: {
    fields: string
  }
}

const app = express()
const port = process.env.PORT || 3001

// 미들웨어 설정
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../client/dist')))

// 파일 업로드 설정
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// API 엔드포인트
app.post('/api/extract', upload.single('file'), async (req: FileRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // PDF 파싱
    const pdfBuffer = req.file.buffer
    const pdfData = await pdfParse(pdfBuffer)

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts key information from documents."
        },
        {
          role: "user",
          content: `Please extract key information from this text: ${pdfData.text}`
        }
      ]
    })

    res.json({ 
      success: true,
      text: pdfData.text,
      extractedInfo: completion.choices[0].message.content
    })

  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ 
      error: `Error processing ${req?.file?.originalname || 'file'}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 서버 시작
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
}) 
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