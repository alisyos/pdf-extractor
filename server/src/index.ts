import express, { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import pdfParse from 'pdf-parse'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import { Express as ExpressType } from 'express'

// 환경변수 설정
dotenv.config()

const app: ExpressType = express()
const port = process.env.PORT || 3001

// 미들웨어 설정
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../client/dist')))

// 파일 업로드 설정
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables')
}

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// PDF 텍스트 추출 함수
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('PDF 파싱 에러:', error)
    throw new Error('PDF 파일 처리 중 오류가 발생했습니다.')
  }
}

interface Field {
  title: string;
  description: string;
}

// OpenAI API 호출 함수 수정
async function callOpenAI(text: string, fields: Field[]): Promise<string> {
  try {
    const fieldsDescription = fields
      .map(field => `${field.title}: ${field.description}`)
      .join('\n');

    const fieldNames = fields.map(field => field.title);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `PDF에서 정보를 추출하여 정확히 다음 형식의 JSON으로 반환해주세요:
{
${fieldNames.map(name => `  "${name}": [`).join('\n')}
    "첫 번째 항목의 내용",
    "두 번째 항목의 내용",
    ...
  ]
}

주의사항:
1. 모든 필드는 배열이어야 합니다
2. 모든 배열의 길이는 동일해야 합니다
3. 같은 인덱스는 같은 문제/항목을 나타냅니다
4. 정보를 찾을 수 없는 경우 "정보 없음"으로 표시해주세요`
        },
        {
          role: "user",
          content: `다음 텍스트에서 요청한 정보를 추출해주세요.

추출할 항목:
${fieldsDescription}

텍스트:
${text}`
        }
      ],
      temperature: 0.3
    });

    const result = completion.choices[0].message.content;
    if (!result) {
      throw new Error('OpenAI API가 응답을 반환하지 않았습니다.');
    }

    try {
      const parsedJson = JSON.parse(result);
      
      // 모든 필드가 있는지 확인하고, 없는 경우 추가
      fields.forEach(field => {
        if (!(field.title in parsedJson)) {
          parsedJson[field.title] = ["정보 없음"];
        }
      });

      // 배열 길이 통일
      const maxLength = Math.max(
        ...Object.values(parsedJson)
          .filter(Array.isArray)
          .map(arr => arr.length)
      );

      // 모든 배열의 길이를 maxLength로 맞춤
      Object.keys(parsedJson).forEach(key => {
        if (!Array.isArray(parsedJson[key])) {
          parsedJson[key] = ["정보 없음"];
        }
        while (parsedJson[key].length < maxLength) {
          parsedJson[key].push("정보 없음");
        }
      });

      return JSON.stringify(parsedJson);
    } catch (error) {
      console.error('JSON 파싱 에러:', error);
      // 기본 응답 생성
      const defaultResponse = Object.fromEntries(
        fields.map(field => [field.title, ["정보 없음"]])
      );
      return JSON.stringify(defaultResponse);
    }
  } catch (error) {
    console.error('OpenAI API 에러:', error);
    throw new Error('OpenAI API 호출 중 오류가 발생했습니다.');
  }
}

// 타입 정의
interface ExtractRequest extends Request {
  file?: Express.Multer.File
  body: {
    fields: string
  }
}

// API 엔드포인트 수정
app.post('/api/extract', upload.single('file'), async (req: ExtractRequest, res: Response) => {
  try {
    // 입력 검증
    if (!req.file) {
      res.status(400).json({ error: 'PDF 파일이 필요합니다.' })
      return
    }
    
    let fields: Field[]
    try {
      fields = JSON.parse(req.body.fields)
      console.log('받은 필드 데이터:', fields)
    } catch (error) {
      res.status(400).json({ error: '필드 데이터 형식이 잘못되었습니다.' })
      return
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      res.status(400).json({ error: '추출 항목이 필요합니다.' })
      return
    }

    // fields 유효성 검사
    if (!fields.every(field => field.title && field.description)) {
      res.status(400).json({ error: '모든 추출 항목에는 제목과 설명이 필요합니다.' })
      return
    }

    console.log('파일 처리 시작:', req.file.originalname)
    console.log('추출 항목:', fields)

    // PDF 텍스트 추출
    const pdfText = await extractTextFromPDF(req.file.buffer)
    console.log('PDF 텍스트 추출 완료:', pdfText.length, '자')

    // 텍스트 길이 제한
    const maxLength = 4000
    const truncatedText = pdfText.length > maxLength 
      ? pdfText.substring(0, maxLength) + "..."
      : pdfText

    // OpenAI API 호출
    console.log('OpenAI API 호출 시작')
    const result = await callOpenAI(truncatedText, fields)
    console.log('OpenAI API 호출 완료')

    res.json({ result })
  } catch (error) {
    console.error('서버 에러:', error)
  }
})

// 에러 핸들러
app.use((err: Error, req: Request, res: Response) => {
  console.error(err)
  res.status(500).json({ 
    error: '서버 에러가 발생했습니다.',
    details: err.message
  })
})

// 기본 라우트
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'PDF Extractor API is running' })
})

// 서버 시작
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음')
}) 