param([int]$DisplayX, [int]$DisplayY, [int]$DisplayWidth, [int]$DisplayHeight)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DeskInput {
    [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT {
        public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT {
        public ushort wVk, wScan; public uint dwFlags, time; public UIntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Explicit)] public struct UNION {
        [FieldOffset(0)] public MOUSEINPUT mouse;
        [FieldOffset(0)] public KEYBDINPUT key;
    }
    [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION data; }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint map);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    public static int Width() { return GetSystemMetrics(0); }
    public static int Height() { return GetSystemMetrics(1); }
    static void Send(INPUT input) {
        if (SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) != 1)
            throw new InvalidOperationException("Input is blocked by the OS");
    }
    public static void DPI() {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
    }
    public static void Move(int x, int y) { if (!SetCursorPos(x,y)) throw new InvalidOperationException("Cursor unavailable"); }
    public static void Key(int vk, bool down, bool extended) {
        INPUT input = new INPUT(); input.type = 1;
        input.data.key.wScan = (ushort)MapVirtualKey((uint)vk, 0);
        input.data.key.dwFlags = 8u | (down ? 0u : 2u) | (extended ? 1u : 0u);
        Send(input);
    }
    public static void Button(int index, bool down) {
        INPUT input = new INPUT(); input.type = 0;
        input.data.mouse.dwFlags = index == 0 ? (down ? 2u : 4u) : (index == 2 ? (down ? 8u : 16u) : (down ? 32u : 64u)); Send(input);
    }
    public static void Wheel(int delta) {
        INPUT input = new INPUT(); input.type = 0;
        input.data.mouse.dwFlags = 2048; input.data.mouse.mouseData = unchecked((uint)-delta); Send(input);
    }
}
'@
[DeskInput]::DPI()
$DisplayX = 0; $DisplayY = 0
$DisplayWidth = [DeskInput]::Width(); $DisplayHeight = [DeskInput]::Height()
$keyMap = @{
    Enter=13; Escape=27; Backspace=8; Tab=9; Space=32; Minus=189; Equal=187;
    BracketLeft=219; BracketRight=221; Backslash=220; Semicolon=186; Quote=222;
    Backquote=192; Comma=188; Period=190; Slash=191; CapsLock=20;
    ShiftLeft=160; ShiftRight=161; ControlLeft=162; ControlRight=163;
    AltLeft=164; AltRight=165; MetaLeft=91; MetaRight=92;
    ArrowUp=38; ArrowDown=40; ArrowLeft=37; ArrowRight=39;
    Home=36; End=35; PageUp=33; PageDown=34; Delete=46; Insert=45
}
for ($i=65; $i -le 90; $i++) { $keyMap['Key'+[char]$i]=$i }
for ($i=0; $i -le 9; $i++) { $keyMap['Digit'+$i]=48+$i }
for ($i=1; $i -le 12; $i++) { $keyMap['F'+$i]=111+$i }
$extended = @('ControlRight','AltRight','MetaLeft','MetaRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Delete','Insert')
$pressed = @{}; $buttons = @{}
function Reset-Inputs {
    foreach ($code in @($pressed.Keys)) { [DeskInput]::Key($keyMap[$code],$false,($extended -contains $code)) }
    foreach ($index in @($buttons.Keys)) { [DeskInput]::Button([int]$index,$false) }
    $pressed.Clear(); $buttons.Clear()
}
[Console]::WriteLine('READY')
try {
    while ($null -ne ($line = [Console]::ReadLine())) {
        if ($line.Length -gt 1024) { continue }
        try { $item = $line | ConvertFrom-Json } catch { continue }
        switch ($item.type) {
            'reset' { Reset-Inputs }
            'move' {
                $x=[double]$item.x; $y=[double]$item.y
                if ($x -ge 0 -and $x -le 1 -and $y -ge 0 -and $y -le 1) {
                    [DeskInput]::Move($DisplayX+[int]($x*($DisplayWidth-1)),$DisplayY+[int]($y*($DisplayHeight-1)))
                }
            }
            'key' {
                if ($keyMap.ContainsKey([string]$item.code) -and $item.down -is [bool]) {
                    [DeskInput]::Key($keyMap[$item.code],$item.down,($extended -contains $item.code))
                    if ($item.down) { $pressed[$item.code]=$true } else { $pressed.Remove($item.code) }
                }
            }
            'button' {
                $index=[int]$item.button
                if ($index -ge 0 -and $index -le 2 -and $item.down -is [bool]) {
                    [DeskInput]::Button($index,$item.down)
                    if ($item.down) { $buttons[$index]=$true } else { $buttons.Remove($index) }
                }
            }
            'wheel' {
                if ([double]$item.delta -ge -1200 -and [double]$item.delta -le 1200) { [DeskInput]::Wheel([int]$item.delta) }
            }
        }
    }
} finally { Reset-Inputs }
