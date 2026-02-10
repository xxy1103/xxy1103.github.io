// Remark 插件：自动将 Hexo 相对图片路径转换为 Astro 绝对路径
// 支持 image/xxx/ 和 /image/xxx/ 两种格式

import { visit } from 'unist-util-visit';

export function remarkHexoImages() {
    return (tree) => {
        visit(tree, 'image', (node) => {
            // 如果图片路径以 image/ 开头（不是 /image/），则添加前导斜杠
            if (node.url && node.url.startsWith('image/') && !node.url.startsWith('/image/')) {
                node.url = '/' + node.url;
            }
        });
    };
}

export default remarkHexoImages;
