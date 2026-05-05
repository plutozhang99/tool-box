#!/usr/bin/env python3

import pyautogui
import time
import sys
import signal

USER_PAUSE_SECS = 3 * 60  # pause duration when user moves mouse


def signal_handler(sig, frame) -> None:
    print('\nProgram terminated by user')
    sys.exit(0)


def user_moved(expected_x: int, expected_y: int) -> bool:
    x, y = pyautogui.position()
    return (x, y) != (expected_x, expected_y)


def main() -> None:
    signal.signal(signal.SIGINT, signal_handler)
    pyautogui.FAILSAFE = True

    print("Mouse mover started. Press Ctrl+C to exit.")

    try:
        while True:
            start_x, start_y = pyautogui.position()
            print(f"Current position: ({start_x}, {start_y})")

            pyautogui.moveTo(start_x + 100, start_y + 100)
            print("Moved to new position")
            time.sleep(20)

            if user_moved(start_x + 100, start_y + 100):
                print("User moved mouse — pausing 3 minutes before resuming.")
                time.sleep(USER_PAUSE_SECS)
                continue

            pyautogui.moveTo(start_x, start_y)
            print("Moved back to original position")
            time.sleep(20)

            if user_moved(start_x, start_y):
                print("User moved mouse — pausing 3 minutes before resuming.")
                time.sleep(USER_PAUSE_SECS)

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()