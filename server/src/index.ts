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
    console.log('=== Starting file processing ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
    
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File details:', {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // PDF 파싱
    let pdfText = '';
    try {
      console.log('Starting PDF parsing...');
      const pdfBuffer = req.file.buffer;
      const pdfData = await pdfParse(pdfBuffer);
      pdfText = pdfData.text;
      console.log('PDF parsed successfully. Text length:', pdfText.length);
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return res.status(500).json({ 
        error: 'PDF parsing failed',
        details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'
      });
    }

    // OpenAI API 호출
    try {
      console.log('Starting OpenAI API call...');
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts key information from documents."
          },
          {
            role: "user",
            content: `Please extract key information from this text: ${pdfText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      console.log('OpenAI API call successful');

      const extractedInfo = completion.choices[0].message.content;
      console.log('Extracted info length:', extractedInfo.length);

      return res.json({ 
        success: true,
        text: pdfText,
        extractedInfo: extractedInfo
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      return res.status(500).json({ 
        error: 'OpenAI API call failed',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error'
      });
    }

  } catch (error) {
    console.error('General error:', error);
    return res.status(500).json({ 
      error: `Error processing ${req?.file?.originalname || 'file'}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 