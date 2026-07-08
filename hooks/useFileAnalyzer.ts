import { useState } from "react";
import * as XLSX from "xlsx";

export interface AnalyzedColumn {
  name: string;
  type: "texto" | "numero" | "moeda" | "percentual" | "data";
  sampleValues: (string | number)[];
}

export interface AnalyzedFile {
  fileName: string;
  sheetName: string;
  rowCount: number;
  columns: AnalyzedColumn[];
  sampleData: Record<string, any>[];
  allData: Record<string, any>[];
}

export function useFileAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeFile = async (file: File): Promise<AnalyzedFile | null> => {
    setAnalyzing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      // Usar a primeira aba
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError("Arquivo não contém abas");
        return null;
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError("Aba não contém dados");
        return null;
      }

      // Analisar colunas
      const firstRow = jsonData[0] as Record<string, any>;
      const columns: AnalyzedColumn[] = Object.keys(firstRow).map((colName) => {
        const values = jsonData.map((row: any) => row[colName]).filter(v => v !== null && v !== undefined);
        const sampleValues = values.slice(0, 3);

        // Detectar tipo
        let type: AnalyzedColumn["type"] = "texto";
        if (values.length > 0) {
          const allNumbers = values.every(v => !isNaN(Number(v)));
          const allPercents = values.every(v => String(v).includes("%"));
          const allMoney = values.every(v => String(v).includes("R$") || String(v).includes("$"));
          const allDates = values.every(v => !isNaN(new Date(v).getTime()));

          if (allMoney) type = "moeda";
          else if (allPercents) type = "percentual";
          else if (allDates && !allNumbers) type = "data";
          else if (allNumbers) type = "numero";
        }

        return {
          name: colName,
          type,
          sampleValues: sampleValues as (string | number)[],
        };
      });

      const result: AnalyzedFile = {
        fileName: file.name,
        sheetName,
        rowCount: jsonData.length,
        columns,
        sampleData: jsonData.slice(0, 5) as Record<string, any>[],
        allData: jsonData as Record<string, any>[],
      };

      setAnalyzing(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao analisar arquivo";
      setError(message);
      setAnalyzing(false);
      return null;
    }
  };

  return { analyzeFile, analyzing, error };
}
