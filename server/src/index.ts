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

// OpenAI API 키 확인
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

// 미들웨어 설정
app.use(cors())
app.use(express.json())

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, 'public')));

// 파일 업로드 설정
const storage = multer.memoryStorage()
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 제한
})

// API 엔드포인트
app.post('/api/extract', upload.single('file'), async (req, res) => {
  console.log('=== PDF Extraction Request ===');
  console.log('Time:', new Date().toISOString());
  
  try {
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ 
        error: 'No file uploaded',
        details: '파일이 업로드되지 않았습니다.'
      });
    }

    console.log('File details:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      buffer: req.file.buffer ? 'Buffer exists' : 'No buffer'
    });

    try {
      // PDF 파싱 시도
      console.log('Starting PDF parsing...');
      const pdfBuffer = req.file.buffer;
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty');
      }

      const pdfData = await pdfParse(pdfBuffer);
      console.log('PDF parsing result:', {
        pageCount: pdfData.numpages,
        textLength: pdfData.text?.length || 0,
        info: pdfData.info
      });

      if (!pdfData.text || pdfData.text.length === 0) {
        throw new Error('Parsed PDF text is empty');
      }

      // OpenAI API 호출
      console.log('Calling OpenAI API...');
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
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      console.log('OpenAI API response received');

      return res.json({ 
        success: true,
        text: pdfData.text.substring(0, 1000) + '...',  // 긴 텍스트는 잘라서 반환
        extractedInfo: completion.choices[0].message.content
      });

    } catch (pdfError) {
      console.error('PDF processing error:', pdfError);
      return res.status(500).json({ 
        error: 'PDF processing failed',
        details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF processing error',
        name: req.file.originalname
      });
    }

  } catch (error) {
    console.error('General error:', error);
    return res.status(500).json({ 
      error: `Error processing ${req?.file?.originalname || 'file'}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
})

// 모든 경로에서 index.html 제공
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(port, () => {
  console.log('=== Server Started ===');
  console.log('Time:', new Date().toISOString());
  console.log('Port:', port);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
  console.log('Current directory:', __dirname);
  console.log('Public path:', path.join(__dirname, 'public'));
}) 