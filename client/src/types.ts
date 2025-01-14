export interface Field {
  id: string;
  title: string;
  description: string;
  value?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  fields: Field[];
  result: string;
}

export interface ExtractedData {
  [key: string]: string[];
}

export interface JSX {
  IntrinsicElements: {
    [elemName: string]: any;
  };
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
} 