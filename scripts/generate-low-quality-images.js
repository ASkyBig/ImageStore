const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const util = require("util");

// 设置sharp的缓存内存限制
sharp.cache(false);
sharp.concurrency(1);

// 处理单个图片文件
async function processImage(filePath, quality) {
  // 检查是否是图片文件且不是已经处理过的低质量图片
  const file = path.basename(filePath);
  const fileExt = path.extname(file).toLowerCase();
  const fileName = path.basename(file, path.extname(file)); // 使用原始扩展名获取文件名

  // 增强检测逻辑，确保跳过已处理的图片
  if (fileName.toLowerCase().includes("_low")) {
    console.log(`⏭️ 跳过已处理的图片: ${filePath}`);
    return;
  }

  if (
    fileExt === ".jpg" ||
    fileExt === ".jpeg" ||
    fileExt === ".png" ||
    fileExt === ".heic"
  ) {
    const dirPath = path.dirname(filePath);

    // 定义输出文件路径 - 修正命名格式
    // 非HEIC文件不再生成低质量原格式版本
    const highQualityWebpPath = path.join(dirPath, `${fileName}.webp`);
    const lowQualityWebpPath = path.join(dirPath, `${fileName}_low.webp`);

    // 检查是否已经存在WebP版本 (不区分大小写)
    const dirFiles = fs.readdirSync(dirPath);
    const highQualityWebpExists = dirFiles.some(
      (f) =>
        f.toLowerCase() === path.basename(highQualityWebpPath).toLowerCase()
    );
    const lowQualityWebpExists = dirFiles.some(
      (f) => f.toLowerCase() === path.basename(lowQualityWebpPath).toLowerCase()
    );

    console.log(`处理: ${filePath}`);

    try {
      // 读取原始文件
      const buffer = fs.readFileSync(filePath);
      const originalSize = buffer.length;

      // 根据文件类型决定处理方式
      if (fileExt === ".heic") {
        // HEIC处理: 创建高质量和低质量WebP
        try {
          console.log(`🔄 处理HEIC文件: ${filePath}`);

          // 转换HEIC为JPEG缓冲区
          const jpegBuffer = await heicConvert({
            buffer: buffer,
            format: "JPEG",
            quality: 90, // 高质量转换
          });

          // 获取图像信息
          let imageInfo;
          try {
            imageInfo = await sharp(jpegBuffer).metadata();
          } catch (error) {
            console.log(`无法读取图像信息: ${error.message}`);
            imageInfo = { width: 3000, height: 2000 }; // 默认假设值
          }

          // 1. 创建高质量WebP (如果不存在)
          if (!highQualityWebpExists) {
            // 使用高质量设置创建WebP
            await sharp(jpegBuffer)
              .webp({
                quality: 85,
                lossless: false,
              })
              .toFile(highQualityWebpPath);

            const highQualityWebpSize = fs.statSync(highQualityWebpPath).size;
            console.log(
              `✅ 已创建高质量WebP: ${highQualityWebpPath} (${originalSize} -> ${highQualityWebpSize} 字节，节省 ${Math.round(
                ((originalSize - highQualityWebpSize) / originalSize) * 100
              )}%)`
            );
          } else {
            console.log(`⏭️ 已存在高质量WebP版本: ${highQualityWebpPath}`);
          }

          // 2. 创建低质量WebP (如果不存在)
          if (!lowQualityWebpExists) {
            // 计算低质量WebP的尺寸 - 如果原图较大，则缩小
            let resizeOptions = {};
            if (imageInfo.width > 1000 || imageInfo.height > 1000) {
              resizeOptions = {
                width: Math.round(imageInfo.width * 0.7),
                height: Math.round(imageInfo.height * 0.7),
                fit: "inside",
              };
            }

            // 创建低质量WebP
            await sharp(jpegBuffer)
              .resize(resizeOptions)
              .webp({
                quality: quality,
                lossless: false,
              })
              .toFile(lowQualityWebpPath);

            const lowQualityWebpSize = fs.statSync(lowQualityWebpPath).size;
            console.log(
              `✅ 已创建低质量WebP: ${lowQualityWebpPath} (${originalSize} -> ${lowQualityWebpSize} 字节，节省 ${Math.round(
                ((originalSize - lowQualityWebpSize) / originalSize) * 100
              )}%)`
            );
          } else {
            console.log(`⏭️ 已存在低质量WebP版本: ${lowQualityWebpPath}`);
          }
        } catch (heicError) {
          console.error(`❌ HEIC处理失败: ${filePath}`, heicError.message);
        }
      } else {
        // 处理常规图片格式 (JPG, PNG) - 只创建低质量WebP版本
        try {
          // 只创建低质量WebP版本 (如果不存在)
          if (!lowQualityWebpExists) {
            let webpPipeline = sharp(buffer, { failOn: "none" });

            // 获取图像信息
            const imageInfo = await webpPipeline.metadata();

            // 如果图像较大，适当缩小
            if (imageInfo.width > 1200 || imageInfo.height > 1200) {
              webpPipeline = webpPipeline.resize({
                width: Math.round(imageInfo.width * 0.8),
                height: Math.round(imageInfo.height * 0.8),
                fit: "inside",
              });
            }

            // 创建WebP格式
            await webpPipeline
              .webp({
                quality: quality,
                lossless: false,
              })
              .toFile(lowQualityWebpPath);

            // 检查处理后的文件大小
            const webpCompressedSize = fs.statSync(lowQualityWebpPath).size;
            console.log(
              `✅ 已创建低质量WebP: ${lowQualityWebpPath} (${originalSize} -> ${webpCompressedSize} 字节，节省 ${Math.round(
                ((originalSize - webpCompressedSize) / originalSize) * 100
              )}%)`
            );
          } else {
            console.log(`⏭️ 已存在低质量WebP版本: ${lowQualityWebpPath}`);
          }
        } catch (sharpError) {
          console.error(`❌ Sharp处理失败: ${filePath}`, sharpError.message);
        }
      }

      // 手动清理
      if (global.gc) global.gc();
    } catch (error) {
      console.error(`❌ 处理失败: ${filePath}`, error.message);
    }
  }
}

// 递归遍历目录并处理所有图片
async function processDirectory(
  directoryPath,
  quality = 40,
  recursive = true,
  currentDepth = 0
) {
  // 限制递归深度，防止栈溢出
  const MAX_DEPTH = 20;
  if (currentDepth > MAX_DEPTH) {
    console.warn(
      `⚠️ 目录 '${directoryPath}' 超过最大递归深度 ${MAX_DEPTH}，跳过处理`
    );
    return;
  }

  // 检查目录是否存在
  if (!fs.existsSync(directoryPath)) {
    console.error(`❌ 错误: 目录 '${directoryPath}' 不存在`);
    return;
  }

  console.log(`📂 正在处理目录: ${directoryPath}`);

  try {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

    // 分批处理文件，防止一次性加载太多
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      // 处理当前批次的文件
      for (const entry of batch) {
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory() && recursive) {
          // 如果是目录并且启用了递归，则处理子目录
          await processDirectory(
            fullPath,
            quality,
            recursive,
            currentDepth + 1
          );
        } else if (entry.isFile()) {
          // 如果是文件，则处理图片
          await processImage(fullPath, quality);
        }
      }

      // 手动触发垃圾回收
      if (global.gc) global.gc();
    }

    console.log(`✅ 目录处理完成: ${directoryPath}`);
  } catch (error) {
    console.error(`❌ 处理目录失败: ${directoryPath}`, error.message);
  }
}

// 从命令行获取参数
function parseArgs() {
  const args = process.argv.slice(2);
  let directory = null;
  let quality = 40;
  let recursive = true; // 默认启用递归处理

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" || args[i] === "-d") {
      directory = args[i + 1];
      i++;
    } else if (args[i] === "--quality" || args[i] === "-q") {
      quality = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--no-recursive" || args[i] === "-nr") {
      recursive = false;
    } else if (!directory) {
      // 如果没有指定--dir但提供了路径
      directory = args[i];
    }
  }

  return { directory, quality, recursive };
}

// 主函数
async function main() {
  try {
    const { directory, quality, recursive } = parseArgs();

    if (!directory) {
      console.error("❌ 错误: 请指定图片目录。");
      console.log(
        "用法: node generate-low-quality-images.js --dir 图片目录路径 [--quality 压缩质量(1-100)] [--no-recursive]"
      );
      console.log(
        "简写: node generate-low-quality-images.js 图片目录路径 [-q 压缩质量] [-nr]"
      );
      process.exit(1);
    }

    console.log(`🔧 压缩质量设置为: ${quality}`);
    console.log(`🔍 递归处理子目录: ${recursive ? "是" : "否"}`);
    console.log(`🖼️ 支持的图片格式: JPG, JPEG, PNG, HEIC`);
    console.log(
      `🖌️ 输出格式: 非HEIC图片只生成WebP低质量版本；HEIC图片生成高质量WebP和低质量WebP`
    );

    await processDirectory(directory, quality, recursive);
    console.log("🎉 所有处理已完成");
  } catch (error) {
    console.error("❌ 程序执行错误:", error.message);
    process.exit(1);
  }
}

// 执行主函数
main().catch((error) => {
  console.error("❌ 未捕获的错误:", error.message);
  process.exit(1);
});
