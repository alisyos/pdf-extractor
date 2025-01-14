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
dotenv.config();

// OpenAI 설정 확인
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 타입 정의
interface FileRequest extends Request {
  file?: Express.Multer.File;
  body: {
    fields: string;
  };
}

const app = express();
const port = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client/dist')));

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// API 엔드포인트
app.post('/api/extract', upload.single('file'), async (req: FileRequest, res: Response) => {
  try {
    console.log('Received file upload request');
    
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname);

    // PDF 파싱
    const pdfBuffer = req.file.buffer;
    console.log('Parsing PDF...');
    
    const pdfData = await pdfParse(pdfBuffer);
    console.log('PDF parsed successfully');

    // OpenAI API 호출
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not set');
      return res.status(500).json({ error: 'OpenAI API key is not configured' });
    }

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
      ]
    });

    console.log('OpenAI API call successful');
    const extractedInfo = completion.choices[0].message.content;

    res.json({ 
      success: true,
      text: pdfData.text,
      extractedInfo: extractedInfo
    });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: `Error processing ${req?.file?.originalname || 'file'}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 