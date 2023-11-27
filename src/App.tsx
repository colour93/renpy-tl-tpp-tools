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
    /^translate (\w+) strings:(?:\r?\n\r?\n[ 	]+# \S+\r?\n[ 	]+old ".*"\r?\n[ 	]+new ".*")+/gm,
  translateStringsItem:
    /^[ 	]+#\s*(\S+)\s*\r?\n +old *"(.*)" *\r?\n +new *".*" */gm,
  translateUUIDItem:
    /^# (\S+)\r?\ntranslate (\w+) (\w+):(?:\r?\n)+[  ]+#.+"(.*)"\r?\n.+".*"/gm,
};

const xlsxHeaders = [
  "Original Text",
  "Initial",
  "Machine translation",
  "Better translation",
  "Best translation",
  "Raw File",
];

//=> Main Component
export default () => {
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
        result.push({
          type: "strings",
          language,
          rawFile,
          old,
        });
      }
    }

    while ((match = regex.translateUUIDItem.exec(text)) !== null) {
      const language = match[2];
      const rawFile = match[1];
      const uuid = match[3];
      const old = match[4];

      result.push({
        type: "uuid",
        language,
        rawFile,
        uuid,
        old,
      });
    }

    const workbook = xlsx.utils.book_new();

    const data = [
      xlsxHeaders,
      ...result.map(({ old, rawFile }) => [old, , , , , rawFile]),
    ];

    const worksheet = xlsx.utils.aoa_to_sheet(data);

    xlsx.utils.book_append_sheet(workbook, worksheet, "Worksheet");

    return {
      data: new TextEncoder().encode(JSON.stringify(result, null, 2)),
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
    onError,
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

      const textDecoder = new TextDecoder("utf-8");

      const rpyFiles = Object.keys(rawData).filter((fileName) =>
        fileName.endsWith(".rpy")
      );

      onProgress({
        total: 100,
        loaded: 25,
      });

      let xmlFiles: any = new Object();
      let jsonFiles: any = new Object();

      for (const [index, fileName] of rpyFiles.entries()) {
        const fileData = rawData[fileName];

        const rpyContent = textDecoder.decode(fileData);

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

      const resultZip = zipSync({
        data: jsonFiles,
        xml: xmlFiles,
        raw: rawData,
      });

      onProgress({
        total: 100,
        loaded: 100,
      });

      FileSaver.saveAs(
        new Blob([resultZip], { type: "application/octet-stream" }),
        `${file.name}-${+new Date()}.zip`
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
            <Upload>
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
