export interface RenPyTlData {
  type: "strings" | "uuid";
  file: string;
  language: string;
  data: RenPyTlItem[];
}

export interface RenPyTlItem {
  rawFile: string;
  uuid?: string;
  old: string;
  new?: string;
}
