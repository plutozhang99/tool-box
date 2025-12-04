#!/usr/bin/env python3

import pyautogui
import time
import sys
import signal


def signal_handler(sig, frame):
    print('\nProgram terminated by user')
    sys.exit(0)


def main():
    # 设置安全退出
    signal.signal(signal.SIGINT, signal_handler)

    # 添加失败保护
    pyautogui.FAILSAFE = True

    print("Mouse mover started. Press Ctrl+C to exit.")

    try:
        while True:
            # 当前鼠标位置
            currentMouseX, currentMouseY = pyautogui.position()
            print(f"Current position: ({currentMouseX}, {currentMouseY})")

            # 移动鼠标到新的位置
            pyautogui.moveTo(currentMouseX + 100, currentMouseY + 100)
            print("Moved to new position")

            # 等待一段时间
            time.sleep(20)

            # 移动回原来的位置
            pyautogui.moveTo(currentMouseX, currentMouseY)
            print("Moved back to original position")

            # 再次等待一段时间
            time.sleep(20)

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()