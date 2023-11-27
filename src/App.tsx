import { IconUpload } from "@douyinfe/semi-icons";
import { Button, Upload } from "@douyinfe/semi-ui";
import React, { useState } from "react";
import { unzipSync, zipSync } from "fflate";
import * as xlsx from "xlsx";
import { customRequestArgs } from "@douyinfe/semi-ui/lib/es/upload/interface";
import { RenPyTlData } from "types/RenPyTlData";
import FileSaver from "file-saver";
//[ package ]

const regex = {
  translateStringsGroup:
    /^translate (\w+) strings:(?:\r?\n(?:(?:^ *$)|(?:^ +.+$)))+/gm,
  translateStringsItem:
    /^[ 	]+#\s*(\S+)\s*\r?\n +old *"(.*)" *\r?\n +new *".*" */gm,
  translateUUIDItem:
    /^# (\S+)\r?\ntranslate (\w+) (\w+):(?:\r?\n)+[  ]+# "(.*)"\r?\n[    ]+".*"/gm,
};

const xlsxHeaders = [
  "Original Text",
  "Initial",
  "Machine translation",
  "Better translation",
  "Best translation",
];

//=> Main Component
export default () => {
  const processRawText = (text: string, fileName: string) => {
    let match: RegExpExecArray | null;

    let result: RenPyTlData;

    if ((match = regex.translateStringsGroup.exec(text)) !== null) {
      const content = match[0];
      const language = match[1];

      result = {
        type: "strings",
        file: fileName,
        language,
        data: [],
      };

      let itemMatch;

      while ((itemMatch = regex.translateStringsItem.exec(content)) !== null) {
        const item = itemMatch[0];
        const rawFile = itemMatch[1];
        const old = itemMatch[2];
        result.data.push({
          rawFile,
          old,
        });
      }
    } else {
      if ((match = regex.translateUUIDItem.exec(text)) !== null) {
        const language = match[2];
        const rawFile = match[1];
        const uuid = match[3];
        const old = match[4];

        result = {
          type: "uuid",
          file: fileName,
          language,
          data: [
            {
              rawFile,
              uuid,
              old,
            },
          ],
        };

        while ((match = regex.translateUUIDItem.exec(text)) !== null) {
          const rawFile = match[1];
          const uuid = match[3];
          const old = match[4];

          result.data.push({
            rawFile,
            uuid,
            old,
          });
        }
      } else {
        return;
      }
    }

    const workbook = xlsx.utils.book_new();

    const data = [
      [
        "Original Text",
        "Initial",
        "Machine translation",
        "Better translation",
        "Best translation",
      ],
      ...result.data.map(({ old }) => [old]),
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

  const handleSelectFile = ({
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
    <>
      <Upload customRequest={handleSelectFile}>
        <Button icon={<IconUpload />} theme="light">
          选择压缩包
        </Button>
      </Upload>
    </>
  );
};
