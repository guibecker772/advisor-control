declare module 'papaparse' {
  export interface ParseError {
    message: string;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
  }

  export interface ParseConfig {
    delimiter?: string;
    skipEmptyLines?: boolean | 'greedy';
  }

  interface PapaStatic {
    parse<T>(input: string, config?: ParseConfig): ParseResult<T>;
  }

  const Papa: PapaStatic;
  export default Papa;
}
