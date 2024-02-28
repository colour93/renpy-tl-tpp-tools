export interface RenPyTlData {
  type: "strings" | "uuid";
  language: string;
  rawFile: string;
  uuid?: string;
  old: string;
  new?: string;
  line: number;
}
