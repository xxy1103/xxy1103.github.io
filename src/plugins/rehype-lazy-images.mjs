// Rehype 插件：为所有图片添加 loading="lazy" 属性实现懒加载
// 使用浏览器原生懒加载机制，无需额外 JavaScript

import { visit } from 'unist-util-visit';

export function rehypeLazyImages() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            // 只处理 img 元素
            if (node.tagName === 'img') {
                // 添加 loading="lazy" 属性
                node.properties = node.properties || {};
                node.properties.loading = 'lazy';
                
                // 可选：添加 decoding="async" 以进一步优化性能
                node.properties.decoding = 'async';
            }
        });
    };
}

export default rehypeLazyImages;
