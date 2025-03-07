const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// 处理单个图片文件
async function processImage(filePath, quality) {
  // 检查是否是图片文件且不是已经处理过的低质量图片
  const file = path.basename(filePath);
  const fileExt = path.extname(file);
  const fileName = path.basename(file, fileExt);

  if (
    (fileExt.toLowerCase() === ".jpg" ||
      fileExt.toLowerCase() === ".jpeg" ||
      fileExt.toLowerCase() === ".png") &&
    !fileName.includes("_low")
  ) {
    const dirPath = path.dirname(filePath);
    const lowQualityPath = path.join(dirPath, `${fileName}_low${fileExt}`);

    // 如果低质量版本不存在，则创建
    if (!fs.existsSync(lowQualityPath)) {
      console.log(`处理: ${filePath}`);

      try {
        await sharp(filePath).jpeg({ quality: quality }).toFile(lowQualityPath);

        console.log(`✅ 已创建: ${lowQualityPath}`);
      } catch (error) {
        console.error(`❌ 处理失败: ${filePath}`, error);
      }
    }
  }
}

// 递归遍历目录并处理所有图片
async function processDirectory(directoryPath, quality = 10, recursive = true) {
  // 检查目录是否存在
  if (!fs.existsSync(directoryPath)) {
    console.error(`❌ 错误: 目录 '${directoryPath}' 不存在`);
    return;
  }

  console.log(`📂 正在处理目录: ${directoryPath}`);

  try {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

    // 处理当前目录中的所有文件和子目录
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory() && recursive) {
        // 如果是目录并且启用了递归，则处理子目录
        await processDirectory(fullPath, quality, recursive);
      } else if (entry.isFile()) {
        // 如果是文件，则处理图片
        await processImage(fullPath, quality);
      }
    }

    console.log(`✅ 目录处理完成: ${directoryPath}`);
  } catch (error) {
    console.error(`❌ 处理目录失败: ${directoryPath}`, error);
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

  await processDirectory(directory, quality, recursive);
}

// 执行主函数
main().catch((error) => {
  console.error("❌ 程序执行错误:", error);
  process.exit(1);
});
