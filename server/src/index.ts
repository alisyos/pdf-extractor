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

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client/dist')));

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 로깅 유틸리티
const logError = (message: string, error: any) => {
  console.error('=== ERROR LOG ===');
  console.error('Message:', message);
  console.error('Error:', error);
  if (error instanceof Error) {
    console.error('Stack:', error.stack);
  }
  console.error('================');
};

// API 엔드포인트
app.post('/api/extract', upload.single('file'), async (req: FileRequest, res: Response) => {
  const startTime = Date.now();
  console.log('\n=== New Request Started ===');
  console.log('Time:', new Date().toISOString());
  
  try {
    // 환경 체크
    console.log('Environment Check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('- Memory usage:', process.memoryUsage());
    
    if (!req.file) {
      logError('No file uploaded', new Error('File missing in request'));
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded',
        details: '파일이 업로드되지 않았습니다.'
      });
    }

    // 파일 정보 로깅
    console.log('File Information:');
    console.log({
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      encoding: req.file.encoding
    });

    // PDF 파싱
    let pdfText = '';
    try {
      console.log('Starting PDF parsing...');
      const pdfBuffer = req.file.buffer;
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty');
      }
      
      const pdfData = await pdfParse(pdfBuffer);
      pdfText = pdfData.text;
      
      if (!pdfText || pdfText.length === 0) {
        throw new Error('Parsed PDF text is empty');
      }
      
      console.log('PDF parsed successfully:');
      console.log('- Text length:', pdfText.length);
      console.log('- First 100 chars:', pdfText.substring(0, 100));
      
    } catch (pdfError) {
      logError('PDF parsing failed', pdfError);
      return res.status(500).json({ 
        success: false,
        error: 'PDF parsing failed',
        details: `PDF 파싱 오류: ${pdfError instanceof Error ? pdfError.message : '알 수 없는 오류'}`
      });
    }

    // OpenAI API 호출
    try {
      console.log('Preparing OpenAI API call...');
      
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
      }

      const messages = [
        {
          role: "system",
          content: "You are a helpful assistant that extracts key information from documents."
        },
        {
          role: "user",
          content: `Please extract key information from this text: ${pdfText}`
        }
      ];

      console.log('Calling OpenAI API with message length:', messages[1].content.length);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const extractedInfo = completion.choices[0].message.content;
      console.log('OpenAI API call successful:');
      console.log('- Response length:', extractedInfo.length);
      console.log('- First 100 chars:', extractedInfo.substring(0, 100));

      const processingTime = Date.now() - startTime;
      console.log(`Total processing time: ${processingTime}ms`);

      return res.json({ 
        success: true,
        extractedInfo,
        processingTime
      });
      
    } catch (openaiError) {
      logError('OpenAI API call failed', openaiError);
      return res.status(500).json({ 
        success: false,
        error: 'OpenAI API call failed',
        details: `OpenAI API 오류: ${openaiError instanceof Error ? openaiError.message : '알 수 없는 오류'}`
      });
    }

  } catch (error) {
    logError('Unexpected error occurred', error);
    return res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: `서버 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    });
  }
});

// 서버 시작
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server started at ${new Date().toISOString()}`);
  console.log(`Running on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV);
}); 