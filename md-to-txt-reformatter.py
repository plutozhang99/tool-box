#!/usr/bin/env python3
"""
Markdown to Plain Text Reformatter

将 MD 格式转换为 TXT 格式：
- 删除不必要的空格和格式符号
- 保留整体页面排版和结构
"""

import re
import sys
import argparse
from pathlib import Path


def strip_markdown_formatting(text: str) -> str:
    """Strip markdown formatting while preserving structure."""
    lines = text.split('\n')
    result_lines = []
    in_code_block = False
    code_block_indent = ""

    for i, line in enumerate(lines):
        # Code block handling
        if line.strip().startswith('```'):
            if in_code_block:
                in_code_block = False
                result_lines.append('')  # Blank line after code block
            else:
                in_code_block = True
                if result_lines and result_lines[-1].strip():
                    result_lines.append('')
            continue

        if in_code_block:
            result_lines.append(line)
            continue

        # Process non-code lines
        processed = line

        # Remove header markers (# ## ### etc)
        processed = re.sub(r'^#{1,6}\s+', '', processed)

        # Remove blockquote marker
        processed = re.sub(r'^>\s*', '', processed)

        # Remove list markers but keep indentation for nested structure
        # Preserve list item content
        stripped = processed.strip()

        # Inline formatting: **bold** __bold__ *italic* _italic_
        processed = re.sub(r'\*\*(.+?)\*\*', r'\1', processed)
        processed = re.sub(r'__(.+?)__', r'\1', processed)
        processed = re.sub(r'\*(.+?)\*', r'\1', processed)
        processed = re.sub(r'_(.+?)_', r'\1', processed)

        # Links: [text](url) or [text](url "title") -> text
        processed = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', processed)

        # Inline code: `code` -> code
        processed = re.sub(r'`([^`]+)`', r'\1', processed)

        # Images: ![alt](url) -> alt or remove
        processed = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', processed)

        # Strikethrough: ~~text~~ -> text
        processed = re.sub(r'~~(.+?)~~', r'\1', processed)

        # Table separators: |---| and alignment
        if re.match(r'^\s*[\|:\-\s]+\s*$', processed.strip()):
            continue  # Skip table separator lines

        # Table cells: | cell | -> cell
        if '|' in processed:
            cells = [c.strip() for c in processed.split('|') if c.strip()]
            if cells:
                processed = '  '.join(cells)

        # Collapse multiple spaces to single space (within line, preserve leading indent)
        leading_spaces = len(processed) - len(processed.lstrip())
        rest = processed.lstrip()
        rest = re.sub(r' +', ' ', rest).strip()
        processed = '  ' * (leading_spaces // 2) + rest if rest else ''

        result_lines.append(processed)

    return '\n'.join(result_lines)


def cleanup_whitespace(text: str, max_blank_lines: int = 1) -> str:
    """Remove unnecessary whitespace while preserving structure."""
    # Collapse excessive blank lines
    text = re.sub(r'\n{3,}', '\n' * (max_blank_lines + 1), text)

    # Remove trailing spaces from each line
    lines = [line.rstrip() for line in text.split('\n')]

    # Remove leading/trailing blank lines
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    return '\n'.join(lines)


def reformat_md_to_txt(md_content: str) -> str:
    """Main conversion: MD -> clean TXT."""
    text = strip_markdown_formatting(md_content)
    text = cleanup_whitespace(text)
    return text


def main():
    usage_examples = '''
使用示例:
  python md-to-txt-reformatter.py input.md
    指定输入文件，转换结果输出到终端

  python md-to-txt-reformatter.py input.md -o output.txt
    指定输入和输出文件

  python md-to-txt-reformatter.py input.md -i
    输入为 MD 文件时，在同目录生成同名 .txt 文件

  cat input.md | python md-to-txt-reformatter.py
    从 stdin 读取，输出到 stdout

  cat input.md | python md-to-txt-reformatter.py -o output.txt
    从 stdin 读取，保存到指定文件
'''
    parser = argparse.ArgumentParser(
        description='将 Markdown 转为纯文本，删除不必要格式，保留排版',
        epilog=usage_examples,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        'input',
        nargs='?',
        help='输入的 MD 文件路径（不指定则从 stdin 读取）'
    )
    parser.add_argument(
        '-o', '--output',
        help='输出的 TXT 文件路径（不指定则输出到 stdout）'
    )
    parser.add_argument(
        '-i', '--inplace',
        action='store_true',
        help='输入为文件时，在同目录生成同名 .txt 文件'
    )
    args = parser.parse_args()

    # Read input
    if args.input:
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"错误: 文件不存在 '{args.input}'", file=sys.stderr)
            sys.exit(1)
        content = input_path.read_text(encoding='utf-8')
    else:
        content = sys.stdin.read()

    # Convert
    result = reformat_md_to_txt(content)

    # Write output
    if args.inplace and args.input:
        output_path = Path(args.input).with_suffix('.txt')
        if args.input == str(output_path):
            print("错误: 就地修改时不能覆盖原 MD 文件", file=sys.stderr)
            sys.exit(1)
        output_path.write_text(result, encoding='utf-8')
        print(f"已保存到: {output_path}")
    elif args.output:
        Path(args.output).write_text(result, encoding='utf-8')
        print(f"已保存到: {args.output}")
    else:
        print(result)


if __name__ == '__main__':
    main()
