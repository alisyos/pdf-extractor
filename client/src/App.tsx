import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { Field } from './types'

interface Template {
  id: string
  name: string
  fields: ExtractionField[]
  content: string
}

interface ExtractedData {
  [key: string]: string[];
}

interface HistoryItem {
  id: string
  timestamp: number
  fileName: string
  fields: Field[]
  result: string
}

interface ExtractionField {
  title: string
  description: string
}

interface Result {
  content: string;
}

// API URL을 현재 호스트 기반으로 설정
const API_URL = `${window.location.origin}/api/extract`;

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([])
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<{[key: string]: string | null}>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [fields, setFields] = useState<ExtractionField[]>([
    { title: '', description: '' }
  ])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [extractedResult, setExtractedResult] = useState<Result | null>(null)

  // 유틸리티 함수들
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename);
  };

  const createTemplate = (id: string, name: string, fields: Field[]): Template => {
    return {
      id,
      name,
      fields,
      content: JSON.stringify({ name, fields }, null, 2)
    };
  };

  // 다운로드 핸들러 함수들
  const handleTemplateDownload = () => {
    if (selectedTemplate) {
      const content = JSON.stringify(selectedTemplate);
      downloadFile(content, 'template.txt');
    }
  };

  const handleResultDownload = () => {
    if (extractedResult) {
      const content = JSON.stringify(extractedResult);
      downloadFile(content, 'result.txt');
    }
  };

  // 735번째 줄과 798번째 줄의 unknown 타입 처리
  const handleTemplateAction = (data: any) => {
    if (data && typeof data === 'object') {
      const content = JSON.stringify(data);
      downloadFile(content, 'template.txt');
    }
  };

  const handleResultAction = (data: any) => {
    if (data && typeof data === 'object') {
      const content = JSON.stringify(data);
      downloadFile(content, 'result.txt');
    }
  };

  // 템플릿 로드
  useEffect(() => {
    const savedTemplates = localStorage.getItem('extractionTemplates')
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates))
    }
  }, [])

  // 히스토리 로드
  useEffect(() => {
    const savedHistory = localStorage.getItem('extractionHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const getFullDescription = () => {
    return fields
      .filter(field => field.title && field.description)
      .map(field => `${field.title}: ${field.description}`)
      .join('\n')
  }

  const saveTemplate = () => {
    if (!templateName || fields.every(f => !f.title && !f.description)) {
      alert('템플릿 이름과 최소 하나의 추출 항목이 필요합니다.')
      return
    }

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: templateName,
      fields: fields.filter(f => f.title && f.description),
      content: JSON.stringify({ name: templateName, fields: fields.filter(f => f.title && f.description) }, null, 2)
    }

    const updatedTemplates = [...templates, newTemplate]
    setTemplates(updatedTemplates)
    localStorage.setItem('extractionTemplates', JSON.stringify(updatedTemplates))
    setTemplateName('')
    setShowTemplates(false)
  }

  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id)
    setTemplates(updatedTemplates)
    localStorage.setItem('extractionTemplates', JSON.stringify(updatedTemplates))
  }

  const loadTemplate = (template: Template) => {
    setFields(template.fields)
    setShowTemplates(false)
  }

  const addField = () => {
    setFields([...fields, { title: '', description: '' }])
  }

  const removeField = (index: number) => {
    if (fields.length > 1) {
      setFields(fields.filter((_, i) => i !== index))
    }
  }

  const updateField = (index: number, field: Partial<ExtractionField>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...field }
    setFields(newFields)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0 || fields.every(f => !f.title && !f.description)) return

    setIsLoading(true)
    const newResults: {[key: string]: string | null} = {}

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fields', JSON.stringify(fields.filter(f => f.title && f.description)))

        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`${file.name} 처리 실패 (${response.status})`)
          }

          const data = await response.json()
          if (data.error) {
            throw new Error(data.error)
          }
          
          newResults[file.name] = data.result
          if (data.result) {
            saveToHistory(data.result, file.name)
          }
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error)
          newResults[file.name] = `Error: ${error.message}`
        }
      }

      setResults(newResults)
    } catch (error) {
      console.error('Error:', error)
      alert('데이터 추출 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 히스토리 저장
  const saveToHistory = (result: string, fileName: string) => {
    const validFields = fields.filter(f => f.title && f.description)
    
    const newHistoryItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      fileName,
      fields: validFields,
      result
    }

    const updatedHistory = [newHistoryItem, ...history]
    setHistory(updatedHistory)
    localStorage.setItem('extractionHistory', JSON.stringify(updatedHistory))
  }

  // 히스토리 삭제
  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id)
    setHistory(updatedHistory)
    localStorage.setItem('extractionHistory', JSON.stringify(updatedHistory))
  }

  // 히스토리 검색
  const filteredHistory = useMemo(() => {
    return history.filter(item =>
      item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(item.fields).toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [history, searchTerm])

  const renderTable = (jsonData: string) => {
    try {
      if (typeof jsonData !== 'string') {
        jsonData = JSON.stringify(jsonData);
      }

      if (jsonData.startsWith('Error:')) {
        return (
          <div style={{
            padding: '12px',
            backgroundColor: '#fff3f3',
            border: '1px solid #dc3545',
            borderRadius: '4px',
            color: '#dc3545'
          }}>
            {jsonData}
          </div>
        );
      }

      const data = JSON.parse(jsonData);
      const keys = Object.keys(data);
      const numRows = data[keys[0]]?.length || 0;

      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '10px',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #dee2e6'
              }}>
                {keys.map(key => (
                  <th key={key} style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 'bold'
                  }}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numRows }).map((_, rowIndex) => (
                <tr key={rowIndex} style={{
                  borderBottom: '1px solid #dee2e6'
                }}>
                  {keys.map(key => (
                    <td key={key} style={{
                      padding: '12px',
                      borderRight: '1px solid #dee2e6',
                      color: '#212529'
                    }}>
                      {data[key][rowIndex] || "정보 없음"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch (error) {
      console.error('테이블 렌더링 에러:', error);
      return (
        <div style={{
          padding: '12px',
          backgroundColor: '#fff3f3',
          border: '1px solid #dc3545',
          borderRadius: '4px',
          color: '#dc3545'
        }}>
          데이터 형식 오류: {error.message}
        </div>
      );
    }
  };

  // 이력 항목 렌더링
  const renderHistoryItem = (item: HistoryItem) => (
    <div
      key={item.id}
      style={{
        padding: '15px',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: 'white'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <div>
          <strong style={{ fontSize: '1.1em' }}>{item.fileName}</strong>
          <div style={{ color: '#6c757d', fontSize: '0.9em' }}>
            {new Date(item.timestamp).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              try {
                // 결과 보기 시 fields도 함께 복원
                setFields(item.fields)
                setResults({ [item.fileName]: item.result })
                
                // 결과 섹션으로 스크롤
                const resultsSection = document.getElementById('results-section')
                if (resultsSection) {
                  resultsSection.scrollIntoView({ behavior: 'smooth' })
                }
              } catch (error) {
                console.error('결과 불러오기 에러:', error)
                alert('결과를 불러오는 중 오류가 발생했습니다.')
              }
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            결과 보기
          </button>
          <button
            onClick={() => deleteHistoryItem(item.id)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            삭제
          </button>
        </div>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>추출 항목:</strong>
        <ul style={{ 
          margin: '5px 0',
          paddingLeft: '20px',
          color: '#495057'
        }}>
          {Array.isArray(item.fields) ? (
            item.fields.map((field, index) => (
              <li key={index}>{field.title}: {field.description}</li>
            ))
          ) : (
            <li>추출 항목 정보가 없습니다.</li>
          )}
        </ul>
      </div>
    </div>
  )

  const safeStringify = (obj: any): string => {
    if (typeof obj === 'string') {
      return obj;
    }
    return JSON.stringify(obj);
  };

  const handleExcelDownload = () => {
    try {
      const wb = XLSX.utils.book_new();

      Object.entries(results).forEach(([fileName, result]) => {
        if (result) {
          const stringResult = safeStringify(result);
          const jsonData = JSON.parse(stringResult);

          // 데이터 구조 변환: 배열을 행으로 변환
          const rows = [];
          const keys = Object.keys(jsonData);
          const numRows = jsonData[keys[0]]?.length || 0;

          // 각 행의 데이터 생성
          for (let i = 0; i < numRows; i++) {
            const row = {};
            keys.forEach(key => {
              row[key] = jsonData[key][i] || "정보 없음";
            });
            rows.push(row);
          }

          const ws = XLSX.utils.json_to_sheet(rows);

          // 열 너비 자동 조정
          const colWidths = keys.map(key => ({
            wch: Math.max(
              key.length,
              ...rows.map(row => String(row[key]).length)
            )
          }));
          ws['!cols'] = colWidths;

          XLSX.utils.book_append_sheet(wb, ws, fileName.slice(0, 31));
        }
      });

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, 'extracted_data.xlsx');
    } catch (error) {
      console.error('엑셀 다운로드 에러:', error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('Uploading file:', file.name);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (!response.ok) {
        throw new Error(
          data.details || 
          data.error || 
          `파일 처리 실패 (${response.status}): ${JSON.stringify(data)}`
        );
      }

      setResults(prev => ({
        ...prev,
        [file.name]: data.extractedInfo || '추출된 정보가 없습니다.'
      }));
    } catch (error: any) {
      console.error('Upload error details:', error);
      setResults(prev => ({
        ...prev,
        [file.name]: `오류: ${error.message || '알 수 없는 오류가 발생했습니다.'}`
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <h1 style={{
        textAlign: 'center',
        color: '#333',
        marginBottom: '30px',
        fontSize: '2rem'
      }}>
        PDF Data Extractor
      </h1>
      
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div>
          <label htmlFor="file" style={{ 
            display: 'block', 
            marginBottom: '10px',
            fontWeight: '500',
            color: '#495057'
          }}>
            PDF 파일 선택 (여러 개 선택 가능):
          </label>
          <input
            type="file"
            id="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa'
            }}
          />
          {files.length > 0 && (
            <div style={{ marginTop: '10px', color: '#6c757d' }}>
              선택된 파일: {files.map(f => f.name).join(', ')}
            </div>
          )}
        </div>

        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <label style={{ 
              fontWeight: '500',
              color: '#495057'
            }}>
              추출할 항목 설명:
            </label>
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              템플릿 {showTemplates ? '닫기' : '열기'}
            </button>
          </div>

          {showTemplates && (
            <div style={{
              marginBottom: '15px',
              padding: '15px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="새 템플릿 이름"
                  style={{
                    padding: '8px',
                    marginRight: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    width: '200px'
                  }}
                />
                <button
                  type="button"
                  onClick={saveTemplate}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  현재 항목 저장
                </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gap: '10px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {templates.map(template => (
                  <div
                    key={template.id}
                    style={{
                      padding: '10px',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'white'
                    }}
                  >
                    <div>
                      <strong>{template.name}</strong>
                      <div style={{ fontSize: '0.9em', color: '#6c757d' }}>
                        {template.fields.length}개 항목
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => loadTemplate(template)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
                      >
                        불러오기
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fields.map((field, index) => (
            <div
              key={index}
              style={{
                marginBottom: '15px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}>
                <input
                  type="text"
                  value={field.title}
                  onChange={(e) => updateField(index, { title: e.target.value })}
                  placeholder="항목 이름 (예: 이름, 주소)"
                  style={{
                    width: '48%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  )}
                  {index === fields.length - 1 && (
                    <button
                      type="button"
                      onClick={addField}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      항목 추가
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={field.description}
                onChange={(e) => updateField(index, { description: e.target.value })}
                placeholder="추출 방법 설명 (예: 주민등록증에서 이름을 찾아주세요)"
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={files.length === 0 || fields.every(f => !f.title && !f.description) || isLoading}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: (files.length === 0 || fields.every(f => !f.title && !f.description) || isLoading) ? 0.6 : 1,
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
        >
          {isLoading ? '처리 중...' : '데이터 추출하기'}
        </button>
      </form>

      {Object.keys(results).length > 0 && (
        <div 
          id="results-section"
          style={{ 
            marginTop: '30px',
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ 
              margin: 0,
              color: '#212529',
              fontSize: '1.5rem'
            }}>추출된 데이터</h2>
            <button
              onClick={handleExcelDownload}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              전체 엑셀 다운로드
            </button>
          </div>
          
          {Object.entries(results).map(([fileName, result]) => (
            <div key={fileName} style={{
              marginBottom: '30px',
              padding: '15px',
              border: '1px solid #dee2e6',
              borderRadius: '4px'
            }}>
              <h3 style={{ marginBottom: '15px' }}>{fileName}</h3>
              {result && renderTable(safeStringify(result))}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '30px',
        backgroundColor: 'white',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '15px',
          borderBottom: '1px solid #dee2e6',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0 }}>추출 이력</h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showHistory ? '숨기기' : '보기'}
          </button>
        </div>

        {showHistory && (
          <>
            <div style={{ padding: '15px' }}>
              <input
                type="text"
                placeholder="파일명 또는 설명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px'
                }}
              />
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {filteredHistory.length > 0 ? (
                filteredHistory.map(renderHistoryItem)
              ) : (
                <div style={{ padding: '15px', textAlign: 'center', color: '#6c757d' }}>
                  추출 이력이 없습니다.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App