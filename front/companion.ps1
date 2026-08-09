# ==============================================================================
# Screen Controller Companion Script for Windows
# This script monitors the display state and minimizes/maximizes the browser window.
# ==============================================================================

# 1. Compile User32.dll window controls in memory
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

# 2. Get the base domain name (determines current URL dynamically)
$url = "https://screens.fly.dev/api/timer/state"
$lastState = ""

Clear-Host
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "     St-Philopateer Screens Companion Script" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Target URL: $url" -ForegroundColor DarkGray
Write-Host "Monitoring state change... Press Ctrl+C to exit." -ForegroundColor White
Write-Host "======================================================" -ForegroundColor Cyan

while ($true) {
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 5
        if ($response.active) {
            $currentState = $response.state
            if ($currentState -ne $lastState) {
                $lastState = $currentState
                
                # Find Chrome, Edge, or Brave processes running the screens page
                $process = Get-Process -Name "chrome", "msedge", "brave" -ErrorAction SilentlyContinue | 
                    Where-Object { $_.MainWindowTitle -like "*خدم? الشاشات*" } | 
                    Select-Object -First 1
                
                if ($process) {
                    $hwnd = $process.MainWindowHandle
                    if ($currentState -eq "minimize") {
                        Write-Host "$(Get-Date -Format 'HH:mm:ss') | State: MINIMIZE -> Minimizing browser..." -ForegroundColor Yellow
                        [WindowHelper]::ShowWindowAsync($hwnd, 6) # SW_MINIMIZE (minimizes the window)
                    } else {
                        Write-Host "$(Get-Date -Format 'HH:mm:ss') | State: MAXIMIZE -> Restoring and Maximizing..." -ForegroundColor Green
                        [WindowHelper]::ShowWindowAsync($hwnd, 3) # SW_SHOWMAXIMIZED (maximizes the window)
                        [WindowHelper]::SetForegroundWindow($hwnd)
                    }
                } else {
                    Write-Host "$(Get-Date -Format 'HH:mm:ss') | Warning: Browser with title '*خدمة الشاشات*' not found." -ForegroundColor DarkYellow
                }
            }
        } else {
            # Timer is inactive, ensure window is restored/maximized
            if ($lastState -ne "inactive") {
                $lastState = "inactive"
                Write-Host "$(Get-Date -Format 'HH:mm:ss') | Timer is INACTIVE. Restoring window..." -ForegroundColor Gray
                $process = Get-Process -Name "chrome", "msedge", "brave" -ErrorAction SilentlyContinue | 
                    Where-Object { $_.MainWindowTitle -like "*خدم? الشاشات*" } | 
                    Select-Object -First 1
                if ($process) {
                    $hwnd = $process.MainWindowHandle
                    [WindowHelper]::ShowWindowAsync($hwnd, 3)
                    [WindowHelper]::SetForegroundWindow($hwnd)
                }
            }
        }
    } catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') | Error connecting to server: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 2
}
