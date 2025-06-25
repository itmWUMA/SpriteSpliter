import React, { useState, useEffect, useRef } from 'react';
import { Upload, message, Typography, Layout, Radio, InputNumber, Input, Space, Button, Divider } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';

const { Dragger } = Upload;
const { Title, Text } = Typography;
const { Header, Content, Footer } = Layout;

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  name: string;
}

type SplitMode = 'size' | 'count';

const App: React.FC = () => {
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [rows, setRows] = useState<number | null>(null);
  const [cols, setCols] = useState<number | null>(null);
  const [fileNamePrefix, setFileNamePrefix] = useState<string>('');
  const [totalFrames, setTotalFrames] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (imageInfo) {
      const nameWithoutExtension = imageInfo.name.split('.').slice(0, -1).join('.');
      setFileNamePrefix(nameWithoutExtension);
    }
  }, [imageInfo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageInfo) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.src = imageInfo.url;
    img.onload = () => {
      canvas.width = imageInfo.width;
      canvas.height = imageInfo.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      let currentFrameWidth = 0;
      let currentFrameHeight = 0;
      let numRows = 0;
      let numCols = 0;

      if (splitMode === 'size' && frameWidth && frameHeight) {
        currentFrameWidth = frameWidth;
        currentFrameHeight = frameHeight;
        numCols = Math.floor(imageInfo.width / currentFrameWidth);
        numRows = Math.floor(imageInfo.height / currentFrameHeight);
      } else if (splitMode === 'count' && rows && cols) {
        numRows = rows;
        numCols = cols;
        currentFrameWidth = Math.floor(imageInfo.width / numCols);
        currentFrameHeight = Math.floor(imageInfo.height / numRows);
      }

      setTotalFrames(numRows * numCols);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Red, semi-transparent
      ctx.lineWidth = 1;

      for (let i = 1; i < numCols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * currentFrameWidth, 0);
        ctx.lineTo(i * currentFrameWidth, canvas.height);
        ctx.stroke();
      }

      for (let i = 1; i < numRows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * currentFrameHeight);
        ctx.lineTo(canvas.width, i * currentFrameHeight);
        ctx.stroke();
      }
    };
  }, [imageInfo, splitMode, frameWidth, frameHeight, rows, cols]);

  const props = {
    name: 'file',
    multiple: false,
    beforeUpload: (file: File) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error(`${file.name} is not an image file`);
      }
      return isImage || Upload.LIST_IGNORE;
    },
    customRequest: (options: any) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new window.Image();
        img.src = e.target.result;
        img.onload = () => {
          setImageInfo({
            url: e.target.result,
            width: img.width,
            height: img.height,
            name: options.file.name,
          });
          setFrameWidth(null);
          setFrameHeight(null);
          setRows(null);
          setCols(null);
        };
      };
      reader.readAsDataURL(options.file);
    },
    onRemove: () => {
      setImageInfo(null);
      setFrameWidth(null);
      setFrameHeight(null);
      setRows(null);
      setCols(null);
      setFileNamePrefix('');
      setTotalFrames(0);
    },
  };

  const handleSplit = async () => {
    if (!imageInfo || !canvasRef.current) {
      message.error('请先上传图片并设置切割参数！');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      message.error('无法创建Canvas上下文！');
      return;
    }

    const img = new window.Image();
    img.src = imageInfo.url;
    await new Promise(resolve => img.onload = resolve);

    let currentFrameWidth = 0;
    let currentFrameHeight = 0;
    let numRows = 0;
    let numCols = 0;

    if (splitMode === 'size' && frameWidth && frameHeight) {
      currentFrameWidth = frameWidth;
      currentFrameHeight = frameHeight;
      numCols = Math.floor(imageInfo.width / currentFrameWidth);
      numRows = Math.floor(imageInfo.height / currentFrameHeight);
    } else if (splitMode === 'count' && rows && cols) {
      numRows = rows;
      numCols = cols;
      currentFrameWidth = Math.floor(imageInfo.width / numCols);
      currentFrameHeight = Math.floor(imageInfo.height / numRows);
    } else {
      message.error('切割参数不完整或无效！');
      return;
    }

    const zip = new JSZip();
    const padLength = String(totalFrames - 1).length;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const x = c * currentFrameWidth;
        const y = r * currentFrameHeight;

        canvas.width = currentFrameWidth;
        canvas.height = currentFrameHeight;
        ctx.clearRect(0, 0, currentFrameWidth, currentFrameHeight);
        ctx.drawImage(img, x, y, currentFrameWidth, currentFrameHeight, 0, 0, currentFrameWidth, currentFrameHeight);

        const frameIndex = r * numCols + c;
        const paddedIndex = String(frameIndex).padStart(padLength, '0');
        const fileName = `${fileNamePrefix}_${paddedIndex}.png`;

        const blob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, 'image/png');
        });

        if (blob) {
          zip.file(fileName, blob);
        }
      }
    }

    zip.generateAsync({ type: 'blob' })
      .then(function (content) {
        saveAs(content, `${fileNamePrefix}.zip`);
        message.success('切割完成，文件已下载！');
      })
      .catch(err => {
        message.error('打包文件失败！');
        console.error(err);
      });
  };

  const isSplitButtonDisabled = () => {
    if (!imageInfo) return true;

    if (splitMode === 'size') {
      return !frameWidth || !frameHeight ||
             imageInfo.width % (frameWidth || 1) !== 0 ||
             imageInfo.height % (frameHeight || 1) !== 0;
    } else { // splitMode === 'count'
      return !rows || !cols ||
             imageInfo.width % (cols || 1) !== 0 ||
             imageInfo.height % (rows || 1) !== 0;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: 0, textAlign: 'center' }}>
        <Title level={2} style={{ margin: '16px 0', color: 'white' }}>Sprite Spliter</Title>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div style={{ background: '#fff', padding: 24, minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!imageInfo ? (
            <Dragger {...props}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单张图片上传，支持 PNG, JPG, BMP, WEBP 格式。
              </p>
            </Dragger>
          ) : (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', border: '1px solid #eee' }} />
              <Text strong>{`原始尺寸: ${imageInfo.width} x ${imageInfo.height}`}</Text>
              {totalFrames > 0 && <Text type="success">{`将生成 ${totalFrames} 张切片`}</Text>}

              <Divider>切割设置</Divider>
              <Radio.Group onChange={(e) => setSplitMode(e.target.value)} value={splitMode} style={{ marginBottom: 20 }}>
                <Radio.Button value="size">按尺寸切割</Radio.Button>
                <Radio.Button value="count">按数量切割</Radio.Button>
              </Radio.Group>

              {splitMode === 'size' ? (
                <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: '300px' }}>
                  <InputNumber
                    placeholder="单帧宽度 (px)"
                    min={1}
                    style={{ width: '100%' }}
                    value={frameWidth}
                    onChange={setFrameWidth}
                    status={imageInfo.width % (frameWidth || 1) !== 0 && frameWidth !== null ? 'error' : ''}
                  />
                  {imageInfo.width % (frameWidth || 1) !== 0 && frameWidth !== null && <Text type="danger">宽度无法整除！</Text>}
                  <InputNumber
                    placeholder="单帧高度 (px)"
                    min={1}
                    style={{ width: '100%' }}
                    value={frameHeight}
                    onChange={setFrameHeight}
                    status={imageInfo.height % (frameHeight || 1) !== 0 && frameHeight !== null ? 'error' : ''}
                  />
                  {imageInfo.height % (frameHeight || 1) !== 0 && frameHeight !== null && <Text type="danger">高度无法整除！</Text>}
                </Space>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: '300px' }}>
                  <InputNumber
                    placeholder="行数"
                    min={1}
                    style={{ width: '100%' }}
                    value={rows}
                    onChange={setRows}
                    status={imageInfo.height % (rows || 1) !== 0 && rows !== null ? 'error' : ''}
                  />
                  {imageInfo.height % (rows || 1) !== 0 && rows !== null && <Text type="danger">行数无法整除！</Text>}
                  <InputNumber
                    placeholder="列数"
                    min={1}
                    style={{ width: '100%' }}
                    value={cols}
                    onChange={setCols}
                    status={imageInfo.width % (cols || 1) !== 0 && cols !== null ? 'error' : ''}
                  />
                  {imageInfo.width % (cols || 1) !== 0 && cols !== null && <Text type="danger">列数无法整除！</Text>}
                </Space>
              )}

              <Divider>输出设置</Divider>
              <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: '300px' }}>
                <Input
                  placeholder="文件名前缀"
                  value={fileNamePrefix}
                  onChange={(e) => setFileNamePrefix(e.target.value)}
                  style={{ width: '100%' }}
                />
                <Button
                  type="primary"
                  onClick={handleSplit}
                  disabled={isSplitButtonDisabled()}
                  style={{ width: '100%' }}
                >
                  开始切割
                </Button>
              </Space>
            </div>
          )}
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Sprite Spliter ©2025 Created by itmwuma</Footer>
    </Layout>
  );
};

export default App;
