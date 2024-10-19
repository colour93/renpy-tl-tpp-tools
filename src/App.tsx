import { IconUpload } from "@douyinfe/semi-icons";
import { Button, Form, Layout, Row, Upload } from "@douyinfe/semi-ui";
import React from "react";
import { unzipSync, zipSync } from "fflate";
import * as xlsx from "xlsx";
import { customRequestArgs } from "@douyinfe/semi-ui/lib/es/upload/interface";
import { RenPyTlData } from "types/RenPyTlData";
import FileSaver from "file-saver";
import Section from "@douyinfe/semi-ui/lib/es/form/section";
//[ package ]

const regex = {
  translateStringsGroup:
    /^translate (\w+) strings:(?:\r?\n\r?\n[ 	]+# .+\r?\n[ 	]+old ".*"\r?\n[ 	]+new ".*")+/gm,
  translateStringsItem:
    /^[ 	]+#\s*(.+)\s*\r?\n +old *"(.*)" *\r?\n +new *".*" */gm,
  translateUUIDItem:
    /^# (.+)\r?\ntranslate (\w+) (\w+):(?:\r?\n)+[  ]+#[^"]+"(.*)"\r?\n.+".*"/gm,
  noEncodeQuote: /(?<!\\)"/g,
};

const xlsxHeaders = [
  "Original Text",
  "Initial",
  "Machine translation",
  "Better translation",
  "Best translation",
  "Raw File",
  "RPY File Line",
  "RPY Script Type",
];

//=> Main Component
export default () => {
  const textDecoder = new TextDecoder("utf-8");
  const textEncoder = new TextEncoder();

  const replaceTextInQuotes = (
    text: string,
    lineNumber: number,
    newText: string
  ): string => {
    const lines = text.split("\n");
    const updatedLines = lines.map((line, index) => {
      if (index === lineNumber - 1) {
        return line.replace(/"([^"]*)"/g, `"${newText}"`);
      }
      return line;
    });
    return updatedLines.join("\n");
  };

  const processRawText = (text: string, fileName: string) => {
    let match: RegExpExecArray | null;

    let result: RenPyTlData[] = [];

    while ((match = regex.translateStringsGroup.exec(text)) !== null) {
      const content = match[0];
      const language = match[1];

      let itemMatch: RegExpExecArray | null;

      while ((itemMatch = regex.translateStringsItem.exec(content)) !== null) {
        const item = itemMatch[0];
        const rawFile = itemMatch[1];
        const old = itemMatch[2];
        const charPosition = text.indexOf(item);
        const line = text.substring(0, charPosition).split("\n").length;
        result.push({
          type: "strings",
          language,
          rawFile,
          old,
          line,
        });
      }
    }

    while ((match = regex.translateUUIDItem.exec(text)) !== null) {
      const item = match[0];
      const language = match[2];
      const rawFile = match[1];
      const uuid = match[3];
      const old = match[4];
      const charPosition = text.indexOf(item);
      const line = text.substring(0, charPosition).split("\n").length;
      result.push({
        type: "uuid",
        language,
        rawFile,
        uuid,
        old,
        line,
      });
    }

    const workbook = xlsx.utils.book_new();

    const data = [
      xlsxHeaders,
      ...result.map(({ old, rawFile, line, type }) => [
        old,
        ,
        ,
        ,
        ,
        rawFile,
        line,
        type,
      ]),
    ];

    const worksheet = xlsx.utils.aoa_to_sheet(data);

    xlsx.utils.book_append_sheet(workbook, worksheet, "Worksheet");

    return {
      data: textEncoder.encode(JSON.stringify(result, null, 2)),
      xml: new Uint8Array(
        xlsx.write(workbook, {
          bookType: "xlsx",
          type: "array",
        })
      ),
    };
  };

  const handleRTTFile = ({
    file,
    onProgress,
    onSuccess,
  }: customRequestArgs) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const compressedData = new Uint8Array(e.target.result as ArrayBuffer);

      // 使用 fflate 进行解压缩
      const rawData = unzipSync(compressedData);

      onProgress({
        total: 100,
        loaded: 20,
      });

      // 筛选 rpy
      const rpyFiles = Object.keys(rawData).filter((fileName) =>
        fileName.endsWith(".rpy")
      );

      onProgress({
        total: 100,
        loaded: 25,
      });

      let xmlFiles: any = new Object();
      let jsonFiles: any = new Object();

      // 遍历 rpy
      for (const [index, fileName] of rpyFiles.entries()) {
        const fileData = rawData[fileName];

        const rpyContent = textDecoder.decode(fileData);

        // 处理
        const rpyData = processRawText(rpyContent, fileName);

        onProgress({
          total: 100,
          loaded: 25 + Math.round((index / rpyFiles.length) * 0.55),
        });

        if (rpyData) {
          jsonFiles[fileName + ".json"] = rpyData.data;
          xmlFiles[fileName + ".xlsx"] = rpyData.xml;
        } else {
          break;
        }
      }

      // 打包
      const resultZip = zipSync({
        data: jsonFiles,
        xml: xmlFiles,
        raw: rawData,
      });

      onProgress({
        total: 100,
        loaded: 100,
      });

      // 下载
      FileSaver.saveAs(
        new Blob([resultZip], { type: "application/octet-stream" }),
        `${file.name}-${+new Date()}.zip`
      );

      onSuccess({});
    };

    reader.readAsArrayBuffer(file.fileInstance);
  };

  const processProcessedXlsx = (outputFile: Uint8Array, rawFile: Uint8Array, rpyFile: Uint8Array) => {
    // 读入 rpyFile
    let rpyFileText = textDecoder.decode(rpyFile);

    // 读取输出 xlsx
    const outputWorkbook = xlsx.read(outputFile);
    const outputWorksheet = outputWorkbook.Sheets[outputWorkbook.SheetNames[0]];

    // 读取原始 xlsx
    const rawWorkbook = xlsx.read(rawFile);
    const rawWorksheet = rawWorkbook.Sheets[rawWorkbook.SheetNames[0]];

    // 获取行数
    const range = xlsx.utils.decode_range(outputWorksheet["!ref"]);
    const rowCount = range.e.r - range.s.r + 1;

    // 从第二行开始遍历
    for (let i = 1; i < rowCount; i++) {
      // const rawText = outputWorksheet[xlsx.utils.encode_cell({ r: i, c: 0 })].v;
      const translatedText = (
        outputWorksheet[xlsx.utils.encode_cell({ r: i, c: 1 })]?.v ?? ""
      ).replace(regex.noEncodeQuote, '\\"');
      const row: number | undefined =
        parseInt(rawWorksheet[xlsx.utils.encode_cell({ r: i, c: 6 })]?.v) ??
        undefined;
      const type: "strings" | "uuid" =
        rawWorksheet[xlsx.utils.encode_cell({ r: i, c: 7 })]?.v ?? "strings";
      if (!row) continue;

      rpyFileText = replaceTextInQuotes(
        rpyFileText,
        row + (type === "strings" ? 2 : 4),
        translatedText
      );
    }

    return textEncoder.encode(rpyFileText);
  };

  const handleTTRFile = ({
    file,
    onProgress,
    onSuccess,
  }: customRequestArgs) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const compressedData = new Uint8Array(e.target.result as ArrayBuffer);

      // 解压
      const data = unzipSync(compressedData);

      const outputFilenameList = Object.keys(data).filter(
        (name) => name.startsWith("output") && name.endsWith("xlsx")
      );

      let files: any = new Object();

      outputFilenameList.map((outputFilename, index) => {
        // 原始 xlsx 路径
        const xlsxPath = outputFilename.substring(7, outputFilename.length);

        // rpy 原始路径
        const rpyRawPath = outputFilename.substring(7, outputFilename.length - 5);

        // 处理文件
        const processedRpyFile = processProcessedXlsx(
          data[outputFilename],
          data["xml/" + xlsxPath],
          data["raw/" + rpyRawPath]
        );

        files[rpyRawPath] = processedRpyFile;

        onProgress({ total: outputFilenameList.length, loaded: index + 1 });
      });

      // 打包
      const resultZip = zipSync(files);

      // 下载
      FileSaver.saveAs(
        new Blob([resultZip], { type: "application/octet-stream" }),
        `${file.name}-finished-${+new Date()}.zip`
      );

      onSuccess({});
    };

    reader.readAsArrayBuffer(file.fileInstance);
  };

  return (
    <Layout>
      <Form layout="horizontal">
        <Section text={"RenPy-Tl 转 Translator++"}>
          <Row>主要用于使用其他兼容 Translator++ 格式的翻译工具</Row>
          <Row>
            <Upload customRequest={handleRTTFile}>
              <Button icon={<IconUpload />} theme="light">
                选择 tl 的 zip 压缩包 (请确保不是父文件夹)
              </Button>
            </Upload>
          </Row>
        </Section>
        <Section text={"Translator++ 转 RenPy-Tl"}>
          <Row>
            <Upload customRequest={handleTTRFile}>
              <Button icon={<IconUpload />} theme="light">
                选择已转换且已翻译的 zip 压缩包
              </Button>
            </Upload>
          </Row>
        </Section>
      </Form>
    </Layout>
  );
};
