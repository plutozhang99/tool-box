#!/usr/bin/env python3
"""
Logo内容大小调整工具
将源图片的logo内容大小调整成与目标图片一致

用法:
    # 基本用法（覆盖源文件）
    python3 adjust_logo_tool.py 目标图片.png 源图片.png

    # 指定输出文件
    python3 adjust_logo_tool.py logo.png logo-full-white.png logo-adjusted.png

示例:
    python3 adjust_logo_tool.py logo.png logo-full-white.png logo-full-white-adjusted.png
    如果不指定输出图片，会覆盖源图片

功能说明:
    支持格式:PNG、JPEG、JPG、WEBP
    自动检测 logo 内容边界（去除透明/空白区域）
    将源图片的 logo 内容大小调整为与目标图片一致
    保持宽高比
    输出图片尺寸与目标图片相同

依赖:
    pip install Pillow
"""

from PIL import Image
import sys
import os

ALLOWED_FORMATS = ['PNG', 'JPEG', 'JPG', 'WEBP']

def get_content_bbox(img):
    """检测图片中非透明/非空白内容的边界框"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    alpha = img.split()[3]
    bbox = alpha.getbbox()
    
    if bbox is None:
        return (0, 0, img.width, img.height)
    
    return bbox

def get_content_size(img):
    """获取logo内容的实际大小（去除空白后）"""
    bbox = get_content_bbox(img)
    return (bbox[2] - bbox[0], bbox[3] - bbox[1])

def check_format(filepath):
    """检查文件格式是否支持"""
    ext = os.path.splitext(filepath)[1].upper().lstrip('.')
    if ext not in ALLOWED_FORMATS:
        print(f"错误: 不支持的文件格式 '{ext}'")
        print(f"支持的格式: {', '.join(ALLOWED_FORMATS)}")
        return False
    return True

def adjust_logo(target_path, source_path, output_path=None):
    """调整源图片使其logo内容大小与目标图片一致"""
    
    # 检查文件格式
    if not check_format(target_path) or not check_format(source_path):
        return False
    
    if output_path and not check_format(output_path):
        return False
    
    # 如果没有指定输出路径，覆盖源文件
    if output_path is None:
        output_path = source_path
    
    if not os.path.exists(target_path):
        print(f"错误: 找不到目标图片 {target_path}")
        return False
    
    if not os.path.exists(source_path):
        print(f"错误: 找不到源图片 {source_path}")
        return False
    
    # 打开图片
    target_img = Image.open(target_path)
    source_img = Image.open(source_path)
    
    # 转换为RGBA模式
    if target_img.mode != 'RGBA':
        target_img = target_img.convert('RGBA')
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')
    
    # 获取内容边界框
    target_bbox = get_content_bbox(target_img)
    source_bbox = get_content_bbox(source_img)
    
    # 获取内容大小
    target_content_size = get_content_size(target_img)
    source_content_size = get_content_size(source_img)
    
    print(f"目标图片 ({target_path}):")
    print(f"  内容边界: {target_bbox}")
    print(f"  内容大小: {target_content_size[0]}x{target_content_size[1]}")
    print(f"\n源图片 ({source_path}):")
    print(f"  内容边界: {source_bbox}")
    print(f"  内容大小: {source_content_size[0]}x{source_content_size[1]}")
    
    # 裁剪源图片到内容边界
    source_cropped = source_img.crop(source_bbox)
    
    # 计算缩放比例
    scale_x = target_content_size[0] / source_content_size[0]
    scale_y = target_content_size[1] / source_content_size[1]
    scale = min(scale_x, scale_y)  # 保持宽高比
    
    print(f"\n缩放比例: {scale:.4f}")
    
    # 缩放裁剪后的图片
    new_width = int(source_content_size[0] * scale)
    new_height = int(source_content_size[1] * scale)
    
    source_resized = source_cropped.resize(
        (new_width, new_height), 
        Image.Resampling.LANCZOS
    )
    
    # 创建新画布，大小与目标图片相同
    new_img = Image.new('RGBA', target_img.size, (0, 0, 0, 0))
    
    # 计算居中位置（基于目标图片的内容位置）
    target_content_x = target_bbox[0]
    target_content_y = target_bbox[1]
    
    paste_x = target_content_x + (target_content_size[0] - new_width) // 2
    paste_y = target_content_y + (target_content_size[1] - new_height) // 2
    
    # 粘贴调整后的logo
    new_img.paste(source_resized, (paste_x, paste_y), source_resized)
    
    # 保存结果
    new_img.save(output_path, 'PNG', optimize=True)
    
    print(f"\n✓ 完成! 已保存到: {output_path}")
    print(f"  新图片尺寸: {new_img.size[0]}x{new_img.size[1]}")
    print(f"  新logo内容大小: {new_width}x{new_height}")
    
    return True

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    target_path = sys.argv[1]
    source_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        success = adjust_logo(target_path, source_path, output_path)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)