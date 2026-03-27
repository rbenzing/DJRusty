---
name: windows-environment
description: Context for AI agents operating on Windows machines — correct path separators, PowerShell vs bash differences, Windows-specific commands, and common pitfalls to avoid.
---

# Windows Environment Guide

You are operating on a **Windows** machine. This guide prevents common mistakes AI agents make when assuming Linux or macOS.

## Shell: PowerShell (not bash)

The default shell is **PowerShell**. Do NOT use bash syntax.

| Task | ❌ Bash (wrong) | ✅ PowerShell (correct) |
|------|----------------|------------------------|
| List files | `ls -la` | `Get-ChildItem` or `dir` |
| Find text in files | `grep -r "pattern" .` | `Select-String -Path *.cs -Pattern "pattern" -Recurse` |
| Environment variable | `echo $HOME` | `$env:USERPROFILE` or `$env:HOME` |
| Set env var | `export FOO=bar` | `$env:FOO = "bar"` |
| Chain commands | `cmd1 && cmd2` | `cmd1; if ($?) { cmd2 }` |
| Redirect stderr | `2>/dev/null` | `2>$null` |
| Null device | `/dev/null` | `$null` or `NUL` |
| Which/where | `which git` | `Get-Command git` or `where.exe git` |
| Process list | `ps aux` | `Get-Process` |
| Kill process | `kill -9 PID` | `Stop-Process -Id PID -Force` |
| File permissions | `chmod +x file` | Not applicable (use `Unblock-File` for downloaded scripts) |
| Create directory | `mkdir -p path/to/dir` | `New-Item -ItemType Directory -Path "path\to\dir" -Force` |
| Remove directory | `rm -rf dir` | `Remove-Item -Recurse -Force dir` |
| Cat file | `cat file.txt` | `Get-Content file.txt` |
| Head/tail | `head -20 file` | `Get-Content file -TotalCount 20` / `Get-Content file -Tail 20` |
| Curl | `curl -s URL` | `Invoke-RestMethod URL` or `Invoke-WebRequest URL` |

## Path Separators

- Windows uses **backslashes**: `C:\Users\dev\project\src\file.cs`
- Forward slashes work in most contexts but not all (especially native Windows APIs)
- Use `Join-Path` to build paths safely: `Join-Path $env:USERPROFILE "project" "src"`
- Use `[System.IO.Path]::Combine()` for multi-segment paths

### Common Path Variables

| Variable | Windows | Linux/Mac equivalent |
|----------|---------|---------------------|
| Home directory | `$env:USERPROFILE` | `$HOME` or `~` |
| Temp directory | `$env:TEMP` | `/tmp` |
| Program Files | `$env:ProgramFiles` | `/usr/local` |
| App Data | `$env:APPDATA` | `~/.config` |
| Current dir | `$PWD` or `Get-Location` | `$PWD` |

## Line Endings

- Windows uses `\r\n` (CRLF), Linux/Mac uses `\n` (LF)
- Git usually handles this via `core.autocrlf`
- When writing files, be aware of encoding: PowerShell defaults to UTF-16 LE BOM
- Use `-Encoding utf8` or `-Encoding utf8NoBOM` when writing files:
  ```powershell
  Set-Content -Path "file.txt" -Value $content -Encoding utf8
  ```

## Case Sensitivity

- Windows file system is **case-insensitive** (but case-preserving)
- `File.txt` and `file.txt` are the **same file** on Windows
- Do NOT create files that differ only by case — it will cause conflicts

## Running Scripts

- PowerShell execution policy may block scripts. If needed:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
- Run `.ps1` scripts directly: `.\script.ps1` (note the `.\` prefix for current directory)
- Python: `python script.py` (not `python3` — Windows typically uses `python`)
- Node.js: `node script.js` (same as Linux)

## Package Managers

| Tool | Windows command |
|------|----------------|
| Node.js packages | `npm install` / `yarn` / `pnpm` |
| Python packages | `pip install` (not `pip3`) |
| .NET packages | `dotnet add package` |
| System packages | `winget install` or `choco install` |

## Process & Port Management

```powershell
# Find what's using a port
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Kill a process on a port
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```

## Common Gotchas

1. **`ls` is an alias for `Get-ChildItem`** — it works but returns objects, not text. Don't pipe it expecting Unix `ls` output format.
2. **`rm` is an alias for `Remove-Item`** — it works but doesn't support `-rf`. Use `-Recurse -Force` instead.
3. **`cat` is an alias for `Get-Content`** — returns an array of lines, not a single string.
4. **Semicolons, not `&&`** — PowerShell uses `;` to chain commands. `&&` works in PowerShell 7+ but not in Windows PowerShell 5.1.
5. **Single vs double quotes** — PowerShell only interpolates variables in double quotes: `"$var"` expands, `'$var'` is literal.
6. **`select` is an alias for `Select-Object`** — not the Unix `select` command.
7. **Long paths** — Windows has a 260-character path limit by default. Deep `node_modules` can hit this.

