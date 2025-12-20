#!/usr/bin/env python3
"""
自动获取安大略省驾照状态的脚本
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import sys
import os

# 驾照号码
LICENSE_NUMBER = "YOUR_LICENSE_NUMBER"

# ANSI颜色代码
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_step(message):
    """打印步骤信息"""
    print(f"{Colors.OKCYAN}→ {message}{Colors.ENDC}")

def print_success(message):
    """打印成功信息"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_status_box(status):
    """打印状态框，带视觉效果"""
    # 根据状态选择颜色和图标
    if "not valid" in status.lower() or "invalid" in status.lower():
        color = Colors.FAIL
        icon = "✗"
    elif "valid" in status.lower() and "not" not in status.lower():
        color = Colors.OKGREEN
        icon = "✓"
    else:
        color = Colors.WARNING
        icon = "⚠"
    
    # 打印精美的状态框
    width = 60
    border = "═" * width
    status_text = f"{icon}  驾照状态: {status}"
    padding_left = " " * ((width - len(status_text) - 2) // 2)
    padding_right = " " * (width - len(status_text) - len(padding_left) - 2)
    
    print(f"\n{Colors.BOLD}{color}{border}{Colors.ENDC}")
    print(f"{Colors.BOLD}{color}║{padding_left}{status_text}{padding_right}║{Colors.ENDC}")
    print(f"{Colors.BOLD}{color}{border}{Colors.ENDC}\n")

def check_license_status():
    """检查驾照状态"""
    driver = None
    try:
        # 初始化Chrome浏览器
        print_step("正在启动浏览器...")
        options = webdriver.ChromeOptions()
        # 如果需要无头模式，取消下面的注释
        # options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        driver = webdriver.Chrome(options=options)
        driver.implicitly_wait(10)
        
        # 第一步：访问输入页面
        print_step("正在访问输入页面...")
        driver.get("https://www.dlc.rus.mto.gov.on.ca/dlc/enter-details")
        
        # 等待页面加载 - 等待Angular应用初始化
        wait = WebDriverWait(driver, 30)
        print_step("等待页面完全加载...")
        time.sleep(3)  # 给Angular应用一些时间初始化
        
        # 等待Angular应用加载完成（检查app-root是否存在）
        try:
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "app-root")))
            print_success("Angular应用已加载")
        except TimeoutException:
            print(f"{Colors.WARNING}警告: 未检测到app-root，继续执行...{Colors.ENDC}")
        
        # 查找驾照号码输入框 - 使用成功的方法
        print_step("正在查找输入框...")
        license_component = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "app-licence-number-inputs"))
        )
        inputs = license_component.find_elements(By.TAG_NAME, "input")
        
        if len(inputs) < 3:
            raise Exception(f"未找到足够的输入框，只找到 {len(inputs)} 个")
        
        # 填写驾照号码
        print_success(f"找到 {len(inputs)} 个输入框")
        print_step("正在填写驾照号码...")
        parts = LICENSE_NUMBER.split('-')
        if len(parts) != 3:
            raise ValueError(f"驾照号码格式不正确: {LICENSE_NUMBER}")
        
        for i, part in enumerate(parts):
            # 滚动到元素可见
            driver.execute_script("arguments[0].scrollIntoView(true);", inputs[i])
            time.sleep(0.3)
            
            # 点击输入框使其获得焦点
            inputs[i].click()
            time.sleep(0.3)
            
            # 清空并输入
            inputs[i].clear()
            time.sleep(0.2)
            inputs[i].send_keys(part)
            print_success(f"已填写第 {i+1} 部分: {part}")
            time.sleep(0.5)
        
        print_success(f"已成功填写驾照号码: {LICENSE_NUMBER}")
        
        # 点击Next按钮 - 使用成功的方法
        print_step("正在点击Next按钮...")
        next_button = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "a.btn[href='#']"))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
        time.sleep(0.5)
        next_button.click()
        print_success("已点击Next按钮")
        
        # 等待页面跳转到确认页面
        print_step("等待确认页面加载...")
        wait.until(EC.url_contains("/dlc/confirm-order"))
        print_success("已进入确认页面")
        time.sleep(2)  # 等待页面完全渲染
        
        # 第二步：在确认页面选择"Personal Use"
        print_step("正在选择用途...")
        select_element = wait.until(
            EC.presence_of_element_located((By.ID, "intendedUse"))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", select_element)
        time.sleep(0.5)
        
        select = Select(select_element)
        select.select_by_visible_text("Personal Use")
        print_success("已选择: Personal Use")
        time.sleep(1)
        
        # 点击确认页面的Next按钮 - 使用成功的方法
        print_step("正在点击确认页面的Next按钮...")
        confirm_next_button = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "app-confirm-order a.btn[href='#']"))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", confirm_next_button)
        time.sleep(0.5)
        confirm_next_button.click()
        print_success("已点击确认页面的Next按钮")
        
        # 等待页面跳转到结果页面
        print_step("等待结果页面加载...")
        wait.until(EC.url_contains("/dlc/results"))
        print_success("已进入结果页面")
        time.sleep(3)  # 等待页面完全加载和渲染
        
        # 第三步：获取结果 - 使用成功的方法
        print_step("正在获取驾照状态...")
        status_element = wait.until(
            EC.presence_of_element_located((By.XPATH, "//app-report//div[contains(@class, 'tatu')]//h3"))
        )
        status = status_element.text.strip()
        
        # 打印精美的状态框
        print_status_box(status)
        return status
        
    except Exception as e:
        print(f"\n{Colors.FAIL}✗ 错误: {e}{Colors.ENDC}")
        if driver:
            # 保存截图以便调试
            try:
                driver.save_screenshot("error_screenshot.png")
                print(f"{Colors.WARNING}错误截图已保存为 error_screenshot.png{Colors.ENDC}")
            except:
                pass
        raise
    
    finally:
        if driver:
            print_step("正在关闭浏览器...")
            time.sleep(2)  # 等待用户查看结果
            driver.quit()

if __name__ == "__main__":
    try:
        status = check_license_status()
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n\n用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"\n执行失败: {e}")
        sys.exit(1)

