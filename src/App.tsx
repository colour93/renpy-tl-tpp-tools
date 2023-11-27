import { IconUpload } from "@douyinfe/semi-icons";
import { Button, Upload } from "@douyinfe/semi-ui";
import React, { useState } from "react";
import { unzip } from "fflate";
import { customRequestArgs } from "@douyinfe/semi-ui/lib/es/upload/interface";
//[ package ]

//=> Main Component
export default () => {

  const processRawText = () => {

  }

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
      unzip(compressedData, (err, data) => {
        
        console.log(data)

      });
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
