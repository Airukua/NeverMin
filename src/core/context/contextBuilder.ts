import { CodeChunk } from '../../types';
import { extractSymbols } from '../parser/astParser';
import { chunkBySymbol, selectRelevantChunks } from './chunker';

const DEFAULT_MAX_TOKENS_PER_CHUNK = 800;
const DEFAULT_RETRIEVAL_BUDGET = 2400;

/**
 * Bangun context dari file dengan alur simbol-aware:
 * 1. ekstrak symbol dari AST parser
 * 2. chunk file berdasarkan symbol
 * 3. pilih chunk paling relevan untuk query/selection jika ada
 */
export async function buildContextFromFile(
  filePath: string,
  fileContent: string,
  query = ''
): Promise<CodeChunk[]> {
  const symbols = await extractSymbols(filePath, fileContent);
  const chunks = chunkBySymbol(filePath, fileContent, symbols, {
    maxTokensPerChunk: DEFAULT_MAX_TOKENS_PER_CHUNK
  });

  if (!query.trim()) {
    return chunks;
  }

  return selectRelevantChunks(query, chunks, DEFAULT_RETRIEVAL_BUDGET, {
    queryVariants: [query]
  });
}
