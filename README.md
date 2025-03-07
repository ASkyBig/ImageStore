# ImageStore

for all images

- https://askybig.github.io/ImageStore/<resourcePath\>

### 压缩图片

npm run gen -- life

# 使用 npm 脚本传递参数时需要使用 -- 分隔

npm run gen -- life -q 30

# 如果不想递归处理子目录，可以添加 -nr 参数

npm run gen -- life -nr

# 完整参数形式

npm run gen -- --dir life --quality 30 --no-recursive
