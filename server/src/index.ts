import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// 환경변수 설정
dotenv.config()

// PDF.js 워커 설정
const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.entry')
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const app = express()
const port = process.env.PORT || 3001

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// 미들웨어 설정
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')));

// 파일 업로드 설정
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// PDF 파싱 함수
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // PDF 문서 로드
    const data = new Uint8Array(buffer)
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise

    let fullText = ''
    
    // 각 페이지에서 텍스트 추출
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }

    return fullText
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('PDF 파싱 중 오류가 발생했습니다.')
  }
}

// API 엔드포인트
app.post('/api/extract', upload.single('file'), async (req, res) => {
  console.log('=== PDF Extraction Request ===')
  console.log('Time:', new Date().toISOString())
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        details: '파일이 업로드되지 않았습니다.'
      })
    }

    console.log('File received:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    })

    try {
      // PDF 파싱
      console.log('Starting PDF parsing...')
      const text = await extractTextFromPDF(req.file.buffer)
      console.log('PDF parsed successfully, text length:', text.length)

      if (!text || text.length === 0) {
        throw new Error('추출된 텍스트가 없습니다.')
      }

      // OpenAI API 호출
      console.log('Calling OpenAI API...')
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts key information from documents."
          },
          {
            role: "user",
            content: `Please extract key information from this text: ${text}`
          }
        ]
      })

      console.log('OpenAI API call successful')

      return res.json({ 
        success: true,
        text: text.substring(0, 1000) + '...',
        extractedInfo: completion.choices[0].message.content
      })

    } catch (pdfError) {
      console.error('PDF processing error:', pdfError)
      return res.status(500).json({ 
        error: 'PDF processing failed',
        details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF processing error'
      })
    }

  } catch (error) {
    console.error('General error:', error)
    return res.status(500).json({ 
      error: `Error processing ${req?.file?.originalname || 'file'}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 모든 경로에서 index.html 제공
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// 서버 시작
app.listen(port, () => {
  console.log('=== Server Started ===')
  console.log('Time:', new Date().toISOString())
  console.log('Port:', port)
  console.log('Environment:', process.env.NODE_ENV)
  console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY)
}) 