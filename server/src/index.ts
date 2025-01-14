import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import pdfParse from 'pdf-parse'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// 환경변수 설정
dotenv.config()

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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
app.post('/api/extract', upload.single('file'), async (req, res) => {
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